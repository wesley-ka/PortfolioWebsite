<script>
  import { onMount, getContext } from 'svelte';
  import { getVotingSessionInfo, requestChallenge, castBallot, parseApiDate } from '../../services/voting-api.js';
  import { deriveVoterPublicKey, generateVotingZkp } from '../../services/voting-crypto.js';

  // Props
  let { voteId } = $props();

  // Router context
  const { navigate } = getContext('router');

  // Loading/Election status
  let isLoading = $state(true);
  let poll = $state(null);
  let errorMsg = $state(null);
  
  // Timer countdown state
  let countdownText = $state('00:00:00');
  let isExpired = $state(false);
  let timerInterval;

  // Form inputs
  let voterSecret = $state('');
  let selectedCandidate = $state('');
  let showSecret = $state(false);

  // Derived public key preview
  let derivedPk = $derived(deriveVoterPublicKey(voterSecret));

  // ZKP Math Engine terminal simulator
  let isZkpComputing = $state(false);
  let zkpConsoleLogs = $state([]);
  
  // Success receipt state
  let castReceipt = $state(null);
  let copiedReceipt = $state(false);

  onMount(async () => {
    try {
      poll = await getVotingSessionInfo(voteId);
      
      // If the voting session is already closed/expired, redirect to results immediately
      const now = Date.now();
      const expiresAt = parseApiDate(poll.expires_at).getTime();
      if (!poll.active || expiresAt <= now) {
        navigate(`/results/${voteId}`);
        return;
      }

      setupTimer(poll.expires_at);
    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'Failed to retrieve voting session details.';
    } finally {
      isLoading = false;
    }

    return () => {
      if (timerInterval) clearInterval(timerInterval);
    };
  });

  function setupTimer(expiresAtStr) {
    const expiresAt = parseApiDate(expiresAtStr).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const distance = expiresAt - now;

      if (distance < 0) {
        countdownText = 'EXP_VOTE_CLOSED';
        isExpired = true;
        if (timerInterval) clearInterval(timerInterval);
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

  // Sequenced logging helper for ZKP generator console
  function addConsoleLog(msg, delay = 0) {
    return new Promise(resolve => {
      setTimeout(() => {
        zkpConsoleLogs = [...zkpConsoleLogs, `> ${msg}`];
        resolve();
      }, delay);
    });
  }

  async function triggerVotingFlow(e) {
    e.preventDefault();
    if (!voterSecret.trim()) {
      errorMsg = 'Please enter your private passphrase.';
      return;
    }
    if (!selectedCandidate) {
      errorMsg = 'Please select a candidate to receive your ballot.';
      return;
    }

    errorMsg = null;
    isZkpComputing = true;
    zkpConsoleLogs = [];

    try {
      // 1. Terminal visualization logs
      await addConsoleLog('INITIALIZING LOCAL CRYPTOGRAPHIC PROVER...', 0);
      await addConsoleLog('Deriving private key scalar x from secret passphrase using SHA-256...', 200);
      await addConsoleLog(`Public Key derived: Y = (${derivedPk.x.substring(0, 10)}..., ${derivedPk.y.substring(0, 10)}...)`, 250);
      
      // 2. Compute voter's unique nullifier client-side
      await addConsoleLog('Computing deterministic public double-voting nullifier...', 200);
      // We calculate voterSecret hash and nullifier
      // Wait, let's call the actual ZKP generator inside the flow, but we can simulate the telemetry
      const { nullifier, public_key_x, public_key_y } = deriveVoterPublicKeyAndNullifier(voterSecret, voteId);
      await addConsoleLog(`Deterministic Nullifier generated: ${nullifier.substring(0, 16)}...`, 150);

      // 3. Request Validator Challenge
      await addConsoleLog('Requesting validator challenge from ephemeral server endpoint...', 250);
      const challengeResponse = await requestChallenge({
        vote_id: voteId,
        nullifier,
        public_key_x,
        public_key_y
      });
      const challengeHex = challengeResponse.challenge;
      await addConsoleLog(`Validator challenge received: c = ${challengeHex.substring(0, 16)}...`, 200);

      // 4. Generate local ZKP Schnorr proof
      await addConsoleLog('Generating ephemeral nonce k (curve order scalar)...', 250);
      await addConsoleLog('Computing commitment point R = k * G on secp256r1 curve...', 200);
      await addConsoleLog('Hashing commitment coordinates: H(R.x || R.y)...', 150);
      await addConsoleLog('Solving response scalar s = k + c * x (mod n) client-side...', 200);
      
      // Call actual ZKP generator
      const zkpProof = await generateVotingZkp(voterSecret, voteId, challengeHex);
      await addConsoleLog('ZKP proof package compiled successfully. Ready for validation.', 150);

      // 5. Submit Ballot
      await addConsoleLog('Transmitting proof parameters and encrypted ballot selection...', 250);
      const castResponse = await castBallot({
        vote_id: voteId,
        nullifier: zkpProof.nullifier,
        candidate_id: selectedCandidate,
        commitment_hash: zkpProof.commitment_hash,
        commitment_x: zkpProof.commitment_x,
        commitment_y: zkpProof.commitment_y,
        challenge: zkpProof.challenge,
        response: zkpProof.response,
        public_key_x: zkpProof.public_key_x,
        public_key_y: zkpProof.public_key_y
      });

      await addConsoleLog(`SERVER_RESPONSE: ${castResponse.status}`, 200);
      await addConsoleLog('BALLOT SUCCESSFULLY REGISTERED ON AUDIT LEDGER.', 150);
      
      // Delay slightly before showing success screen
      setTimeout(() => {
        castReceipt = {
          candidate_id: selectedCandidate,
          nullifier: zkpProof.nullifier,
          commitment_hash: zkpProof.commitment_hash,
          challenge: zkpProof.challenge,
          response: zkpProof.response,
          public_key_x: zkpProof.public_key_x,
          public_key_y: zkpProof.public_key_y
        };
        isZkpComputing = false;
      }, 800);

    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'Verification failed. The validator challenge failed or curve maths mismatch.';
      isZkpComputing = false;
    }
  }

  // Simple local helper to generate dummy nullifier for logs since sha256 is loaded inside crypto-math or js-sha256
  // We can import sha256 or derive it properly
  import { sha256 } from 'js-sha256';
  function deriveVoterPublicKeyAndNullifier(secret, vid) {
    const secretHash = sha256(secret);
    const key = deriveVoterPublicKey(secret);
    const nullifier = sha256(`${secretHash}:${vid}`);
    return {
      nullifier,
      public_key_x: key.x,
      public_key_y: key.y
    };
  }

  function copyReceipt() {
    navigator.clipboard.writeText(JSON.stringify(castReceipt, null, 2));
    copiedReceipt = true;
    setTimeout(() => copiedReceipt = false, 2000);
  }
</script>

{#if isLoading}
  <div class="flex flex-col items-center justify-center py-20 space-y-4">
    <div class="relative w-12 h-12">
      <div class="absolute inset-0 rounded-full border-4 border-indigo-500/10 border-t-indigo-500 animate-spin"></div>
    </div>
    <span class="text-xs font-mono text-slate-500 uppercase tracking-wider animate-pulse">Retrieving vote config...</span>
  </div>
{:else if errorMsg && !isZkpComputing && !castReceipt}
  <div class="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-glass text-center space-y-4 max-w-md mx-auto">
    <div class="text-3xl">⚠️</div>
    <h3 class="text-lg font-bold text-rose-400">Election Access Error</h3>
    <p class="text-sm text-slate-400 leading-relaxed">{errorMsg}</p>
    <button onclick={() => navigate('/voting')} class="w-full bg-slate-900 border border-white/10 text-slate-300 py-2.5 px-4 rounded-xl text-xs hover:text-white transition-all">
      Return to Dashboard
    </button>
  </div>
{:else if isZkpComputing}
  <!-- Math Console Screen -->
  <div class="w-full max-w-xl mx-auto backdrop-blur-md bg-slate-950/80 border border-white/10 rounded-2xl p-6 shadow-glass-lg space-y-6">
    <div class="flex items-center justify-between border-b border-white/5 pb-3">
      <div class="flex items-center space-x-2">
        <span class="relative flex h-2 w-2">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
        </span>
        <span class="text-xs font-mono text-indigo-400 uppercase tracking-widest">ZKP_MATH_ENGINE_ACTIVE</span>
      </div>
      <span class="text-[10px] font-mono text-slate-500">PROVING_KNOWLEDGE_OF_X</span>
    </div>

    <!-- Terminal Output -->
    <div class="bg-black/40 border border-white/5 rounded-lg p-4 h-64 overflow-y-auto font-mono text-[10px] sm:text-xs text-indigo-300 space-y-1">
      {#each zkpConsoleLogs as log}
        <div class="break-all">{log}</div>
      {/each}
      <div class="animate-pulse inline-block w-2 h-4 bg-indigo-400 ml-1 select-none">_</div>
    </div>

    <div class="text-center text-xs font-mono text-slate-500 animate-pulse">
      DO NOT CLOSE THE BROWSER. SOLVING CRYPTOGRAPHIC SCALARS LOCALLY...
    </div>
  </div>
{:else if castReceipt}
  <!-- Ballot Cast Successfully Receipt -->
  <div class="w-full max-w-xl mx-auto space-y-6 transition-all duration-500">
    
    <div class="text-center space-y-2">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 text-3xl shadow-[0_0_30px_rgba(99,102,241,0.15)] mb-2">
        🗳️
      </div>
      <h3 class="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent font-sans">Ballot Signed & Transmitted</h3>
      <p class="text-sm text-slate-400 max-w-xs mx-auto">
        Your vote has been cast. Here is your anonymized cryptographic receipt.
      </p>
    </div>

    <!-- Receipt -->
    <div class="backdrop-blur-md bg-slate-950/80 border border-white/10 rounded-2xl p-5 font-mono text-xs space-y-4 shadow-glass">
      
      <div class="flex justify-between items-center border-b border-white/5 pb-2">
        <span class="text-[9px] text-slate-500 uppercase tracking-widest">BALLOT_TRANSACTION_RECEIPT</span>
        <button 
          onclick={copyReceipt}
          class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer p-0"
        >
          {copiedReceipt ? '[COPIED!]' : '[COPY_RECEIPT]'}
        </button>
      </div>

      <div class="space-y-2.5">
        <div>
          <span class="text-slate-500 block text-[10px]">BALLOT_SELECTION (ANONYMOUS_INDEX):</span>
          <span class="text-emerald-400 font-bold uppercase">{castReceipt.candidate_id}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px]">DETERMINISTIC_NULLIFIER:</span>
          <span class="text-slate-300 break-all">{castReceipt.nullifier}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px]">COMMITMENT_HASH (H(R)):</span>
          <span class="text-slate-300 break-all">{castReceipt.commitment_hash}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px]">SCHNORR_RESPONSE_SCALAR_S:</span>
          <span class="text-slate-300 break-all">{castReceipt.response}</span>
        </div>
        <div>
          <span class="text-slate-500 block text-[10px]">VOTER_PUBLIC_KEY_X:</span>
          <span class="text-slate-300 break-all">{castReceipt.public_key_x}</span>
        </div>
      </div>
      
      <div class="border-t border-white/5 pt-3 text-[10px] text-slate-500 leading-relaxed">
        Verify this receipt in the final auditor audit ledger. The presence of your <code class="text-slate-300">nullifier</code> and <code class="text-slate-300">response scalar</code> validates that your vote was cast and verified on-chain.
      </div>
    </div>

    <!-- Navigation actions -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button 
        onclick={() => navigate(`/results/${voteId}`)}
        class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors text-center cursor-pointer shadow-md"
      >
        📊 View Audit & Results
      </button>
      <button 
        onclick={() => navigate('/voting')}
        class="w-full bg-slate-900 border border-white/10 hover:border-indigo-500/30 text-slate-300 hover:text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all text-center cursor-pointer"
      >
        ← Return to Dashboard
      </button>
    </div>

  </div>
{:else}
  <!-- Voting View Screen -->
  <div class="w-full transition-all duration-500">
    
    <!-- Countdown and Info Badge -->
    <div class="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      <div class="space-y-1">
        <span class="text-xs font-mono text-indigo-400 tracking-wider">ACTIVE_VOTE_SESSION</span>
        <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">{poll.title}</h2>
      </div>

      <!-- Live timer badge -->
      <div class="flex items-center space-x-2 bg-indigo-500/5 border border-indigo-500/20 px-4 py-2 rounded-xl self-start md:self-auto">
        <span class="text-[10px] font-mono text-slate-400 uppercase tracking-widest">Time Remaining:</span>
        <span class="text-sm font-mono text-indigo-400 font-bold tabular-nums tracking-wider">{countdownText}</span>
      </div>
    </div>

    {#if isExpired}
      <div class="backdrop-blur-md bg-rose-500/5 border border-rose-500/20 rounded-2xl p-6 text-center space-y-4">
        <div class="text-3xl">🛑</div>
        <h3 class="text-lg font-bold text-rose-400">Voting Window Closed</h3>
        <p class="text-sm text-slate-400">The election expired at {new Date(poll.expires_at).toLocaleString()}. You can no longer cast ballots, but you can audit the results.</p>
        <button 
          onclick={() => navigate(`/results/${voteId}`)}
          class="bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-sm transition-all shadow-md font-semibold cursor-pointer"
        >
          Check Audit Results
        </button>
      </div>
    {:else}
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        <!-- Left: Form Step Inputs -->
        <div class="lg:col-span-7 backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 shadow-glass space-y-5">
          
          <form onsubmit={triggerVotingFlow} class="space-y-6">
            
            <!-- Step 1: Passphrase input -->
            <div class="space-y-2">
              <div class="flex justify-between items-center">
                <label for="voter-secret" class="block text-xs font-mono text-slate-400 uppercase tracking-widest">1. Voter Identity Passphrase / Seed</label>
                <button 
                  type="button" 
                  onclick={() => showSecret = !showSecret} 
                  class="text-[10px] text-slate-500 hover:text-indigo-400 transition-colors bg-transparent border-0 cursor-pointer p-0"
                >
                  {showSecret ? 'Hide Passphrase' : 'Show Passphrase'}
                </button>
              </div>
              <input 
                type={showSecret ? 'text' : 'password'} 
                id="voter-secret" 
                required 
                bind:value={voterSecret} 
                placeholder="Enter secret identity seed (e.g. unique Government ID, Passport Number, or Passphrase)..." 
                class="w-full bg-slate-950/50 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
              />
              <p class="text-[10px] text-slate-500 leading-relaxed pt-1">
                <strong>Identity Note:</strong> In a production deployment, this private seed is a unique identifier (such as a hashed Government ID or biometric passport serial) retrieved locally via a smart card reader, biometric passport, or eIDAS-compliant digital certificate. This seed is processed strictly in local memory to derive the ZKP keys and is <strong>never</strong> transmitted to the server.
              </p>
            </div>

            <!-- Step 2: Choose candidate -->
            <div class="space-y-3">
              <span class="block text-xs font-mono text-slate-400 uppercase tracking-widest">2. Select Your Candidate</span>
              
              <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each poll.candidates as cand}
                  <button 
                    type="button"
                    onclick={() => selectedCandidate = cand.toLowerCase()}
                    class="flex items-center justify-between p-4 rounded-xl border text-left transition-all cursor-pointer bg-slate-950/30 {selectedCandidate === cand.toLowerCase() ? 'border-indigo-500 bg-indigo-500/5 text-white shadow-glow-blue' : 'border-white/5 text-slate-400 hover:border-white/10 hover:text-slate-200'}"
                  >
                    <span class="font-medium text-sm capitalize">{cand}</span>
                    <span class="w-4 h-4 rounded-full border flex items-center justify-center {selectedCandidate === cand.toLowerCase() ? 'border-indigo-400 bg-indigo-500' : 'border-slate-700'}">
                      {#if selectedCandidate === cand.toLowerCase()}
                        <span class="w-1.5 h-1.5 rounded-full bg-white"></span>
                      {/if}
                    </span>
                  </button>
                {/each}
              </div>
            </div>

            <!-- Cast Action -->
            <button 
              type="submit" 
              class="w-full bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-lg text-sm shadow-glow-blue tracking-wider transition-all flex items-center justify-center space-x-2 cursor-pointer"
            >
              <span>⚡ Generate ZKP & Cast Ballot</span>
            </button>

          </form>

        </div>

        <!-- Right: Cryptographic Telemetry Screen -->
        <div class="lg:col-span-5 backdrop-blur-md bg-slate-950/70 border border-white/10 rounded-2xl p-5 shadow-glass space-y-4">
          <div class="border-b border-white/5 pb-2 text-[10px] font-mono text-slate-500 tracking-widest uppercase">
            LOCAL_KEY_TELEMETRY
          </div>

          {#if voterSecret.trim()}
            <div class="font-mono text-[10px] space-y-3.5 text-indigo-300">
              <div class="space-y-1">
                <span class="text-slate-500 block uppercase">PUBLIC_KEY_X (hex):</span>
                <div class="bg-black/30 p-2 rounded border border-white/5 break-all leading-relaxed font-semibold">
                  {derivedPk.x}
                </div>
              </div>

              <div class="space-y-1">
                <span class="text-slate-500 block uppercase">PUBLIC_KEY_Y (hex):</span>
                <div class="bg-black/30 p-2 rounded border border-white/5 break-all leading-relaxed font-semibold">
                  {derivedPk.y}
                </div>
              </div>

              <div class="text-[9px] text-slate-500 leading-normal flex items-start space-x-1.5">
                <span class="text-indigo-400">ℹ</span>
                <span>These coordinates represent your public identity point $Y = x \cdot G$ on the secp256r1 curve, computed inside your browser dynamically.</span>
              </div>
            </div>
          {:else}
            <div class="flex flex-col items-center justify-center h-48 text-center px-4 space-y-2">
              <span class="text-slate-700 text-2xl">🔑</span>
              <span class="text-xs font-mono text-slate-500 uppercase tracking-widest">Idle Telemetry</span>
              <span class="text-[10px] text-slate-600">Enter a voter passphrase on the left to activate the elliptic curve math engine.</span>
            </div>
          {/if}
        </div>

      </div>
    {/if}
  </div>
{/if}
