<script>
  import { fade, fly, scale } from 'svelte/transition';
  import { signPayload, verifySignature } from '../../services/api.js';

  // State
  let activeTab = 'sign'; // 'sign' | 'verify'
  let isPending = false;
  let result = null;
  let errorMsg = null;
  let copied = false;

  // Sign Form
  let textPayload = 'Hello, this is a secure CivicTech document payload.';
  let fileChecksum = '';
  let fileName = '';

  // Verify Form (Pre-filled on Sign success)
  let verifyPayload = '';
  let verifyIsHash = false;
  let verifySig = '';
  let verifyPkX = '';
  let verifyPkY = '';
  let verifyResult = null;

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    isPending = true;
    result = null;
    errorMsg = null;
    fileName = file.name;
    
    try {
      const buffer = await file.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      fileChecksum = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      textPayload = ''; // Clear text payload when file is dropped
    } catch (err) {
      errorMsg = "Failed to calculate file checksum.";
    } finally {
      isPending = false;
    }
  }

  function clearFile() {
    fileName = '';
    fileChecksum = '';
    textPayload = 'Hello, this is a secure CivicTech document payload.';
  }

  async function runSigning() {
    isPending = true;
    result = null;
    errorMsg = null;
    try {
      let response;
      if (fileChecksum) {
        response = await signPayload(fileChecksum, null);
      } else {
        const base64Val = btoa(unescape(encodeURIComponent(textPayload)));
        response = await signPayload(null, base64Val);
      }
      
      result = response;
      
      // Auto-prefill the verification form for the user
      verifyPayload = fileChecksum ? fileChecksum : btoa(unescape(encodeURIComponent(textPayload)));
      verifyIsHash = !!fileChecksum;
      verifySig = response.signature;
      verifyPkX = response.public_key_x;
      verifyPkY = response.public_key_y;
      verifyResult = null;
    } catch (err) {
      errorMsg = err.message || "Cryptographic signature generation failed.";
    } finally {
      isPending = false;
    }
  }

  async function runVerification() {
    isPending = true;
    verifyResult = null;
    errorMsg = null;
    try {
      const response = await verifySignature(
        verifyPayload,
        verifyIsHash,
        verifySig,
        verifyPkX,
        verifyPkY
      );
      verifyResult = response;
    } catch (err) {
      errorMsg = err.message || "Signature verification request failed.";
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
  <!-- Internal Tabs -->
  <div class="flex border-b border-white/5 pb-0.5">
    <button
      class="px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'sign' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'sign'; errorMsg = null; }}
    >
      Generate Signature (ECDSA)
    </button>
    <button
      class="px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'verify' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'verify'; errorMsg = null; }}
    >
      Verify Signature
    </button>
  </div>

  <!-- Error Alerts -->
  {#if errorMsg}
    <div in:scale={{duration: 200}} class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
      [ERROR] {errorMsg}
    </div>
  {/if}

  <!-- TAB 1: GENERATE SIGNATURE -->
  {#if activeTab === 'sign'}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      {#if !isPending && !result}
        <div class="space-y-4">
          <!-- Text Payload Area -->
          {#if !fileName}
            <div class="space-y-1.5">
              <label for="sign-payload-input" class="text-xs font-semibold text-slate-400 font-mono">Payload to Sign:</label>
              <textarea
                id="sign-payload-input"
                bind:value={textPayload}
                rows="3"
                class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
                placeholder="Enter string payload to encode and sign..."
              ></textarea>
            </div>
          {:else}
            <!-- File Badge -->
            <div class="flex items-center justify-between p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs font-mono text-blue-300">
              <div class="flex items-center space-x-2 truncate">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span class="truncate">{fileName}</span>
              </div>
              <button on:click={clearFile} class="text-slate-400 hover:text-slate-200 hover:underline shrink-0 pl-2">
                Remove File
              </button>
            </div>
            <div class="text-[10px] font-mono text-slate-500 pl-1">
              Calculated SHA-256 Checksum: <span class="text-slate-400">{fileChecksum.substring(0, 16)}...{fileChecksum.substring(48)}</span>
            </div>
          {/if}

          <!-- Or Drag Drop area -->
          {#if !fileName}
            <label class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-6 cursor-pointer bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center">
              <input type="file" class="hidden" on:change={handleFileSelect} />
              <svg xmlns="http://www.w3.org/2000/svg" class="h-7 w-7 text-slate-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              <span class="text-xs text-slate-300 font-semibold">Optionally Upload File to hash</span>
              <span class="text-[10px] text-slate-500 mt-0.5">SHA-256 checksum is generated locally</span>
            </label>
          {/if}

          <!-- Submit Button -->
          <button
            on:click={runSigning}
            class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
          >
            <div class="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span>Run Sign</span>
            </div>
            <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/signing/sign</span>
          </button>
        </div>
      {:else if isPending}
        <!-- Loading -->
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
          <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// CONTACTING_SIGNING_AUTHORITY...</div>
        </div>
      {:else if result}
        <!-- Sign Result -->
        <div in:fly={{ y: 15, duration: 300 }} class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-blue-400 font-mono">SUCCESS: SIGNATURE GENERATED</span>
            <div class="flex gap-2">
              <button
                on:click={() => copyToClipboard(JSON.stringify(result, null, 2))}
                class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                {copied ? 'Copied ✓' : 'Copy Response JSON'}
              </button>
              <button
                on:click={() => { result = null; clearFile(); }}
                class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                Sign Again
              </button>
            </div>
          </div>

          <!-- Highlight Coordinates -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3 font-mono text-[10px]">
            <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
              <div class="text-slate-500">Public Key X (Affine Coordinate)</div>
              <div class="text-slate-300 truncate mt-0.5">{result.public_key_x}</div>
            </div>
            <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
              <div class="text-slate-500">Public Key Y (Affine Coordinate)</div>
              <div class="text-slate-300 truncate mt-0.5">{result.public_key_y}</div>
            </div>
          </div>

          <!-- Response JSON Code block -->
          <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
            <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400">Response Payload</div>
            <pre class="text-[10px] font-mono text-slate-300 p-3 overflow-x-auto max-h-[140px] leading-relaxed"><code>{JSON.stringify(result, null, 2)}</code></pre>
          </div>

          <div class="flex justify-end pt-1">
            <button
              on:click={() => { activeTab = 'verify'; }}
              class="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>Verify This Signature Now</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- TAB 2: VERIFY SIGNATURE -->
  {#if activeTab === 'verify'}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      {#if !isPending && !verifyResult}
        <div class="space-y-3 font-mono text-[10px]">
          <!-- Payload Field -->
          <div class="space-y-1">
            <label for="verify-payload-input" class="font-semibold text-slate-500 uppercase">Original Payload (Base64 or Checksum Hex):</label>
            <input
              id="verify-payload-input"
              type="text"
              bind:value={verifyPayload}
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40"
            />
          </div>

          <!-- Payload Is Hash Checkbox -->
          <div class="flex items-center space-x-2 py-0.5">
            <input
              id="payload-is-hash"
              type="checkbox"
              bind:checked={verifyIsHash}
              class="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0"
            />
            <label for="payload-is-hash" class="font-semibold text-slate-400 select-none cursor-pointer">
              Payload is SHA-256 Checksum (rather than raw data)
            </label>
          </div>

          <!-- Signature Field -->
          <div class="space-y-1">
            <label for="verify-sig-input" class="font-semibold text-slate-500 uppercase">Signature (Base64 DER):</label>
            <input
              id="verify-sig-input"
              type="text"
              bind:value={verifySig}
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
            />
          </div>

          <!-- coordinates -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label for="verify-pkx-input" class="font-semibold text-slate-500 uppercase">Public Key Coordinate X:</label>
              <input
                id="verify-pkx-input"
                type="text"
                bind:value={verifyPkX}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
              />
            </div>
            <div class="space-y-1">
              <label for="verify-pky-input" class="font-semibold text-slate-500 uppercase">Public Key Coordinate Y:</label>
              <input
                id="verify-pky-input"
                type="text"
                bind:value={verifyPkY}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          <!-- Submit Button -->
          <button
            on:click={runVerification}
            class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5 mt-3"
          >
            <div class="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>Verify Signature</span>
            </div>
            <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/signing/verify</span>
          </button>
        </div>
      {:else if isPending}
        <!-- Loading -->
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
          <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// RECONSTRUCTING_ECC_KEY_AND_VERIFYING...</div>
        </div>
      {:else if verifyResult}
        <!-- Result -->
        <div in:fly={{ y: 15, duration: 300 }} class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-blue-400 font-mono">VERIFICATION RESPONSE</span>
            <button
              on:click={() => verifyResult = null}
              class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
            >
              Verify Again
            </button>
          </div>

          <!-- Verdict visualizer -->
          <div class="p-5 rounded-lg text-center border {verifyResult.valid ? 'bg-blue-500/10 border-blue-500/20' : 'bg-red-500/10 border-red-500/20'}">
            <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">Signature Verification Verdict</div>
            <div class="text-3xl font-extrabold tracking-tight mt-2 {verifyResult.valid ? 'text-blue-400 text-glow-blue' : 'text-red-400'}">
              {verifyResult.valid ? 'SIGNATURE_VALID ✓' : 'SIGNATURE_INVALID ✗'}
            </div>
            <div class="text-[10px] font-mono text-slate-500 mt-2">
              Issuer: {verifyResult.issuer} • Checked at: {new Date(verifyResult.timestamp).toLocaleTimeString()}
            </div>
          </div>

          <!-- Code block -->
          <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
            <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400">Response Payload</div>
            <pre class="text-[10px] font-mono text-slate-300 p-3 overflow-x-auto max-h-[140px]"><code>{JSON.stringify(verifyResult, null, 2)}</code></pre>
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
