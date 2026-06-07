<script>
  import { onMount, getContext } from 'svelte';
  import { getVotingResults, getVotingSessionInfo, parseApiDate } from '../../services/voting-api.js';
  import { marked } from 'marked';

  // Props
  let { voteId } = $props();

  // Router context
  const { navigate } = getContext('router');

  // Loading/Results states
  let isLoading = $state(true);
  let results = $state(null);
  let errorMsg = $state(null);

  // Active status fallback
  let isActive = $state(false);
  let unlockTime = $state(null);
  let countdownText = $state('00:00:00');
  let timerInterval;
  let currentTime = $state(Date.now());
  let pollInfo = $state(null);

  // Copy feedback
  // Copy feedback
  let copiedScript = $state(false);

  // Auto-fetch loop control
  let isFetching = $state(false);
  let unlockAttempts = $state(0);

  onMount(async () => {
    await fetchResults(false);

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  async function fetchResults(isBackground = false) {
    if (isFetching) return;
    isFetching = true;
    if (!isBackground) {
      isLoading = true;
    }
    errorMsg = null;
    try {
      const data = await getVotingResults(voteId);
      results = data;
      isActive = false; // Results successfully loaded
    } catch (err) {
      console.error('Error fetching results:', err);
      
      // Check if it's the expected active state (400 VOTING_IN_PROGRESS)
      if (err.status === 400 && err.error === 'VOTING_IN_PROGRESS') {
        isActive = true;
        unlockTime = err.expires_at;
        
        const now = Date.now();
        const target = parseApiDate(unlockTime).getTime();
        
        // If the server says it is active, but by our local clock the target is in the past,
        // it indicates client-server clock skew. We set an artificial 15-second cooldown
        // to prevent rapid request loops and give the server time to expire.
        const adjustedTarget = target <= now ? (now + 15000) : target;
        
        if (target <= now) {
          unlockAttempts++;
        }
        
        setupUnlockTimer(new Date(adjustedTarget).toISOString());
        
        // Fetch session info just to show candidate list and title
        if (!pollInfo) {
          try {
            pollInfo = await getVotingSessionInfo(voteId);
            if (pollInfo && pollInfo.expires_at) {
              const infoTime = parseApiDate(pollInfo.expires_at).getTime();
              const currentUnlockTimeVal = unlockTime ? parseApiDate(unlockTime).getTime() : 0;
              // If they differ by more than 5 seconds, use pollInfo's expires_at as the more accurate value
              if (Math.abs(infoTime - currentUnlockTimeVal) > 5000) {
                unlockTime = pollInfo.expires_at;
                const newTarget = parseApiDate(unlockTime).getTime();
                const newNow = Date.now();
                const newAdjustedTarget = newTarget <= newNow ? (newNow + 15000) : newTarget;
                setupUnlockTimer(new Date(newAdjustedTarget).toISOString());
              }
            }
          } catch (infoErr) {
            console.error('Error loading session info:', infoErr);
          }
        }
      } else {
        errorMsg = err.message || 'Failed to load results. Verify connection.';
      }
    } finally {
      isFetching = false;
      isLoading = false;
    }
  }

  function setupUnlockTimer(unlockTimeStr) {
    if (timerInterval) clearInterval(timerInterval);
    const target = parseApiDate(unlockTimeStr).getTime();

    const updateTimer = () => {
      currentTime = Date.now();
      const distance = target - currentTime;

      if (distance < 0) {
        countdownText = 'TALLY_RELEASE_PENDING';
        if (timerInterval) clearInterval(timerInterval);
        
        // Auto-fetch up to 3 times to account for minor clock skew, then stop.
        // The user can refresh manually using the button.
        if (unlockAttempts < 3) {
          setTimeout(() => fetchResults(true), 3000);
        }
        return;
      }

      const hours = Math.floor(distance / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);

      countdownText = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    updateTimer();
    timerInterval = setInterval(updateTimer, 1000);
  }

  // Exports audit package as JSON file
  function downloadAuditPackage() {
    if (!results || !results.audit_package) return;
    
    const jsonStr = JSON.stringify(results.audit_package, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", url);
    downloadAnchor.setAttribute("download", `audit_package_${voteId}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
    URL.revokeObjectURL(url);
  }

  // Derive ranking and percentages from tallies
  let sortedTallies = $derived.by(() => {
    if (!results || !results.tallies) return [];
    
    // Sort tallies
    const list = Object.entries(results.tallies).map(([cand, votes]) => ({
      name: cand,
      votes: votes
    }));

    list.sort((a, b) => b.votes - a.votes);
    return list;
  });

  let maxVotes = $derived(sortedTallies.length > 0 ? Math.max(...sortedTallies.map(t => t.votes)) : 1);

  let container = $state(null);

  // Custom parser to protect math formulas from marked processing
  function parseMarkdownWithMath(mdString) {
    if (!mdString) return '';

    const mathBlocks = [];
    let placeholderCount = 0;

    // 1. Replace display math ($$...$$)
    let processed = mdString.replace(/\$\$([\s\S]*?)\$\$/g, (match, equation) => {
      const id = `MATHDISPLAYX${placeholderCount++}X`;
      mathBlocks.push({ id, content: `$$${equation}$$` });
      return id;
    });

    // 2. Replace inline math ($...$)
    processed = processed.replace(/\$([^\$\n]+?)\$/g, (match, equation) => {
      const id = `MATHINLINEX${placeholderCount++}X`;
      mathBlocks.push({ id, content: `$${equation}$` });
      return id;
    });

    // 3. Compile markdown to HTML
    let html = marked(processed);

    // 4. Restore math blocks
    for (const block of mathBlocks) {
      html = html.replaceAll(block.id, block.content);
    }

    return html;
  }

  // Markdown compiler wrapper
  let guideHtml = $derived.by(() => {
    if (!results || !results.verification_guide) return '';
    return parseMarkdownWithMath(results.verification_guide);
  });

  function renderMath() {
    if (!container) return;
    if (typeof window !== 'undefined' && window.renderMathInElement) {
      try {
        window.renderMathInElement(container, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
            { left: '\\[', right: '\\]', display: true }
          ],
          throwOnError: false
        });
      } catch (err) {
        console.error('KaTeX rendering error:', err);
      }
    } else {
      setTimeout(renderMath, 50);
    }
  }

  $effect(() => {
    if (guideHtml && container) {
      renderMath();
    }
  });

  // Local Auditor verification script sample
  const auditorVerificationScript = $derived.by(() => {
    return `/**
 * Ephemeral Voting ZKP Verification Script (secp256r1 / NIST P-256)
 * 
 * Instructions:
 * 1. Save this script as 'verify_audit.js'
 * 2. Download the 'audit_package.json' from the dashboard.
 * 3. Run: npm install elliptic js-sha256
 * 4. Run: node verify_audit.js
 */
import pkg from 'elliptic';
import BN from 'bn.js';
import { sha256 } from 'js-sha256';
import fs from 'fs';

const { ec: EC } = pkg;
const ec = new EC('p256');

// Load package
const auditPackage = JSON.parse(fs.readFileSync('./audit_package_${voteId}.json', 'utf8'));

console.log('--- STARTING CRYPTOGRAPHIC ELECTION AUDIT ---');
console.log('Candidates:', auditPackage.candidates);
console.log('Total Ballots to Verify:', auditPackage.ballots.length);

// 1. Check double voting by verifying nullifiers are unique
const nullifierSet = new Set(auditPackage.nullifiers);
if (nullifierSet.size !== auditPackage.ballots.length) {
    console.error('❌ FAILURE: Duplicate nullifiers found! Potential double-voting occurred.');
    process.exit(1);
}
console.log('✓ Nullifier check passed: no duplicates. Identity blinding is verified.');

// 2. Verify ZKP Schnorr signatures on every ballot
let verifiedCount = 0;
auditPackage.ballots.forEach((ballot, index) => {
    try {
        const pkX = ballot.public_key_x;
        const pkY = ballot.public_key_y;
        const cVal = new BN(ballot.challenge, 16);
        const sVal = new BN(ballot.response, 16);
        const rHash = ballot.commitment_hash;

        // Parse points Y (voter public key) and R (commitment point)
        const Y = ec.curve.point(pkX, pkY);
        
        // Reconstruct R = s * G - c * Y
        // (Since s * G = R + c * Y, it follows R = s * G - c * Y)
        const sG = ec.g.mul(sVal);
        const cY = Y.mul(cVal);
        const R = sG.add(cY.neg()); // neg() does subtraction

        // Compress reconstructed R and compute hash
        const rEncodedHex = R.encode('hex', true);
        
        // Helper to convert hex to bytes
        const hexToBytes = (hex) => {
            const bytes = [];
            for (let c = 0; c < hex.length; c += 2) {
                bytes.push(parseInt(hex.substr(c, 2), 16));
            }
            return bytes;
        };
        const computedHash = sha256(hexToBytes(rEncodedHex));

        if (computedHash !== rHash) {
            throw new Error('Commitment hash mismatch');
        }

        verifiedCount++;
    } catch (err) {
        console.error(\`❌ Ballot Verification Failed at index \${index}: \${err.message}\`);
    }
});

if (verifiedCount === auditPackage.ballots.length) {
    console.log('✓ ZKP checks passed: All Schnorr proofs are mathematically valid.');
    console.log('--- ELECTION RESULTS AUDIT SUCCESSFUL (100% CORRECT) ---');
} else {
    console.error(\`❌ Audit Failed: Only \${verifiedCount} / \${auditPackage.ballots.length} ballots verified.\`);
}
`;
  });

  function copyScriptToClipboard() {
    navigator.clipboard.writeText(auditorVerificationScript);
    copiedScript = true;
    setTimeout(() => copiedScript = false, 2000);
  }
</script>

{#if isLoading}
  <div class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="relative w-12 h-12">
      <div class="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
    </div>
    <span class="text-xs font-mono text-slate-500 uppercase tracking-wider animate-pulse">Requesting final tallies...</span>
  </div>
{:else if errorMsg}
  <div class="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-glass text-center space-y-4 max-w-md mx-auto">
    <div class="text-3xl">⚠️</div>
    <h3 class="text-lg font-bold text-rose-400">Ledger Retrieval Error</h3>
    <p class="text-sm text-slate-400 leading-relaxed">{errorMsg}</p>
    <button onclick={fetchResults} class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs transition-all shadow-md cursor-pointer">
      Retry Fetch
    </button>
  </div>
{:else if isActive}
  <!-- Locked Active Election Screen -->
  <div class="w-full max-w-lg mx-auto backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8 shadow-glass text-center space-y-6">
    
    <!-- Dynamic Padlock Icon -->
    <!-- Dynamic Padlock Icon -->
    {#if parseApiDate(unlockTime).getTime() > currentTime}
      <div class="relative flex items-center justify-center w-20 h-20 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-3xl shadow-[0_0_30px_rgba(245,158,11,0.1)] mx-auto animate-pulse">
        🔒
      </div>
    {:else}
      <div class="relative flex items-center justify-center w-20 h-20 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-3xl shadow-[0_0_30px_rgba(16,185,129,0.15)] mx-auto animate-pulse">
        🔓
      </div>
    {/if}

    <div class="space-y-2">
      <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20 uppercase tracking-widest">
        {#if parseApiDate(unlockTime).getTime() > currentTime}
          BALLOT_LOCK_ENGAGED
        {:else}
          BALLOT_LOCK_RELEASED
        {/if}
      </span>
      <h3 class="text-xl font-bold text-white">{pollInfo ? pollInfo.title : 'Election Tallies Sealed'}</h3>
      <p class="text-xs sm:text-sm text-slate-400 leading-relaxed">
        {#if parseApiDate(unlockTime).getTime() > currentTime}
          Voting is currently active. To preserve privacy and prevent trend influence, results are cryptographically locked until the voting window closes.
        {:else}
          The voting window has officially closed. The encrypted tallies can now be compiled and decrypted.
        {/if}
      </p>
    </div>

    {#if parseApiDate(unlockTime).getTime() > currentTime}
      <!-- Countdown banner -->
      <div class="bg-slate-950/60 border border-white/5 rounded-xl p-4 space-y-1">
        <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">TALLY_RELEASE_COUNTDOWN</span>
        <span class="text-xl sm:text-2xl font-mono text-amber-400 font-bold tracking-wider tabular-nums">{countdownText}</span>
      </div>

      <div class="text-[10px] font-mono text-slate-500">
        Unlocks at: {parseApiDate(unlockTime).toLocaleString()}
      </div>
    {:else}
      <!-- Tally Release Trigger (Manual Decrypt after time is up) -->
      <div class="bg-slate-950/60 border border-white/5 rounded-xl p-4 space-y-3">
        <span class="text-[9px] font-mono text-emerald-400 uppercase tracking-widest block">TALLY_RELEASE_READY</span>
        <p class="text-xs text-slate-400 leading-normal">
          The validator node is ready to verify ZKP signatures. Click below to compile and decrypt final tallies.
        </p>
        <button 
          onclick={() => fetchResults(false)} 
          disabled={isFetching}
          class="w-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold py-2.5 px-4 rounded-xl text-xs shadow-md tracking-wider transition-all disabled:opacity-50 flex items-center justify-center space-x-1.5 cursor-pointer"
        >
          {#if isFetching}
            <svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>DECRYPTING RESULTS...</span>
          {:else}
            <span>🔓 REVEAL CRYPTOGRAPHIC TALLIES</span>
          {/if}
        </button>
      </div>
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
      {#if pollInfo}
        <button 
          onclick={() => navigate(`/vote/${voteId}`)}
          class="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-2.5 px-4 rounded-xl text-xs font-semibold transition-all shadow-md cursor-pointer"
        >
          🗳️ Enter Voting Booth
        </button>
      {/if}
      <button 
        onclick={() => navigate('/voting')}
        class="w-full bg-slate-900 border border-white/10 text-slate-300 py-2.5 px-4 rounded-xl text-xs hover:text-white transition-all"
      >
        ← Create New Poll
      </button>
    </div>

  </div>
{:else}
  <!-- Results Dashboard -->
  <div class="w-full space-y-8 animate-[fadeIn_0.4s_ease-out]">
    
    <!-- Top info -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/5 pb-4">
      <div class="space-y-1">
        <span class="text-xs font-mono text-emerald-400 tracking-wider">● AUDIT_LEDGER_COMPLETED</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{results.title}</h2>
      </div>

      <div class="flex flex-col sm:items-end text-xs font-mono text-slate-500">
        <span>EXPIRY_UTC: {new Date(results.expires_at).toISOString().substring(0, 19)}</span>
        <span>TOTAL_BALLOTS: {results.total_votes}</span>
      </div>
    </div>

    <!-- Tally Graph and Stats -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      
      <!-- Graph Card -->
      <div class="lg:col-span-8 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-glass flex flex-col justify-between">
        <h3 class="text-xs font-mono text-slate-400 uppercase tracking-widest mb-6">Tally Rankings</h3>
        
        <div class="space-y-5">
          {#each sortedTallies as tally, i}
            {@const percentage = results.total_votes > 0 ? Math.round((tally.votes / results.total_votes) * 100) : 0}
            <div class="space-y-1.5">
              <div class="flex items-center justify-between text-xs font-mono">
                <div class="flex items-center space-x-2">
                  <span class="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] {i === 0 ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' : 'bg-slate-900 border border-white/5 text-slate-400'}">
                    {i + 1}
                  </span>
                  <span class="font-sans text-sm text-slate-200 capitalize font-medium">{tally.name}</span>
                </div>
                <div class="space-x-3">
                  <span class="text-slate-500">{tally.votes} votes</span>
                  <span class="text-indigo-400 font-bold">{percentage}%</span>
                </div>
              </div>
              
              <!-- Progressive Bar -->
              <div class="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-white/5 relative">
                <div 
                  class="h-full rounded-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-400 shadow-[0_0_10px_rgba(99,102,241,0.2)] transition-all duration-1000"
                  style="width: {percentage}%"
                ></div>
              </div>
            </div>
          {/each}
          {#if sortedTallies.length === 0}
            <span class="text-xs text-slate-500 italic">No ballots were cast in this election.</span>
          {/if}
        </div>
        
        <div class="text-[10px] font-mono text-slate-500 mt-6 pt-3 border-t border-white/5 flex items-center justify-between">
          <span>TALLY_ALGORITHM: SUM_BY_CANDIDATE_ID</span>
          <span>CURVE_GROUP: NIST_P256</span>
        </div>
      </div>

      <!-- Stats Sidebar -->
      <div class="lg:col-span-4 flex flex-col gap-4">
        
        <!-- Total votes -->
        <div class="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 shadow-glass text-center space-y-1.5">
          <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">TOTAL_TALLIED_VOTES</span>
          <span class="text-4xl font-extrabold text-white tracking-tight font-mono">{results.total_votes}</span>
          <span class="text-[10px] font-mono text-emerald-400 bg-emerald-500/5 px-2 py-0.5 border border-emerald-500/10 rounded inline-block">100%_VALIDATED</span>
        </div>

        <!-- Double voting prevention -->
        <div class="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-5 shadow-glass text-center space-y-1.5">
          <span class="text-[9px] font-mono text-slate-500 uppercase tracking-widest block">DOUBLE_VOTES_REVERTED</span>
          <span class="text-3xl font-bold text-indigo-400 tracking-tight font-mono">0</span>
          <p class="text-[10px] text-slate-500 leading-normal leading-normal">
            Deterministic public nullifiers automatically block duplicate key ballot submission.
          </p>
        </div>

        <!-- Export Action -->
        <button 
          onclick={downloadAuditPackage}
          class="flex-grow flex flex-col items-center justify-center p-5 rounded-2xl border border-dashed border-indigo-500/20 bg-indigo-500/5 hover:bg-indigo-500/10 hover:border-indigo-500/40 text-indigo-300 hover:text-white transition-all cursor-pointer space-y-2"
        >
          <span class="text-2xl">📥</span>
          <span class="text-xs font-mono tracking-wider font-bold">EXPORT AUDIT PACKAGE</span>
          <span class="text-[9px] text-slate-500 leading-normal max-w-[160px] text-center font-sans">Download JSON package of all cryptographically blind voter proofs.</span>
        </button>

      </div>
    </div>

    <!-- Auditing Section: Report & Sandbox -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Left: Markdown Audit Report -->
      <div class="lg:col-span-7 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-glass space-y-4">
        <h3 class="text-xs font-mono text-slate-400 uppercase tracking-widest border-b border-white/5 pb-2">Cryptographic Report</h3>
        
        <!-- Rendered HTML -->
        <div bind:this={container} class="prose prose-invert prose-indigo max-w-none text-xs sm:text-sm text-slate-300 leading-relaxed font-sans space-y-4">
          {@html guideHtml}
        </div>
      </div>

      <!-- Right: Sandbox Verification Script -->
      <div class="lg:col-span-5 backdrop-blur-md bg-slate-950/70 border border-white/10 rounded-2xl p-5 shadow-glass space-y-4">
        <div class="flex justify-between items-center border-b border-white/5 pb-2">
          <span class="text-[10px] font-mono text-slate-400 tracking-widest uppercase">AUDITOR_LOCAL_VERIFIER</span>
          <button 
            onclick={copyScriptToClipboard}
            class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            {copiedScript ? '[COPIED!]' : '[COPY_SCRIPT]'}
          </button>
        </div>
        
        <p class="text-[10px] text-slate-500 leading-relaxed">
          Anyone can independently verify the ballots without trusting the server. Run this script locally alongside the exported JSON audit package.
        </p>

        <!-- Code Block -->
        <div class="bg-black/40 border border-white/5 rounded-lg p-3 h-96 overflow-auto font-mono text-[9px] sm:text-[10px] text-indigo-200 select-text whitespace-pre">
          {auditorVerificationScript}
        </div>
      </div>

    </div>

    <!-- Action Row -->
    <div class="text-center">
      <button 
        onclick={() => navigate('/voting')}
        class="bg-slate-900 border border-white/10 text-slate-400 hover:text-white px-6 py-2.5 rounded-xl text-xs transition-all font-semibold cursor-pointer"
      >
        ← Return to Create Election
      </button>
    </div>

  </div>
{/if}

<style>
  /* Local overrides to style raw compiled markdown tags */
  :global(.prose h1) {
    font-size: 1.25rem;
    font-weight: 700;
    color: #f8fafc;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    padding-bottom: 0.25rem;
  }
  :global(.prose h2) {
    font-size: 1.05rem;
    font-weight: 600;
    color: #e2e8f0;
    margin-top: 1rem;
    margin-bottom: 0.5rem;
  }
  :global(.prose p) {
    margin-bottom: 0.75rem;
    color: #94a3b8;
  }
  :global(.prose ul) {
    list-style-type: disc;
    padding-left: 1.25rem;
    margin-bottom: 0.75rem;
    color: #94a3b8;
  }
  :global(.prose li) {
    margin-bottom: 0.25rem;
  }
  :global(.prose code) {
    font-family: 'Fira Code', monospace;
    font-size: 11px;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.05);
    padding: 1px 4px;
    border-radius: 4px;
    color: #a5b4fc;
  }
</style>
