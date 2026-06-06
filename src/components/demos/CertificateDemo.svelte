<script>
  import { fade, fly, scale } from 'svelte/transition';
  import { parseCertificate } from '../../services/api.js';

  // State
  let certificatePem = '';
  let isPending = false;
  let result = null;
  let errorMsg = null;
  let copied = false;

  const sampleCertificatePem = `-----BEGIN CERTIFICATE-----
MIIBuDCCASWgAwIBAgIUFgzA3fehBPKFqwjNFKqyNDCBADAJBgUrDgMCGgUAMDsx
CzAJBgNVBAYTAkVTMREwDwYDVQQKDAhDaXZpY1RlY24bMBkGA1UEAwwSQ2l2aWNU
ZWNoIENpdGl6ZW4wIBcNMjYwMTAxMDAwMDAwWhcNMjkwMTAxMDAwMDAwWjA7MQsw
CQYDVQQGEwJFUzERMA8GA1UECgwoQ2l2aWNUZWNoMRswGQYDVQQDDBJDaXRpemVu
IEp1YW5hIE1hcmthMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3t3r
gM19g4l7mJ6DkZ1FqK9a8V3g1c7e9q1b19a18b9c1d2e3f4a5b6c7d8e9f0a1b2c
3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e
5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a
7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c
9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0==
-----END CERTIFICATE-----`;

  function loadSample() {
    certificatePem = sampleCertificatePem;
    result = null;
    errorMsg = null;
  }

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    isPending = true;
    result = null;
    errorMsg = null;

    try {
      const reader = new FileReader();
      reader.onload = async (event) => {
        certificatePem = event.target.result;
        isPending = false;
      };
      reader.readAsText(file);
    } catch (err) {
      errorMsg = "Failed to read local certificate file.";
      isPending = false;
    }
  }

  async function runParsing() {
    if (!certificatePem.trim()) {
      errorMsg = "Please upload or paste a PEM certificate container.";
      return;
    }

    isPending = true;
    result = null;
    errorMsg = null;

    try {
      const response = await parseCertificate(certificatePem.trim());
      result = response;
    } catch (err) {
      errorMsg = err.message || "Failed to decode certificate. Ensure it is a valid base64 DER or PEM string.";
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
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <div class="space-y-1.5">
        <div class="flex justify-between items-center">
          <label for="certificate-pem-input" class="text-xs font-semibold text-slate-400 font-mono">
            X.509 Certificate (PEM or DER Base64):
          </label>
          <button
            on:click={loadSample}
            class="text-[10px] text-blue-400 hover:text-blue-300 font-semibold font-mono border border-blue-500/20 px-2 py-0.5 rounded bg-blue-500/5 hover:bg-blue-500/10 transition-colors"
          >
            Load Sample Citizen Cert
          </button>
        </div>
        
        <textarea
          id="certificate-pem-input"
          bind:value={certificatePem}
          rows="6"
          class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
          placeholder="Paste PEM container starting with -----BEGIN CERTIFICATE----- ..."
        ></textarea>
      </div>

      <!-- File Drop Option -->
      <label class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-5 cursor-pointer bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center">
        <input type="file" class="hidden" accept=".pem,.crt,.cer,.der" on:change={handleFileSelect} />
        <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-500 mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
        </svg>
        <span class="text-xs text-slate-300 font-semibold">Or upload Certificate File (.pem, .crt, .der)</span>
      </label>

      <!-- Submit -->
      <button
        on:click={runParsing}
        class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
      >
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>Parse Certificate</span>
        </div>
        <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/certificates/parse</span>
      </button>
    </div>
  {:else if isPending}
    <!-- Loading -->
    <div class="flex flex-col items-center justify-center py-10 space-y-4">
      <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
      <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// PARSING_DER_ASN1_STRUCTURE...</div>
    </div>
  {:else if result}
    <!-- Results -->
    <div in:fly={{ y: 15, duration: 300 }} class="space-y-4 font-mono text-[10px]">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-blue-400">CERTIFICATE DECODED & VALIDATED</span>
        <div class="flex gap-2">
          <button
            on:click={() => copyToClipboard(JSON.stringify(result, null, 2))}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
          <button
            on:click={() => { result = null; certificatePem = ''; }}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            Parse Another
          </button>
        </div>
      </div>

      <!-- Certificate info card -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        
        <!-- Identities -->
        <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-2">
          <div>
            <div class="text-slate-500 uppercase font-semibold">Subject DN:</div>
            <div class="text-slate-200 mt-0.5 text-xs font-bold leading-relaxed">{result.subject_dn}</div>
          </div>
          <div class="pt-1 border-t border-white/5">
            <div class="text-slate-500 uppercase font-semibold">Issuer DN:</div>
            <div class="text-slate-300 mt-0.5 leading-relaxed">{result.issuer_dn}</div>
          </div>
        </div>

        <!-- Meta -->
        <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 space-y-2 leading-relaxed">
          <div>
            <span class="text-slate-500 font-semibold uppercase">Serial Number:</span>
            <span class="text-slate-300 font-bold ml-1">{result.serial_number}</span>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase">Signature Cryptography:</span>
            <span class="text-blue-400 font-bold ml-1">{result.signature_algorithm}</span>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase">Trust Signature Status:</span>
            <span class="ml-1 font-bold {result.signature_valid ? 'text-blue-400' : 'text-red-400'}">
              {result.signature_valid ? 'TRUST_VERIFIED ✓' : 'UNTRUSTED ✗'}
            </span>
          </div>
          <div>
            <span class="text-slate-500 font-semibold uppercase">Key Usage Roles:</span>
            <div class="flex flex-wrap gap-1 mt-1 font-sans">
              {#each result.key_usage as usage}
                <span class="text-[9px] font-mono bg-slate-800 border border-white/5 rounded px-1.5 py-0.5 text-slate-300">
                  {usage}
                </span>
              {/each}
            </div>
          </div>
        </div>

      </div>

      <!-- Validity Ranges -->
      <div class="p-3.5 rounded-lg bg-slate-950/60 border border-white/5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 leading-relaxed">
        <div>
          <span class="text-slate-500 font-semibold uppercase">Valid Range:</span>
          <span class="text-slate-300 font-bold ml-1">
            {new Date(result.valid_from).toLocaleDateString()} &mdash; {new Date(result.valid_to).toLocaleDateString()}
          </span>
        </div>
        <div class="flex items-center space-x-2">
          <span class="text-slate-500 font-semibold uppercase">Expiration check:</span>
          {#if result.is_expired}
            <span class="text-red-400 font-bold bg-red-500/10 px-2 py-0.5 rounded border border-red-500/25">
              EXPIRED ✗
            </span>
          {:else}
            <span class="text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/25">
              ACTIVE_VALID ✓
            </span>
          {/if}
        </div>
      </div>

      <!-- Parsing and Signature Validation Trace -->
      <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
        <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400 flex items-center justify-between">
          <span>validation_log_trace.txt</span>
          <span class="text-[9px] text-blue-500 font-bold">X509_ENGINE</span>
        </div>
        <div class="p-3 text-[10px] font-mono text-slate-300 max-h-[140px] overflow-y-auto space-y-1 scrollbar-thin">
          {#each result.validation_log as log}
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
