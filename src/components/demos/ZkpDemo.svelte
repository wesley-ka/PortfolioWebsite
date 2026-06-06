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

  const currentYear = new Date().getFullYear();
  $: estimatedAge = currentYear - birthYear;
  $: meetsThreshold = estimatedAge >= 18;

  async function runProving() {
    isPending = true;
    result = null;
    generatedProof = null;
    errorMsg = null;

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
            <span class="text-lg font-bold text-blue-400 font-mono bg-blue-500/10 px-3 py-0.5 rounded border border-blue-500/25">
              {birthYear}
            </span>
          </div>
          
          <input
            id="zkp-birth-year-slider"
            type="range"
            min="1970"
            max={currentYear}
            bind:value={birthYear}
            class="w-full h-1.5 rounded bg-slate-800 accent-blue-500 cursor-pointer"
          />
          
          <div class="flex justify-between text-[9px] font-mono text-slate-500">
            <span>1970 (Age {currentYear - 1970})</span>
            <span>Today ({currentYear})</span>
          </div>
        </div>

        <!-- Proving Statement Info -->
        <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-2">
          <div class="text-[10px] font-semibold text-slate-500 font-mono uppercase tracking-wide">
            Decentralized Schnorr Proof Assertion:
          </div>
          <div class="text-xs text-slate-300 leading-relaxed">
            "I hold a private credential key $x$ (derived from secret year <span class="text-blue-400 blur-sm hover:blur-none transition-all duration-300 font-mono">{birthYear}</span>) corresponding to public key $Y = x \cdot G$. I prove knowledge of $x$ satisfying challenge $c$ with scalar response $s$, validating that $s \cdot G = R + c \cdot Y$."
          </div>
          <div class="flex items-center space-x-2 pt-1">
            <span class="text-[10px] font-mono text-slate-500">Subject Age:</span>
            <span class="text-xs font-bold font-mono text-slate-300">{estimatedAge} years old</span>
            <span class="text-slate-700">|</span>
            {#if meetsThreshold}
              <span class="text-[10px] font-semibold text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full border border-blue-500/20">
                Adult Assertion (Verified)
              </span>
            {:else}
              <span class="text-[10px] font-semibold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-full border border-white/5">
                Minor Assertion (Fails Age &ge; 18 Verification)
              </span>
            {/if}
          </div>
        </div>

        <!-- Submit Button -->
        <button
          on:click={runProving}
          class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
        >
          <div class="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <span>Generate ZKP & Verify</span>
          </div>
          <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/identity/zkp-verify</span>
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
        <span class="text-xs font-semibold text-blue-400 font-mono uppercase">ZKP Verification verdict</span>
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

      <!-- Verdict Banner -->
      <div class="p-4 rounded-lg text-center border {result.verified ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}">
        <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">Schnorr Equation Status</div>
        <div class="text-2xl font-extrabold mt-1.5 {result.verified ? 'text-blue-400 text-glow-blue' : 'text-red-400'}">
          {result.verified ? 'VERIFIER_VERDICT: PROVEN_VALID ✓' : 'VERIFIER_VERDICT: PROVEN_INVALID ✗'}
        </div>
        <p class="text-[9px] font-mono text-slate-500 mt-1">
          Formula checked on-curve: s · G == R + c · Y
        </p>
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
