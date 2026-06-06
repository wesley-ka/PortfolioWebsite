<script>
  import { fade, fly, scale } from 'svelte/transition';
  import { requestTsaTimestamp } from '../../services/api.js';

  // State
  let textPayload = 'I declare intellectual ownership of this source code and cryptographic protocols.';
  let fileChecksum = '';
  let fileName = '';
  let customNonce = '';
  
  let isPending = false;
  let result = null;
  let errorMsg = null;
  let copied = false;

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
      textPayload = ''; // Clear text if file uploaded
    } catch (err) {
      errorMsg = "Failed to calculate file checksum.";
    } finally {
      isPending = false;
    }
  }

  function clearFile() {
    fileName = '';
    fileChecksum = '';
    textPayload = 'I declare intellectual ownership of this source code and cryptographic protocols.';
  }

  async function runTimestamping() {
    isPending = true;
    result = null;
    errorMsg = null;

    try {
      let docHash;
      if (fileChecksum) {
        docHash = fileChecksum;
      } else {
        const buffer = new TextEncoder().encode(textPayload);
        const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        docHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      }

      const response = await requestTsaTimestamp(docHash, customNonce.trim() || null);
      result = response;
    } catch (err) {
      errorMsg = err.message || "Failed to contact TSA for timestamp signing.";
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
    <!-- Input Form -->
    <div in:fade={{ duration: 200 }} class="space-y-4">
      
      {#if !fileName}
        <div class="space-y-1.5">
          <label for="tsa-payload-input" class="text-xs font-semibold text-slate-400 font-mono">Document Content to Seal:</label>
          <textarea
            id="tsa-payload-input"
            bind:value={textPayload}
            rows="3"
            class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
            placeholder="Enter string content to hash and timestamp..."
          ></textarea>
        </div>
      {:else}
        <div class="flex items-center justify-between p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs font-mono text-blue-300">
          <div class="flex items-center space-x-2 truncate">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span class="truncate">{fileName}</span>
          </div>
          <button on:click={clearFile} class="text-slate-400 hover:text-slate-200 hover:underline shrink-0 pl-2">
            Remove File
          </button>
        </div>
      {/if}

      <!-- Upload local file -->
      {#if !fileName}
        <label class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-5 cursor-pointer bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center">
          <input type="file" class="hidden" on:change={handleFileSelect} />
          <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-500 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span class="text-xs text-slate-300 font-semibold">Or upload file to stamp</span>
        </label>
      {/if}

      <!-- Custom Nonce (Optional) -->
      <div class="space-y-1 font-mono text-[10px]">
        <label for="tsa-nonce-input" class="font-semibold text-slate-500 uppercase">Optional Custom Nonce (Hex):</label>
        <input
          id="tsa-nonce-input"
          type="text"
          bind:value={customNonce}
          placeholder="e.g. 03e481bf0d53c2 (leaves blank to let server generate)"
          class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
        />
      </div>

      <!-- Submit -->
      <button
        on:click={runTimestamping}
        class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
      >
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Request Sealed Timestamp</span>
        </div>
        <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/tsa/timestamp</span>
      </button>

    </div>
  {:else if isPending}
    <!-- Loading -->
    <div class="flex flex-col items-center justify-center py-10 space-y-4">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
      <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// SEALING_TIMESTAMP_WITH_TSA_AUTHORITY...</div>
    </div>
  {:else if result}
    <!-- Results -->
    <div in:fly={{ y: 15, duration: 300 }} class="space-y-4 font-mono text-[10px] leading-relaxed">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-blue-400">TIMESTAMP TOKEN SIGNED & SEALED</span>
        <div class="flex gap-2">
          <button
            on:click={() => copyToClipboard(JSON.stringify(result, null, 2))}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
          <button
            on:click={() => { result = null; clearFile(); }}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            Stamp Another
          </button>
        </div>
      </div>

      <!-- Overview Cards -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <div class="text-slate-500 uppercase font-semibold">Atomic Time</div>
          <div class="text-blue-400 font-bold text-xs mt-0.5">
            {new Date(result.timestamp).toLocaleTimeString()}
          </div>
          <div class="text-[9px] text-slate-400 mt-0.5">
            {new Date(result.timestamp).toLocaleDateString()} (UTC)
          </div>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <div class="text-slate-500 uppercase font-semibold">Token Serial</div>
          <div class="text-slate-200 font-bold mt-0.5 truncate">{result.serial_number}</div>
          <div class="text-[9px] text-slate-400 mt-0.5">TSA Record ID</div>
        </div>
        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <div class="text-slate-500 uppercase font-semibold">Nonce</div>
          <div class="text-slate-200 mt-0.5 truncate">{result.nonce}</div>
          <div class="text-[9px] text-slate-400 mt-0.5">RFC 3161 Verification</div>
        </div>
      </div>

      <!-- Hash detail -->
      <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
        <span class="text-slate-500 uppercase font-semibold">Document Hash ({result.hash_algorithm}):</span>
        <span class="text-slate-300 font-bold select-all ml-1">{result.document_hash}</span>
      </div>

      <!-- TSA Public Key Coordinates -->
      <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
        <div class="text-slate-500 uppercase font-semibold">TSA Authority Public Key Coordinates:</div>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[9px] text-slate-400 mt-1">
          <div class="truncate"><span class="text-blue-400 font-bold">X:</span> {result.tsa_public_key_x}</div>
          <div class="truncate"><span class="text-blue-400 font-bold">Y:</span> {result.tsa_public_key_y}</div>
        </div>
      </div>

      <!-- Binary Token Code block -->
      <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
        <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400">
          RFC 3161 DER TimeStampToken (Base64 Binary)
        </div>
        <pre class="text-[9px] font-mono text-slate-400 p-3 overflow-x-auto max-h-[100px] break-all leading-normal"><code>{result.token_base64}</code></pre>
      </div>

    </div>
  {/if}
</div>
