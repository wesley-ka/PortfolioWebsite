<script>
  import { fade, fly, scale } from 'svelte/transition';
  import { generateSchnorrProof } from '../../services/crypto-math.js';
  import { verifyZkpProof } from '../../services/api.js';

  // States
  let birthYear = 2000;
  let isPending = false;
  let result = null;
  let errorMsg = null;
  let generatedProof = null;
  let copied = false;
  // Snapshot of age context at proof submission time
  let resultAgeValid = false;
  let resultAge = 0;

  const currentYear = new Date().getFullYear();
  $: estimatedAge = currentYear - birthYear;
  $: meetsThreshold = estimatedAge >= 18;

  async function runProving() {
    isPending = true;
    result = null;
    generatedProof = null;
    errorMsg = null;
    resultAgeValid = meetsThreshold;
    resultAge = estimatedAge;

    try {
      const proof = await generateSchnorrProof(birthYear, meetsThreshold);
      generatedProof = proof;

      const response = await verifyZkpProof({
        commitment_hash: proof.commitment_hash,
        commitment_x: proof.commitment_x,
        commitment_y: proof.commitment_y,
        challenge: proof.challenge,
        response: proof.response,
        public_key_x: proof.public_key_x,
        public_key_y: proof.public_key_y,
        base_point_x: proof.base_point_x,
        base_point_y: proof.base_point_y
      });

      result = response;
    } catch (err) {
      errorMsg = err.message || "Failed to generate or verify ZKP proof.";
    } finally {
      isPending = false;
    }
  }

  async function copyToClipboard(text) {
    try {
      await navigator.clipboard.writeText(text);
      copied = true;
      setTimeout(() => copied = false, 2000);
    } catch (err) {
      console.error(err);
    }
  }
</script>

<div class="space-y-5">
  {#if !isPending && !result}
    <!-- Input Section -->
    <div in:fade={{ duration: 200 }} class="space-y-5">
      <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-5">
        
        <!-- Birth year selector -->
        <div class="space-y-3">
          <div class="flex justify-between items-center">
            <label for="zkp-birth-year-slider" class="text-xs font-semibold text-slate-400 font-mono">
              SECRET INPUT (Birth Year):
            </label>
            <span class="text-lg font-bold font-mono px-3 py-0.5 rounded border transition-colors duration-300
              {meetsThreshold ? 'text-blue-400 bg-blue-500/10 border-blue-500/25' : 'text-amber-400 bg-amber-500/10 border-amber-500/25'}">
              {birthYear}
            </span>
          </div>

          <input
            id="zkp-birth-year-slider"
            type="range"
            min="1970"
            max={currentYear}
            bind:value={birthYear}
            class="w-full h-1.5 rounded bg-slate-800 cursor-pointer
              {meetsThreshold ? 'accent-blue-500' : 'accent-amber-500'}"
          />

          <div class="flex justify-between text-[9px] font-mono text-slate-500">
            <span>1970 (Age {currentYear - 1970})</span>
            <span>Today ({currentYear})</span>
          </div>

          <!-- Live age + threshold status -->
          <div class="flex items-center gap-2">
            <span class="text-[10px] font-mono text-slate-500">Estimated age:</span>
            <span class="text-[11px] font-bold font-mono {meetsThreshold ? 'text-blue-300' : 'text-amber-300'}">{estimatedAge} yrs</span>
            {#if meetsThreshold}
              <span class="ml-auto text-[9px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                ✓ Meets threshold (≥ 18)
              </span>
            {:else}
              <span class="ml-auto text-[9px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/25">
                ✗ Below threshold (&lt; 18)
              </span>
            {/if}
          </div>
        </div>

        <!-- Proving Statement Info -->
        <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-2.5">
          <div class="text-[10px] font-semibold text-slate-500 font-mono uppercase tracking-wide">
            Schnorr Proof Assertion (what is being claimed):
          </div>
          <div class="text-xs text-slate-300 leading-relaxed">
            “I hold a private credential key <math-var>x</math-var> (derived from secret year <span class="text-blue-400 blur-sm hover:blur-none transition-all duration-300 font-mono">{birthYear}</span>) corresponding to public key <math-var>Y = x · G</math-var>. I prove knowledge of <math-var>x</math-var> satisfying challenge <math-var>c</math-var> with response <math-var>s</math-var>, such that <math-var>s · G = R + c · Y</math-var>.”
          </div>
          <div class="space-y-1.5 border-t border-white/5 pt-2">
            <div class="flex items-start gap-2">
              <span class="text-[9px] font-mono font-bold text-emerald-400 mt-0.5 shrink-0">L1</span>
              <span class="text-[10px] text-slate-400 leading-snug">
                <span class="text-slate-300 font-semibold">Cryptographic integrity</span> — proves the prover knows <math-var>x</math-var> behind public key <math-var>Y</math-var>. Always valid when the math is correct.
              </span>
            </div>
            <div class="flex items-start gap-2">
              <span class="text-[9px] font-mono font-bold mt-0.5 shrink-0 {meetsThreshold ? 'text-blue-400' : 'text-amber-400'}">L2</span>
              <span class="text-[10px] text-slate-400 leading-snug">
                <span class="font-semibold {meetsThreshold ? 'text-slate-300' : 'text-amber-300'}">Age assertion (subject is ≥ 18)</span> — the secret encodes age {estimatedAge}.
                {#if meetsThreshold}
                  This claim <span class="text-blue-400 font-semibold">passes</span>.
                {:else}
                  This claim <span class="text-amber-400 font-semibold">fails</span> — the proof is valid cryptographically, but proves the subject is <span class="text-amber-300 font-semibold">under 18</span>.
                {/if}
              </span>
            </div>
          </div>
        </div>

        {#if !meetsThreshold}
          <div class="flex items-start gap-2.5 p-3 rounded-lg bg-amber-950/40 border border-amber-500/25 text-[10px] text-amber-300 leading-relaxed">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 mt-0.5 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span><span class="font-bold text-amber-400">Age threshold not met.</span> The ZKP will be cryptographically valid, but the verifier will reject the age assertion and deny access.</span>
          </div>
        {/if}

        <!-- Submit Button -->
        <button
          on:click={runProving}
          class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider transition-all duration-300 border flex flex-col items-center justify-center space-y-0.5
            {meetsThreshold
              ? 'bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 border-blue-500/20 hover:border-blue-400/40 text-slate-100'
              : 'bg-gradient-to-r from-amber-800/50 to-amber-900/50 hover:from-amber-700/50 hover:to-amber-800/50 border-amber-500/30 hover:border-amber-400/40 text-amber-100'}"
        >
          <div class="flex items-center space-x-2">
            {#if meetsThreshold}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              <span>Generate &amp; Verify Age Proof</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-amber-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span>Prove Under-18 (Assertion Will Fail)</span>
            {/if}
          </div>
          <span class="text-[9px] font-mono font-normal normal-case tracking-normal {meetsThreshold ? 'text-blue-400/70' : 'text-amber-400/70'}">POST /v1/identity/zkp-verify</span>
        </button>

      </div>
    </div>
  {:else if isPending}
    <!-- Loading and Prover details -->
    <div class="flex flex-col items-center justify-center py-10 space-y-5">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
      
      <div class="text-center space-y-1">
        <h4 class="text-[11px] font-bold text-blue-300 font-mono animate-pulse uppercase">// Generating Schnorr Proof-of-Knowledge...</h4>
        <p class="text-[10px] text-slate-500 font-mono">k ∈ Z_n • R = k * G • s = k + c * x (mod n)</p>
      </div>
    </div>
  {:else if result}
    <!-- ZKP Result Output -->
    <div in:fly={{ y: 15, duration: 300 }} class="space-y-4">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold font-mono uppercase {resultAgeValid ? 'text-blue-400' : 'text-amber-400'}">ZKP Verification Result</span>
        <div class="flex gap-2">
          <button
            on:click={() => copyToClipboard(JSON.stringify({ proof: generatedProof, verification: result }, null, 2))}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            {copied ? 'Copied ✓' : 'Copy Proof & Verification'}
          </button>
          <button
            on:click={() => { result = null; generatedProof = null; }}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            Prove Again
          </button>
        </div>
      </div>

      <!-- Layer 1: Cryptographic Integrity (compact row) -->
      <div class="flex items-center justify-between px-3.5 py-2.5 rounded-lg bg-slate-950/80 border border-white/5">
        <div>
          <div class="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-0.5">L1 — Cryptographic Integrity</div>
          <div class="text-[10px] font-mono text-slate-400"><math-var>s · G = R + c · Y</math-var> verified on secp256r1</div>
        </div>
        {#if result.verified}
          <span class="text-[10px] font-bold font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-md shrink-0">PROOF VALID ✓</span>
        {:else}
          <span class="text-[10px] font-bold font-mono text-red-400 bg-red-500/10 border border-red-500/20 px-2.5 py-1 rounded-md shrink-0">PROOF INVALID ✗</span>
        {/if}
      </div>

      <!-- Layer 2: Age Assertion — primary outcome banner -->
      <div class="p-4 rounded-lg border text-center
        {resultAgeValid ? 'bg-blue-500/10 border-blue-500/25' : 'bg-amber-950/40 border-amber-500/30'}">
        <div class="text-[9px] font-mono uppercase tracking-widest text-slate-500 mb-2">L2 — Age Assertion (≥ 18)</div>
        {#if resultAgeValid}
          <div class="text-2xl font-extrabold text-blue-400">ACCESS GRANTED ✓</div>
          <p class="text-[10px] font-mono text-blue-300/70 mt-1.5">
            Subject age {resultAge} — threshold met. Identity credential accepted.
          </p>
        {:else}
          <div class="text-2xl font-extrabold text-amber-400">ACCESS DENIED ✗</div>
          <p class="text-[10px] font-mono text-amber-300/60 mt-1.5 leading-snug">
            Subject age {resultAge} — below the ≥ 18 threshold.<br/>
            <span class="text-slate-500">Proof is cryptographically sound but the age claim does not satisfy the assertion.</span>
          </p>
        {/if}
      </div>

      <!-- Math coordinate outputs -->
      <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-2 font-mono text-[9px]">
        <div class="text-slate-500 uppercase font-semibold">Proof Coordinates (secp256r1):</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-400">
          <div>
            <span class="text-blue-400 font-bold">R.x (Commitment):</span> {generatedProof?.commitment_x.substring(0, 16)}...
          </div>
          <div>
            <span class="text-blue-400 font-bold">R.y (Commitment):</span> {generatedProof?.commitment_y.substring(0, 16)}...
          </div>
          <div>
            <span class="text-blue-400 font-bold">Challenge c:</span> {generatedProof?.challenge.substring(0, 16)}...
          </div>
          <div>
            <span class="text-blue-400 font-bold">Response s:</span> {generatedProof?.response.substring(0, 16)}...
          </div>
        </div>
      </div>

      <!-- Verifier Proof Logs -->
      <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
        <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400 flex items-center justify-between">
          <span>verifier_proof_logs.txt</span>
          <span class="text-[9px] text-blue-500 font-bold">SECURE_VERIFIER</span>
        </div>
        <div class="p-3 text-[10px] font-mono text-slate-300 max-h-[140px] overflow-y-auto space-y-1 scrollbar-thin">
          {#each result.proof_log as log}
            <div class="flex items-start space-x-1">
              <span class="text-slate-600 select-none">&gt;</span>
              <span class="leading-relaxed">{log}</span>
            </div>
          {/each}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  math-var {
    font-style: italic;
    font-family: 'Georgia', 'Times New Roman', serif;
    font-size: 0.8rem;
    color: #93c5fd; /* blue-300 */
    letter-spacing: 0.01em;
  }
</style>
