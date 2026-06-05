<script>
  import { fade, fly, scale } from 'svelte/transition';
  import { encryptVaultData, decryptVaultData, logAuditTrail, getMockLedger } from '../../services/api.js';

  // State
  let activeTab = 'encrypt'; // 'encrypt' | 'decrypt' | 'audit'
  let isPending = false;
  let errorMsg = null;
  let copied = false;

  // Encrypt Form
  let sensitiveJson = JSON.stringify({
    citizen_id: "ES-A8492048G",
    full_name: "Juana María de Todos los Santos",
    issuance_date: "2026-01-15",
    status: "ACTIVE_CITIZEN",
    security_clearance: "LEVEL_3"
  }, null, 2);
  let encryptResult = null;

  // Decrypt Form
  let decryptCipher = '';
  let decryptIv = '';
  let decryptTag = '';
  let decryptResult = null;

  // Audit Form
  let logEntry = 'CITIZEN_RECORD_ACCESSED';
  let auditBlocks = getMockLedger(); // Init with genesis block
  let lastLoggedBlock = null;

  async function runEncryption() {
    isPending = true;
    encryptResult = null;
    errorMsg = null;
    try {
      let sensitiveData;
      try {
        sensitiveData = JSON.parse(sensitiveJson);
      } catch (e) {
        throw new Error("Invalid JSON input. Please format correctly.");
      }
      
      const response = await encryptVaultData(sensitiveData);
      encryptResult = response;
      
      // Prefill decrypt form
      decryptCipher = response.ciphertext;
      decryptIv = response.iv;
      decryptTag = response.auth_tag;
      decryptResult = null;
    } catch (err) {
      errorMsg = err.message || "Encryption failed.";
    } finally {
      isPending = false;
    }
  }

  async function runDecryption() {
    isPending = true;
    decryptResult = null;
    errorMsg = null;
    try {
      const response = await decryptVaultData(decryptCipher, decryptIv, decryptTag);
      decryptResult = response;
    } catch (err) {
      errorMsg = err.message || "Decryption failed. GCM authentication tag check may have failed.";
    } finally {
      isPending = false;
    }
  }

  async function runAuditLogging() {
    if (!logEntry.trim()) return;
    isPending = true;
    errorMsg = null;
    try {
      const response = await logAuditTrail(logEntry.trim());
      lastLoggedBlock = response;
      auditBlocks = getMockLedger();
    } catch (err) {
      errorMsg = err.message || "Failed to log event block to blockchain ledger.";
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
      class="px-3 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'encrypt' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'encrypt'; errorMsg = null; }}
    >
      Encrypt (AES-GCM)
    </button>
    <button
      class="px-3 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'decrypt' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'decrypt'; errorMsg = null; }}
    >
      Decrypt
    </button>
    <button
      class="px-3 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'audit' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'audit'; errorMsg = null; }}
    >
      Audit Trail (DLT Chain)
    </button>
  </div>

  <!-- Error Alerts -->
  {#if errorMsg}
    <div in:scale={{duration: 200}} class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
      [ERROR] {errorMsg}
    </div>
  {/if}

  <!-- TAB 1: ENCRYPT -->
  {#if activeTab === 'encrypt'}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      {#if !isPending && !encryptResult}
        <div class="space-y-3">
          <div class="space-y-1">
            <label for="sensitive-json-input" class="text-xs font-semibold text-slate-400 font-mono">Sensitive Data JSON Map:</label>
            <textarea
              id="sensitive-json-input"
              bind:value={sensitiveJson}
              rows="5"
              class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-3 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 resize-none font-mono"
            ></textarea>
          </div>
          
          <button
            on:click={runEncryption}
            class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue"
          >
            Encrypt Payload (POST /v1/vault/encrypt)
          </button>
        </div>
      {:else if isPending}
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
          <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// AES_256_GCM_ENCRYPTION_UNDERWAY...</div>
        </div>
      {:else if encryptResult}
        <div in:fly={{ y: 15, duration: 300 }} class="space-y-4 font-mono text-[10px]">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-blue-400">ENCRYPTION COMPLETED</span>
            <div class="flex gap-2">
              <button
                on:click={() => copyToClipboard(JSON.stringify(encryptResult, null, 2))}
                class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                {copied ? 'Copied ✓' : 'Copy JSON'}
              </button>
              <button
                on:click={() => encryptResult = null}
                class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
              >
                Encrypt Again
              </button>
            </div>
          </div>

          <!-- Highlight results -->
          <div class="space-y-2.5">
            <div class="p-2.5 rounded bg-slate-950/60 border border-white/5">
              <div class="text-slate-500 uppercase font-semibold">Ciphertext (Base64):</div>
              <div class="text-slate-300 select-all break-all mt-0.5">{encryptResult.ciphertext}</div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div class="p-2.5 rounded bg-slate-950/60 border border-white/5">
                <div class="text-slate-500 uppercase font-semibold">IV (12 Bytes Base64):</div>
                <div class="text-slate-300 mt-0.5">{encryptResult.iv}</div>
              </div>
              <div class="p-2.5 rounded bg-slate-950/60 border border-white/5">
                <div class="text-slate-500 uppercase font-semibold">Auth Tag (16 Bytes Base64):</div>
                <div class="text-blue-400 mt-0.5">{encryptResult.auth_tag}</div>
              </div>
            </div>
          </div>

          <div class="flex justify-end pt-1">
            <button
              on:click={() => activeTab = 'decrypt'}
              class="px-3 py-1.5 bg-blue-500/10 hover:bg-blue-500/25 border border-blue-500/30 text-blue-300 text-xs font-semibold rounded-lg transition-colors flex items-center space-x-1"
            >
              <span>Test Decryption Payload</span>
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- TAB 2: DECRYPT -->
  {#if activeTab === 'decrypt'}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      {#if !isPending && !decryptResult}
        <div class="space-y-3 font-mono text-[10px]">
          <div class="space-y-1">
            <label for="decrypt-cipher-input" class="font-semibold text-slate-500 uppercase">Ciphertext (Base64):</label>
            <textarea
              id="decrypt-cipher-input"
              bind:value={decryptCipher}
              rows="2"
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
            ></textarea>
          </div>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="space-y-1">
              <label for="decrypt-iv-input" class="font-semibold text-slate-500 uppercase">IV (Base64):</label>
              <input
                id="decrypt-iv-input"
                type="text"
                bind:value={decryptIv}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
              />
            </div>
            <div class="space-y-1">
              <label for="decrypt-tag-input" class="font-semibold text-slate-500 uppercase">Authentication Tag (Base64):</label>
              <input
                id="decrypt-tag-input"
                type="text"
                bind:value={decryptTag}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none"
              />
            </div>
          </div>

          <button
            on:click={runDecryption}
            class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 mt-2"
          >
            Decrypt Payload (POST /v1/vault/decrypt)
          </button>
        </div>
      {:else if isPending}
        <div class="flex flex-col items-center justify-center py-10 space-y-4">
          <div class="animate-spin rounded-full h-10 w-10 border-2 border-blue-500/20 border-t-blue-400"></div>
          <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">// RECONSTRUCTING_AES_KEY_AND_AUTHENTICATING...</div>
        </div>
      {:else if decryptResult}
        <div in:fly={{ y: 15, duration: 300 }} class="space-y-4">
          <div class="flex items-center justify-between">
            <span class="text-xs font-semibold text-blue-400 font-mono">DECRYPTION SUCCESSFUL</span>
            <button
              on:click={() => decryptResult = null}
              class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
            >
              Decrypt Another
            </button>
          </div>

          <div class="relative rounded-lg border border-white/10 overflow-hidden bg-slate-950">
            <div class="px-3 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-mono text-slate-400">Decrypted JSON Data</div>
            <pre class="text-[10px] font-mono text-slate-300 p-3 overflow-x-auto max-h-[160px] leading-relaxed"><code>{JSON.stringify(decryptResult.decrypted_data, null, 2)}</code></pre>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- TAB 3: AUDIT LOG -->
  {#if activeTab === 'audit'}
    <div in:fade={{ duration: 200 }} class="space-y-4">
      <div class="grid grid-cols-1 md:grid-cols-12 gap-5">
        
        <!-- Log event form -->
        <div class="md:col-span-5 space-y-3 font-mono text-[10px]">
          <div class="space-y-1">
            <label for="audit-message-input" class="font-semibold text-slate-500 uppercase">Audit Log Message:</label>
            <input
              id="audit-message-input"
              type="text"
              bind:value={logEntry}
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-300 focus:outline-none focus:border-blue-500/40"
              placeholder="e.g. RECORD_ACCESSED"
            />
          </div>
          
          <button
            on:click={runAuditLogging}
            class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20"
          >
            Append Log (POST /v1/vault/audit)
          </button>
          
          {#if lastLoggedBlock}
            <div in:scale={{duration: 200}} class="p-3 rounded bg-blue-500/5 border border-blue-500/20 space-y-1">
              <div class="text-[9px] text-blue-400 font-bold uppercase">Block Added Successfully!</div>
              <div>Block Index: <span class="text-slate-300 font-bold">#{lastLoggedBlock.index}</span></div>
              <div class="truncate">Hash: <span class="text-slate-400">{lastLoggedBlock.block_hash}</span></div>
            </div>
          {/if}
        </div>

        <!-- Ledger timeline -->
        <div class="md:col-span-7 space-y-3">
          <div class="text-[10px] font-mono text-slate-400 font-semibold uppercase tracking-wider flex justify-between">
            <span>Merkle Chain Audit Ledger</span>
            <span class="text-blue-400 font-bold">Blocks: {auditBlocks.length}</span>
          </div>

          <!-- Chain visualizer -->
          <div class="max-h-[200px] overflow-y-auto space-y-3.5 pr-2 scrollbar-thin">
            {#each auditBlocks.slice().reverse() as block (block.index)}
              <div in:fly={{ y: -10, duration: 250 }} class="relative p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1 font-mono text-[9px] shadow-glass-sm group hover:border-blue-500/30 transition-colors">
                <!-- Glowing node status -->
                <span class="absolute top-3 right-3 flex h-2 w-2">
                  <span class="relative inline-flex rounded-full h-2 w-2 {block.index === 0 ? 'bg-slate-500' : 'bg-blue-500'}"></span>
                </span>

                <div class="flex items-center space-x-1.5">
                  <span class="font-bold text-slate-300">BLOCK #{block.index}</span>
                  <span class="text-slate-600">|</span>
                  <span class="text-blue-400 font-bold truncate max-w-[140px]">{block.log_entry}</span>
                </div>
                <div class="text-[8px] text-slate-500">Timestamp: {new Date(block.timestamp).toLocaleTimeString()}</div>
                <div class="grid grid-cols-1 gap-0.5 text-[8px] text-slate-400 pt-1 border-t border-white/5 mt-1">
                  <div class="truncate"><span class="text-slate-500">Hash:</span> {block.block_hash}</div>
                  <div class="truncate"><span class="text-slate-500">Prev:</span> {block.previous_hash}</div>
                  <div class="truncate"><span class="text-slate-500">Root:</span> {block.merkle_root}</div>
                </div>
              </div>
            {/each}
          </div>
        </div>

      </div>
    </div>
  {/if}
</div>
