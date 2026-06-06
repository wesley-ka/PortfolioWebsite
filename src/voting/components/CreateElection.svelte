<script>
  import { getContext, onMount } from 'svelte';
  import { createVotingSession } from '../../services/voting-api.js';

  // Grab router context
  const { navigate } = getContext('router');

  // Form states
  let title = $state('');
  let candidateInput = $state('');
  let candidates = $state([]); // Default presets
  let expiryDateTime = $state(''); // Datetime string chosen by creator
  let minDateTime = $state(''); // Minimum allowed datetime (now + 5 mins)
  let deliveryTarget = $state('');
  
  // App UI states
  let isSubmitting = $state(false);
  let errorMsg = $state('');
  let deployedElection = $state(null); // Will hold the API response when successful
  let shareLink = $derived(deployedElection ? `${window.location.origin}/vote/${deployedElection.vote_id}` : '');
  let resultsLink = $derived(deployedElection ? `${window.location.origin}/results/${deployedElection.vote_id}` : '');

  // Clipboard copy feedback states
  let copiedLink = $state(false);
  let copiedId = $state(false);
  let copiedToken = $state(false);

  // Dynamic calculated expiry date representation
  let expiryTimeStr = $state('');

  onMount(() => {
    // Set minDateTime to current time plus 5 minutes
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const tzoffset = now.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(now - tzoffset)).toISOString().slice(0, 16);
    minDateTime = localISOTime;
    
    // Set default expiry to now + 1 hour (default)
    const defaultExpiry = new Date(now.getTime() + 55 * 60 * 1000); // +1 hour total
    expiryDateTime = (new Date(defaultExpiry - tzoffset)).toISOString().slice(0, 16);
  });

  // Calculate durationMinutes in Svelte 5 (derived state)
  let durationMinutes = $derived.by(() => {
    if (!expiryDateTime) return 60;
    const selected = new Date(expiryDateTime);
    const now = new Date();
    const diffMins = Math.round((selected - now) / 60000);
    return Math.max(1, diffMins);
  });

  function updateExpiryStr(mins) {
    const now = new Date();
    const expiry = new Date(now.getTime() + mins * 60 * 1000);
    expiryTimeStr = expiry.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  // Reactive dependency in Svelte 5
  $effect(() => {
    updateExpiryStr(durationMinutes);
  });

  // Candidate management
  function addCandidate() {
    const name = candidateInput.trim();
    if (!name) return;
    
    // Prevent duplicates
    if (candidates.some(c => c.toLowerCase() === name.toLowerCase())) {
      errorMsg = 'Candidate already exists in list.';
      return;
    }
    
    candidates = [...candidates, name];
    candidateInput = '';
    errorMsg = '';
  }

  function handleKeydown(event) {
    if (event.key === 'Enter') {
      event.preventDefault();
      addCandidate();
    }
  }

  function removeCandidate(index) {
    candidates = candidates.filter((_, i) => i !== index);
  }

  function setDurationPreset(mins) {
    durationMinutes = mins;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    
    if (candidates.length < 2) {
      errorMsg = 'At least 2 candidates are required to start an election.';
      return;
    }

    errorMsg = '';
    isSubmitting = true;

    try {
      const response = await createVotingSession({
        title,
        candidates,
        duration_minutes: durationMinutes,
        delivery_target: deliveryTarget || null
      });
      deployedElection = response;
    } catch (err) {
      console.error(err);
      errorMsg = err.message || 'Failed to create voting session. Verify API server connectivity.';
    } finally {
      isSubmitting = false;
    }
  }

  function copyToClipboard(text, stateVar) {
    navigator.clipboard.writeText(text);
    if (stateVar === 'link') {
      copiedLink = true;
      setTimeout(() => copiedLink = false, 2000);
    } else if (stateVar === 'id') {
      copiedId = true;
      setTimeout(() => copiedId = false, 2000);
    } else if (stateVar === 'token') {
      copiedToken = true;
      setTimeout(() => copiedToken = false, 2000);
    }
  }
</script>

{#if !deployedElection}
  <!-- Election Creation Form -->
  <div class="w-full transition-all duration-500">
    
    <!-- Hero Intro -->
    <div class="text-center mb-8 space-y-2">
      <h2 class="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-indigo-200 to-indigo-400 bg-clip-text text-transparent font-sans">
        Deploy a Cryptographic Election
      </h2>
      <p class="text-sm text-slate-400 max-w-lg mx-auto leading-relaxed">
        Instantiate a zero-knowledge, zero-database ephemeral voting contract. ZKP Schnorr signatures guarantee anonymity and verify ballots client-side.
      </p>
    </div>

    <!-- Main Card -->
    <div class="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 shadow-glass relative overflow-hidden">
      
      {#if errorMsg}
        <div class="mb-6 px-4 py-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs sm:text-sm rounded-lg flex items-center space-x-2 animate-pulse">
          <span>⚠️</span>
          <span>{errorMsg}</span>
        </div>
      {/if}

      <form onsubmit={handleSubmit} class="space-y-6">
        
        <!-- Field 1: Title -->
        <div class="space-y-2">
          <label for="title" class="block text-xs font-mono text-slate-400 uppercase tracking-widest">1. Election Title</label>
          <input 
            type="text" 
            id="title" 
            required 
            bind:value={title} 
            placeholder="e.g. Representative Board Election" 
            class="w-full bg-slate-950/50 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
          />
        </div>

        <!-- Field 2: Candidates -->
        <div class="space-y-2">
          <label for="candidate-input" class="block text-xs font-mono text-slate-400 uppercase tracking-widest">2. Candidates List</label>
          <div class="flex space-x-2">
            <input 
              type="text" 
              id="candidate-input"
              bind:value={candidateInput}
              onkeydown={handleKeydown}
              placeholder="Enter candidate name..." 
              class="flex-grow bg-slate-950/50 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
            />
            <button 
              type="button" 
              onclick={addCandidate}
              class="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 hover:text-white px-4 py-2 rounded-lg text-sm transition-all"
            >
              + Add
            </button>
          </div>
          
          <!-- Candidates Chips Grid -->
          <div class="flex flex-wrap gap-2 pt-2">
            {#each candidates as cand, i}
              <div class="inline-flex items-center space-x-2 bg-indigo-500/5 border border-indigo-500/20 rounded-full px-3 py-1 text-xs text-indigo-300">
                <span>{cand}</span>
                <button 
                  type="button" 
                  onclick={() => removeCandidate(i)} 
                  class="text-[10px] text-slate-500 hover:text-rose-400 transition-colors bg-transparent border-0 cursor-pointer p-0"
                >
                  ✕
                </button>
              </div>
            {/each}
            {#if candidates.length === 0}
              <span class="text-xs text-slate-600 italic">No candidates added yet. Minimum 2.</span>
            {/if}
          </div>
        </div>

        <!-- Field 3: Voting Expiration -->
        <div class="space-y-2">
          <div class="flex justify-between items-center text-xs font-mono text-slate-400 uppercase tracking-widest">
            <span>3. Voting Expiration Date & Time</span>
            <span class="text-indigo-400 font-bold">Calculated Duration: {durationMinutes} min</span>
          </div>
          
          <input 
            type="datetime-local" 
            bind:value={expiryDateTime} 
            min={minDateTime}
            required
            class="w-full bg-slate-950/50 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg px-4 py-3 text-sm text-white outline-none transition-all [color-scheme:dark]"
          />
          <div class="text-[10px] font-mono text-slate-500 flex justify-between">
            <span>Minimum: Now + 5 mins</span>
            <span class="text-indigo-500/70">Calculated Expiry: {expiryTimeStr}</span>
          </div>
        </div>

        <!-- Field 4: Telegram CHAT ID -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label for="telegram" class="block text-xs font-mono text-slate-400 uppercase tracking-widest">4. Telegram Chat ID (Optional)</label>
            <span class="group relative cursor-help text-[10px] text-slate-600 hover:text-indigo-400 font-mono">[HELP]
              <span class="pointer-events-none absolute bottom-full right-0 w-56 p-2 bg-slate-900 border border-white/10 text-[10px] rounded text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-sans normal-case z-20 shadow-lg font-sans">
                Enter the Telegram Chat ID (user or group number) that will automatically receive the final results once the election closes.
              </span>
            </span>
          </div>
          <input 
            type="text" 
            id="telegram" 
            bind:value={deliveryTarget} 
            placeholder="e.g. -100123456789 or 987654321" 
            class="w-full bg-slate-950/50 border border-white/10 focus:border-indigo-500/60 focus:ring-1 focus:ring-indigo-500/60 rounded-lg px-4 py-3 text-sm text-white placeholder-slate-600 outline-none transition-all"
          />
        </div>

        <!-- Deploy Button -->
        <div class="pt-4">
          <button 
            type="submit" 
            disabled={isSubmitting}
            class="w-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold py-3 px-6 rounded-lg text-sm shadow-glow-blue tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
          >
            {#if isSubmitting}
              <svg class="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>GENERATING CRYPTO KEYPARAMS...</span>
            {:else}
              <span>⚡ DEPLOY CRYPTOGRAPHIC POLL</span>
            {/if}
          </button>
        </div>

      </form>
      
    </div>
  </div>
{:else}
  <!-- Success Screen -->
  <div class="w-full max-w-2xl mx-auto space-y-6 transition-all duration-500 animate-[fadeIn_0.5s_ease-out]">
    
    <!-- Success Badge -->
    <div class="text-center space-y-2">
      <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-3xl shadow-[0_0_30px_rgba(16,185,129,0.15)] mb-2">
        ✓
      </div>
      <h3 class="text-2xl font-bold tracking-tight text-emerald-400">Election Deployed Successfully</h3>
      <p class="text-sm text-slate-400 max-w-sm mx-auto">
        Your cryptographic keys are locked on-chain. Provide voters with the secure ballot URL below.
      </p>
    </div>

    <!-- Terminal Details Box -->
    <div class="backdrop-blur-md bg-slate-950/80 border border-white/10 rounded-2xl p-6 shadow-glass-lg font-mono text-xs sm:text-sm space-y-5">
      
      <div class="border-b border-white/5 pb-3 flex justify-between items-center">
        <span class="text-[10px] tracking-widest text-slate-500 uppercase">SYSTEM_DEPLOY_RECEIPT</span>
        <span class="text-indigo-400 text-[10px]">VERIFIED_BY_SCHNORR_ZKP</span>
      </div>

      <!-- Detail Row 1: Title -->
      <div class="flex flex-col sm:flex-row sm:justify-between gap-1">
        <span class="text-slate-500">POLL_TITLE:</span>
        <span class="text-slate-200 text-right">{title}</span>
      </div>

      <!-- Detail Row 2: Expiry -->
      <div class="flex flex-col sm:flex-row sm:justify-between gap-1">
        <span class="text-slate-500">EXPIRATION_UTC:</span>
        <span class="text-indigo-300 text-right">{new Date(deployedElection.expires_at).toISOString()}</span>
      </div>

      <!-- Detail Row 3: Vote ID -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-slate-500">ELECTION_VOTE_ID:</span>
          <button 
            onclick={() => copyToClipboard(deployedElection.vote_id, 'id')}
            class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            {copiedId ? '[COPIED!]' : '[COPY_ID]'}
          </button>
        </div>
        <div class="bg-slate-900 border border-white/5 rounded p-2.5 break-all text-xs text-indigo-200">
          {deployedElection.vote_id}
        </div>
      </div>

      <!-- Detail Row 4: Creator Token -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-amber-500 font-bold flex items-center space-x-1">
            <span>⚠️</span>
            <span>CREATOR_ACCESS_TOKEN:</span>
          </span>
          <button 
            onclick={() => copyToClipboard(deployedElection.creator_token, 'token')}
            class="text-[10px] text-amber-500 hover:text-amber-400 transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            {copiedToken ? '[COPIED!]' : '[COPY_TOKEN]'}
          </button>
        </div>
        <div class="bg-amber-950/20 border border-amber-500/20 rounded p-2.5 break-all text-xs text-amber-300">
          {deployedElection.creator_token}
        </div>
        <div class="mt-2 space-y-2 text-[10px] leading-relaxed">
          <p class="text-amber-400/80 font-semibold">⚠️ Displayed once — never stored server-side. Save it now.</p>
          <p class="text-slate-400">This token is the <span class="text-slate-200">only credential</span> that can terminate this election early (before its scheduled expiry). If lost, it cannot be recovered.</p>
          <p class="text-slate-500">To delete this election before it expires, run:</p>
          <div class="bg-slate-950 border border-white/5 rounded p-2 font-mono text-slate-400 break-all select-all">
            curl -X DELETE https://awka.dev/api/v1/voting/{deployedElection.vote_id} \<br/>
            &nbsp;&nbsp;-H "Authorization: Bearer {deployedElection.creator_token}"
          </div>
          <p class="text-slate-600">⚠️ Deletion is irreversible — all ballots are purged immediately with no result compilation.</p>
        </div>
      </div>

      <!-- Detail Row 5: Share Link -->
      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <span class="text-slate-500">VOTER_SHARE_LINK:</span>
          <button 
            onclick={() => copyToClipboard(shareLink, 'link')}
            class="text-[10px] text-indigo-400 hover:text-indigo-300 transition-colors bg-transparent border-0 cursor-pointer p-0"
          >
            {copiedLink ? '[COPIED!]' : '[COPY_LINK]'}
          </button>
        </div>
        <div class="bg-slate-900 border border-white/5 rounded p-2.5 break-all text-xs text-indigo-200">
          {shareLink}
        </div>
      </div>

    </div>

    <!-- Navigation actions -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <button 
        onclick={() => navigate(`/vote/${deployedElection.vote_id}`)}
        class="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 px-4 rounded-xl text-sm transition-colors text-center cursor-pointer shadow-md"
      >
        🗳️ Enter Voting Booth
      </button>
      <button 
        onclick={() => navigate(`/results/${deployedElection.vote_id}`)}
        class="w-full bg-slate-900 border border-white/10 hover:border-indigo-500/30 text-slate-300 hover:text-white font-semibold py-3 px-4 rounded-xl text-sm transition-all text-center cursor-pointer"
      >
        📊 Open Auditor Dashboard
      </button>
    </div>

  </div>
{/if}
