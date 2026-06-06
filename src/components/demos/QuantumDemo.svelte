<script>
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { 
    generateQuantumKeypair, 
    encryptQuantumMessage, 
    decryptQuantumMessage 
  } from '../../services/api.js';

  // Navigation states: 'encrypt' | 'decrypt' | 'keygen'
  let activeSubTab = 'encrypt';

  // Encryption states
  let recipientPublicKey = '';
  let messageText = '';
  let encryptedPayload = null;
  let generatedLink = '';
  let encryptCopied = false;
  let encryptPending = false;

  // Decryption states
  let incomingPayload = null;
  let privateKeyToDecrypt = '';
  let decryptedMessageText = '';
  let decryptionResult = null;
  let decryptionCopied = false;
  let decryptPending = false;
  let rawPayloadInput = '';

  // Keypair manager states
  let generatedPublicKey = '';
  let generatedPrivateKey = '';
  let generatedShareLink = '';
  let keysGenerated = false;
  let keygenPending = false;
  let keypairCopied = false;

  // General error message
  let errorMsg = null;
  let successMsg = null;

  const payloadPlaceholder = 'Paste the encrypted JSON payload here:\n{\n  "kem_ciphertext": "...",\n  "iv": "...",\n  "encrypted_message": "..."\n}';

  onMount(() => {
    handleUrlRouting();
  });

  // Handle URL parsing on mount
  function handleUrlRouting() {
    try {
      errorMsg = null;
      
      // 1. Check if we have public key parameters in the query string (e.g. ?action=encrypt&pk=...)
      const params = new URLSearchParams(window.location.search);
      if (params.get('action') === 'encrypt') {
        const pk = params.get('pk');
        if (pk) {
          recipientPublicKey = pk;
          activeSubTab = 'encrypt';
          successMsg = "Loaded recipient's ML-KEM public key from link!";
          setTimeout(() => successMsg = null, 4000);
          return;
        }
      }

      // 2. Check if we have an encrypted payload in the URL hash (e.g. #payload=...)
      if (window.location.hash) {
        const hash = window.location.hash.substring(1); // remove '#'
        const hashParams = new URLSearchParams(hash);
        const payloadB64 = hashParams.get('payload');
        
        if (payloadB64) {
          // Decode URL-safe Base64 to JSON
          const cleanedB64 = payloadB64.replace(/-/g, '+').replace(/_/g, '/');
          const jsonStr = atob(cleanedB64);
          incomingPayload = JSON.parse(jsonStr);
          rawPayloadInput = JSON.stringify(incomingPayload, null, 2);
          
          activeSubTab = 'decrypt';
          
          // Check if private key was also bundled (Self-Decrypting mode)
          const skB64 = hashParams.get('sk');
          if (skB64) {
            privateKeyToDecrypt = skB64;
            successMsg = "Loaded encrypted payload and private key! Ready to decrypt.";
          } else {
            successMsg = "Loaded encrypted payload! Please input your private key to decrypt.";
          }
          setTimeout(() => successMsg = null, 4000);
        }
      }
    } catch (e) {
      console.error("[PQC Router] Failed to parse URL parameters:", e);
      errorMsg = "Malformed secure link. Failed to load encrypted payload or keys.";
    }
  }

  // Key Pair Generation
  async function handleKeypairGeneration() {
    keygenPending = true;
    errorMsg = null;
    keysGenerated = false;
    
    try {
      const keys = await generateQuantumKeypair();
      generatedPublicKey = keys.publicKey;
      generatedPrivateKey = keys.privateKey;
      
      // Build shareable encryption link for recipient
      generatedShareLink = `${window.location.origin}${window.location.pathname}?action=encrypt&pk=${keys.publicKey}`;
      keysGenerated = true;
    } catch (err) {
      errorMsg = err.message || "Failed to generate post-quantum keypair.";
    } finally {
      keygenPending = false;
    }
  }

  // Encrypt Message Flow
  async function handleEncryption() {
    if (!recipientPublicKey.trim()) {
      errorMsg = "Please input the Recipient's ML-KEM-768 Public Key.";
      return;
    }
    if (!messageText.trim()) {
      errorMsg = "Please enter a message to encrypt.";
      return;
    }

    encryptPending = true;
    errorMsg = null;
    encryptedPayload = null;
    generatedLink = '';

    try {
      // Execute hybrid encryption via API wrapper (uses Web Crypto + ML-KEM-768 local fallback)
      const payload = await encryptQuantumMessage(recipientPublicKey.trim(), messageText.trim());
      encryptedPayload = payload;

      // Pack ciphertext JSON into URL hash fragment
      const payloadJson = JSON.stringify(payload);
      const payloadB64 = btoa(payloadJson)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      generatedLink = `${window.location.origin}${window.location.pathname}#payload=${payloadB64}`;
    } catch (err) {
      errorMsg = err.message || "Encryption failed. Ensure the public key is a valid ML-KEM-768 Base64URL string.";
    } finally {
      encryptPending = false;
    }
  }

  // Frictionless Self-Decrypting Link Generation
  async function handleSelfDecryptingLink() {
    if (!messageText.trim()) {
      errorMsg = "Please enter a message to encrypt.";
      return;
    }

    encryptPending = true;
    errorMsg = null;
    encryptedPayload = null;
    generatedLink = '';

    try {
      // 1. Generate ephemeral key pair
      const keys = await generateQuantumKeypair();
      
      // 2. Encrypt using the ephemeral public key
      const payload = await encryptQuantumMessage(keys.publicKey, messageText.trim());
      encryptedPayload = payload;

      // 3. Serialize payload and bundle private key in the hash
      const payloadJson = JSON.stringify(payload);
      const payloadB64 = btoa(payloadJson)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
      
      generatedLink = `${window.location.origin}${window.location.pathname}#payload=${payloadB64}&sk=${keys.privateKey}`;
    } catch (err) {
      errorMsg = err.message || "Failed to generate self-decrypting link.";
    } finally {
      encryptPending = false;
    }
  }

  // Decrypt Message Flow
  async function handleDecryption() {
    let payloadToDecrypt = incomingPayload;

    if (!payloadToDecrypt) {
      if (!rawPayloadInput.trim()) {
        errorMsg = "No encrypted message payload detected. Please enter it manually or click a secure link.";
        return;
      }
      try {
        payloadToDecrypt = JSON.parse(rawPayloadInput.trim());
      } catch (e) {
        errorMsg = "Invalid payload JSON format. Ensure you pasted the correct encrypted payload.";
        return;
      }
    }

    if (!privateKeyToDecrypt.trim()) {
      errorMsg = "Private key is required to decapsulate the shared secret and decrypt.";
      return;
    }

    decryptPending = true;
    errorMsg = null;
    decryptionResult = null;
    decryptedMessageText = '';

    try {
      const result = await decryptQuantumMessage(privateKeyToDecrypt.trim(), payloadToDecrypt);
      decryptionResult = result;
      decryptedMessageText = result.decrypted_text;
    } catch (err) {
      errorMsg = err.message || "Decryption failed. The private key may be incorrect or the ciphertext has been altered.";
    } finally {
      decryptPending = false;
    }
  }

  // Clipboard copy utilities
  let publicKeyCopied = false;
  let privateKeyCopied = false;
  let shareLinkCopied = false;
  let encryptLinkCopied = false;
  let fullKeyPairCopied = false;

  async function copyText(text, flagStore) {
    try {
      await navigator.clipboard.writeText(text);
      if (flagStore === 'pubkey') {
        publicKeyCopied = true;
        setTimeout(() => publicKeyCopied = false, 2000);
      } else if (flagStore === 'privkey') {
        privateKeyCopied = true;
        setTimeout(() => privateKeyCopied = false, 2000);
      } else if (flagStore === 'sharelink') {
        shareLinkCopied = true;
        setTimeout(() => shareLinkCopied = false, 2000);
      } else if (flagStore === 'encryptlink') {
        encryptLinkCopied = true;
        setTimeout(() => encryptLinkCopied = false, 2000);
      } else if (flagStore === 'decrypt') {
        decryptionCopied = true;
        setTimeout(() => decryptionCopied = false, 2000);
      } else if (flagStore === 'keypair') {
        fullKeyPairCopied = true;
        setTimeout(() => fullKeyPairCopied = false, 2000);
      }
    } catch (err) {
      console.error("Clipboard copy failed:", err);
    }
  }

  // Reset decryption view to handle new input
  function resetDecryption() {
    incomingPayload = null;
    privateKeyToDecrypt = '';
    decryptedMessageText = '';
    decryptionResult = null;
    rawPayloadInput = '';
    window.location.hash = '';
  }
</script>

<div class="space-y-6 text-slate-200">
  
  <!-- Sub-tab Navigation (Glassmorphic pill switcher) -->
  <div class="flex p-1 rounded-xl bg-slate-950/40 border border-white/5 max-w-md">
    <button
      on:click={() => { activeSubTab = 'encrypt'; errorMsg = null; }}
      class="flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider transition-all {activeSubTab === 'encrypt' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20 shadow-glass-sm' : 'bg-transparent text-slate-400 hover:text-slate-200'}"
    >
      ENCRYPT MESSAGE
    </button>
    <button
      on:click={() => { activeSubTab = 'decrypt'; errorMsg = null; }}
      class="flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider transition-all {activeSubTab === 'decrypt' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20 shadow-glass-sm' : 'bg-transparent text-slate-400 hover:text-slate-200'}"
    >
      DECRYPT MESSAGE
    </button>
    <button
      on:click={() => { activeSubTab = 'keygen'; errorMsg = null; }}
      class="flex-1 py-1.5 rounded-lg text-[10px] font-bold font-mono tracking-wider transition-all {activeSubTab === 'keygen' ? 'bg-blue-500/15 text-blue-300 border border-blue-500/20 shadow-glass-sm' : 'bg-transparent text-slate-400 hover:text-slate-200'}"
    >
      KEY MANAGER
    </button>
  </div>

  <!-- Error & Success Banners -->
  {#if errorMsg}
    <div in:fade={{ duration: 150 }} class="p-3.5 rounded-lg bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
      [ERROR] {errorMsg}
    </div>
  {/if}
  {#if successMsg}
    <div in:fade={{ duration: 150 }} class="p-3.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-xs text-blue-400 font-mono">
      [SYSTEM] {successMsg}
    </div>
  {/if}

  <!-- TAB 1: ENCRYPT & SHARE -->
  {#if activeSubTab === 'encrypt'}
    <div in:fade={{ duration: 150 }} class="space-y-4">
      <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
        
        <!-- Recipient Public Key Input -->
        <div class="space-y-2">
          <label for="quantum-pk-input" class="text-[10px] font-bold text-slate-400 font-mono block uppercase">
            Recipient Public Key (ML-KEM-768 ek):
          </label>
          <textarea
            id="quantum-pk-input"
            bind:value={recipientPublicKey}
            placeholder="Paste recipient's Base64URL encoded public key here (1184 bytes)..."
            rows="3"
            class="w-full p-2.5 rounded-lg bg-slate-950/60 border border-white/5 focus:border-blue-500/40 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none resize-none transition-colors"
          ></textarea>
        </div>

        <!-- Secret Message Input -->
        <div class="space-y-2">
          <label for="quantum-message-input" class="text-[10px] font-bold text-slate-400 font-mono block uppercase">
            Secret Message (Plaintext):
          </label>
          <textarea
            id="quantum-message-input"
            bind:value={messageText}
            placeholder="Type the message you want to encrypt and share securely..."
            rows="3"
            class="w-full p-2.5 rounded-lg bg-slate-950/60 border border-white/5 focus:border-blue-500/40 text-xs text-slate-200 placeholder-slate-600 focus:outline-none resize-none transition-colors"
          ></textarea>
        </div>

        <!-- Action Button Panel -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
          <!-- Normal Asymmetric Encryption -->
          <button
            on:click={handleEncryption}
            disabled={encryptPending}
            class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-100 transition-all duration-300 border border-blue-500/20 hover:shadow-glow-blue flex flex-col items-center justify-center"
          >
            {#if encryptPending}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
            {:else}
              <span class="font-bold">Encrypt (Asymmetric)</span>
              <span class="text-[8px] font-mono text-blue-300 font-normal">Encapsulate shared key via Recipient's PK</span>
            {/if}
          </button>

          <!-- Frictionless Self-Decrypting Link -->
          <button
            on:click={handleSelfDecryptingLink}
            disabled={encryptPending}
            class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-100 transition-all duration-300 border border-white/10 hover:shadow-glass flex flex-col items-center justify-center"
          >
            {#if encryptPending}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
            {:else}
              <span class="font-bold">Generate Self-Decrypting Link</span>
              <span class="text-[8px] font-mono text-slate-400 font-normal">Bundles ephemeral private key in URL hash</span>
            {/if}
          </button>
        </div>

      </div>

      <!-- Encryption Result Panel -->
      {#if encryptedPayload && generatedLink}
        <div in:fly={{ y: 15, duration: 250 }} class="p-4 rounded-xl bg-slate-950/60 border border-blue-500/10 space-y-4">
          <div class="flex justify-between items-center border-b border-white/5 pb-2">
            <span class="text-[10px] font-bold text-blue-400 font-mono uppercase">MESSAGE ENCRYPTED SUCCESSFULLY!</span>
            <span class="text-[8px] font-mono bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded text-blue-300">
              {encryptedPayload.algorithm}
            </span>
          </div>

          <!-- Share Link output -->
          <div class="space-y-2">
            <span class="text-[9px] font-semibold font-mono text-slate-500 block">SHAREABLE SECURE LINK:</span>
            <div class="relative">
              <input
                type="text"
                readonly
                value={generatedLink}
                class="w-full p-2.5 pr-12 rounded bg-slate-900 border border-white/5 text-[10px] font-mono text-slate-300 select-all focus:outline-none truncate"
              />
              <button
                on:click={() => copyText(generatedLink, 'encryptlink')}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer shadow-glass-sm"
                title="Copy Link"
              >
                {#if encryptLinkCopied}
                  <span class="text-[8px] font-mono font-bold text-blue-400 px-1">Copied!</span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                {/if}
              </button>
            </div>
            <p class="text-[9px] text-slate-500 leading-normal">
              ★ Pass this URL to the recipient. The payload is in the URL hash and will not be sent to the web host.
            </p>
          </div>

          <!-- Cryptographic Details -->
          <div class="p-3 rounded bg-slate-900/60 border border-white/5 space-y-2 text-[9px] font-mono text-slate-400">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <span class="text-slate-500 block font-bold">KEM Ciphertext:</span>
                {encryptedPayload.kem_ciphertext.substring(0, 16)}... ({encryptedPayload.kem_ciphertext.length} chars)
              </div>
              <div>
                <span class="text-slate-500 block font-bold">AES-GCM IV (12B):</span>
                {encryptedPayload.iv}
              </div>
              <div>
                <span class="text-slate-500 block font-bold">Derived Key Hash:</span>
                {encryptedPayload.shared_secret_hash.substring(0, 16)}...
              </div>
            </div>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- TAB 2: DECRYPT & READ -->
  {#if activeSubTab === 'decrypt'}
    <div in:fade={{ duration: 150 }} class="space-y-4">
      
      <!-- Scenario A: Payload loaded from URL hash -->
      {#if incomingPayload}
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div class="flex justify-between items-center border-b border-white/5 pb-2">
            <div class="flex items-center space-x-2">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span class="text-[10px] font-bold text-blue-400 font-mono uppercase">Encrypted Message Detected</span>
            </div>
            <button
              on:click={resetDecryption}
              class="text-[9px] font-mono text-slate-500 hover:text-slate-300"
            >
              Clear Payload [X]
            </button>
          </div>

          <!-- Private Key Input -->
          <div class="space-y-2">
            <label for="quantum-sk-decrypt" class="text-[10px] font-bold text-slate-400 font-mono block uppercase">
              Recipient Private Key (ML-KEM-768 dk):
            </label>
            <textarea
              id="quantum-sk-decrypt"
              bind:value={privateKeyToDecrypt}
              placeholder="Paste your 2400-byte private key here..."
              rows="4"
              class="w-full p-2.5 rounded-lg bg-slate-950/60 border border-white/5 focus:border-blue-500/40 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none resize-none transition-colors"
            ></textarea>
            {#if window.location.hash.includes('sk=')}
              <p class="text-[9px] text-blue-400/80 font-mono">
                ✓ Ephemeral private key was auto-loaded from the self-decrypting link.
              </p>
            {/if}
          </div>

          <!-- Decrypt Button -->
          <button
            on:click={handleDecryption}
            disabled={decryptPending}
            class="w-full py-2.5 rounded-lg font-bold text-xs tracking-wider bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-100 transition-all duration-300 border border-blue-500/20 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
          >
            {#if decryptPending}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
            {:else}
              <span>Decrypt & Decapsulate Message</span>
              <span class="text-[8px] font-mono text-blue-300 font-normal">POST /v1/quantum/decrypt</span>
            {/if}
          </button>
        </div>

      <!-- Scenario B: No payload in URL, paste manually -->
      {:else}
        <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
          <div class="space-y-2">
            <label for="quantum-raw-payload" class="text-[10px] font-bold text-slate-400 font-mono block uppercase">
              Encrypted Payload JSON:
            </label>
            <textarea
              id="quantum-raw-payload"
              bind:value={rawPayloadInput}
              placeholder={payloadPlaceholder}
              rows="4"
              class="w-full p-2.5 rounded-lg bg-slate-950/60 border border-white/5 focus:border-blue-500/40 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none resize-none transition-colors"
            ></textarea>
          </div>

          <div class="space-y-2">
            <label for="quantum-sk-raw" class="text-[10px] font-bold text-slate-400 font-mono block uppercase">
              Private Key (dk):
            </label>
            <textarea
              id="quantum-sk-raw"
              bind:value={privateKeyToDecrypt}
              placeholder="Paste your 2400-byte private key to decrypt..."
              rows="3"
              class="w-full p-2.5 rounded-lg bg-slate-950/60 border border-white/5 focus:border-blue-500/40 text-xs font-mono text-slate-300 placeholder-slate-600 focus:outline-none resize-none transition-colors"
            ></textarea>
          </div>

          <button
            on:click={handleDecryption}
            disabled={decryptPending}
            class="w-full py-2.5 rounded-lg font-bold text-xs tracking-wider bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-100 transition-all duration-300 border border-blue-500/20 hover:shadow-glow-blue flex items-center justify-center"
          >
            {#if decryptPending}
              <div class="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
            {:else}
              <span>Decrypt Manual Payload</span>
            {/if}
          </button>
        </div>
      {/if}

      <!-- Decryption Result Panel -->
      {#if decryptionResult}
        <div in:fly={{ y: 15, duration: 250 }} class="space-y-4">
          <div class="p-4 rounded-xl bg-slate-950/60 border border-blue-500/10 space-y-3">
            <div class="flex justify-between items-center border-b border-white/5 pb-2">
              <span class="text-[10px] font-bold text-blue-400 font-mono uppercase">DECRYPTED PLAINTEXT MESSAGE:</span>
              <button
                on:click={() => copyText(decryptedMessageText, 'decrypt')}
                class="text-[9px] font-mono text-slate-400 hover:text-slate-200"
              >
                {decryptionCopied ? 'Copied ✓' : '[Copy Message]'}
              </button>
            </div>

            <!-- Decrypted Text Block -->
            <div class="p-3.5 rounded bg-blue-500/5 border border-blue-500/20 text-xs text-slate-100 font-sans leading-relaxed select-all">
              {decryptedMessageText}
            </div>

            <!-- Math telemetry -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3 text-[9px] font-mono text-slate-500 pt-2 border-t border-white/5">
              <div>
                <span class="text-slate-400 font-semibold uppercase">Decapsulation Schema:</span> ML-KEM-768
              </div>
              <div class="md:text-right">
                <span class="text-slate-400 font-semibold uppercase">Shared Secret Hash:</span> {decryptionResult.shared_secret_hash.substring(0, 16)}...
              </div>
            </div>
          </div>
        </div>
      {/if}

    </div>
  {/if}

  <!-- TAB 3: KEYPAIR MANAGER -->
  {#if activeSubTab === 'keygen'}
    <div in:fade={{ duration: 150 }} class="space-y-4">
      <div class="p-4 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <div class="space-y-2">
          <h3 class="text-xs font-bold text-slate-300 uppercase tracking-wide">Lattice-Based Keypair Generation</h3>
          <p class="text-[10px] text-slate-400 leading-normal">
            Generate your private and public keypairs locally using <strong>ML-KEM-768</strong> (FIPS 203). To receive encrypted messages, publish/share your Public Key (ek) with the sender. Keep your Private Key (dk) secret.
          </p>
        </div>

        <button
          on:click={handleKeypairGeneration}
          disabled={keygenPending}
          class="w-full py-2.5 rounded-lg font-bold text-xs tracking-wider bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-slate-100 transition-all duration-300 border border-blue-500/20 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5"
        >
          {#if keygenPending}
            <div class="animate-spin rounded-full h-4 w-4 border-2 border-white/20 border-t-white"></div>
          {:else}
            <span>Generate Post-Quantum Keypair</span>
            <span class="text-[8px] font-mono text-blue-300 font-normal">POST /v1/quantum/keygen</span>
          {/if}
        </button>
      </div>

      <!-- Generated Keys Display -->
      {#if keysGenerated}
        <div in:fly={{ y: 15, duration: 250 }} class="p-4 rounded-xl bg-slate-950/60 border border-blue-500/10 space-y-4">
          <div class="flex justify-between items-center border-b border-white/5 pb-2">
            <span class="text-[10px] font-bold text-blue-400 font-mono uppercase">ML-KEM-768 KEYPAIR GENERATED</span>
            <button
              on:click={() => copyText(JSON.stringify({ pk: generatedPublicKey, sk: generatedPrivateKey }), 'keypair')}
              class="text-[9px] font-mono text-slate-400 hover:text-slate-200"
            >
              {fullKeyPairCopied ? 'Copied ✓' : '[Copy Full Keypair JSON]'}
            </button>
          </div>

          <!-- Public Key -->
          <div class="space-y-1.5">
            <span class="text-[9px] font-bold font-mono text-slate-500 block">PUBLIC KEY (ek) - SHAREABLE (1184 Bytes):</span>
            <div class="relative">
              <textarea
                readonly
                value={generatedPublicKey}
                rows="3"
                class="w-full p-2.5 pr-12 rounded bg-slate-900 border border-white/5 text-[9px] font-mono text-slate-300 focus:outline-none resize-none select-all"
              ></textarea>
              <button
                on:click={() => copyText(generatedPublicKey, 'pubkey')}
                class="absolute right-2.5 top-2.5 p-1.5 rounded-md bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer shadow-glass-sm"
                title="Copy Public Key"
              >
                {#if publicKeyCopied}
                  <span class="text-[8px] font-mono font-bold text-blue-400 px-1">Copied!</span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          <!-- Private Key -->
          <div class="space-y-1.5">
            <span class="text-[9px] font-bold font-mono text-slate-500 block">PRIVATE KEY (dk) - SECRET (2400 Bytes):</span>
            <div class="relative">
              <textarea
                readonly
                value={generatedPrivateKey}
                rows="4"
                class="w-full p-2.5 pr-12 rounded bg-slate-900 border border-white/5 text-[9px] font-mono text-slate-300 focus:outline-none resize-none select-all"
              ></textarea>
              <button
                on:click={() => copyText(generatedPrivateKey, 'privkey')}
                class="absolute right-2.5 top-2.5 p-1.5 rounded-md bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer shadow-glass-sm"
                title="Copy Private Key"
              >
                {#if privateKeyCopied}
                  <span class="text-[8px] font-mono font-bold text-blue-400 px-1">Copied!</span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                {/if}
              </button>
            </div>
          </div>

          <!-- Share Link -->
          <div class="space-y-1.5 pt-1 border-t border-white/5">
            <span class="text-[9px] font-bold font-mono text-slate-500 block">ENCRYPTION PRE-FILLED SHARE LINK:</span>
            <div class="relative">
              <input
                type="text"
                readonly
                value={generatedShareLink}
                class="w-full p-2.5 pr-12 rounded bg-slate-900 border border-white/5 text-[9px] font-mono text-slate-300 focus:outline-none select-all truncate"
              />
              <button
                on:click={() => copyText(generatedShareLink, 'sharelink')}
                class="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 rounded-md bg-slate-950/60 hover:bg-slate-950 border border-white/5 hover:border-white/15 text-slate-400 hover:text-slate-100 transition-all flex items-center justify-center cursor-pointer shadow-glass-sm"
                title="Copy Share Link"
              >
                {#if shareLinkCopied}
                  <span class="text-[8px] font-mono font-bold text-blue-400 px-1">Copied!</span>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                {/if}
              </button>
            </div>
            <p class="text-[8px] text-slate-500 leading-normal">
              ★ Give this link to someone so they can encrypt messages directly for you.
            </p>
          </div>

          <!-- Key Security Context Section -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3.5 border-t border-white/5 text-[10px] font-sans leading-relaxed">
            <div class="p-3.5 rounded-lg bg-blue-500/5 border border-blue-500/10 space-y-1.5">
              <div class="flex items-center space-x-1.5 font-bold text-blue-300 font-mono uppercase tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.684 10.742l1.99 1.99a1 1 0 001.414 0l7.99-7.99m-11.394 0L3.3 10.742m11.394-4.708l-5.697 5.697" />
                </svg>
                <span>Why Public Key (ek) is Shareable</span>
              </div>
              <p class="text-slate-400">
                The Public Key (Encryption Key) is designed to be shared publicly. Anyone can use it to encrypt a message for you. It contains mathematical parameters (lattice polynomials) that allow others to formulate a ciphertext that only you can unlock. Knowing the Public Key does not reveal the secret key.
              </p>
            </div>
            
            <div class="p-3.5 rounded-lg bg-red-500/5 border border-red-500/10 space-y-1.5">
              <div class="flex items-center space-x-1.5 font-bold text-red-300 font-mono uppercase tracking-wide">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <span>Why Private Key (dk) is Secret</span>
              </div>
              <p class="text-slate-400">
                The Private Key (Decapsulation Key) must never be shared. It contains the trapdoor secrets (short vectors in a high-dimensional lattice) required to decapsulate the shared secret. If someone else obtains your Private Key, they can decrypt all current and future messages sent to you.
              </p>
            </div>
          </div>

          <!-- Interactive Deep-Dive: Try altering the key! -->
          <div class="mt-4 p-3 rounded-lg bg-slate-900/40 border border-white/5 space-y-2">
            <details class="group">
              <summary class="flex justify-between items-center text-[10px] font-bold font-mono text-slate-400 cursor-pointer select-none hover:text-slate-200">
                <span>🔍 ADVANCED DEEP-DIVE: HOW ML-KEM KEYS WORK (AND A COOL TRICK)</span>
                <span class="transition-transform group-open:rotate-180 text-xs text-slate-500 font-mono">&darr;</span>
              </summary>
              <div class="mt-3.5 space-y-3.5 text-[9px] font-sans text-slate-400 leading-relaxed border-t border-white/5 pt-3.5">
                <p>
                  Have you noticed that if you change the last few characters of your generated <strong>Private Key (dk)</strong>, decryption still works perfectly? This isn't a bug—it's a core security feature of <strong>ML-KEM (crystals-kyber)</strong>!
                </p>
                <div class="p-3 rounded bg-slate-950/60 border border-white/5 space-y-1.5 font-mono text-[9px]">
                  <div class="text-slate-300 font-bold">Expanded Private Key Structure (2400 Bytes):</div>
                  <div class="text-blue-400">dk = ( dk_PKE || ek || H(ek) || z )</div>
                  <ul class="list-disc pl-4 space-y-1 mt-1 text-slate-500">
                    <li><strong class="text-slate-400">dk_PKE (1152B):</strong> The raw decapsulation key.</li>
                    <li><strong class="text-slate-400">ek (1184B):</strong> The public key, used for validation.</li>
                    <li><strong class="text-slate-400">H(ek) (32B):</strong> The SHA3-256 hash of the public key.</li>
                    <li><strong class="text-slate-400">z (32B):</strong> The implicit rejection seed at the very end.</li>
                  </ul>
                </div>
                <p>
                  <strong>Why changing the end (z) still works:</strong> ML-KEM is designed to be secure against active chosen-ciphertext attacks (IND-CCA2). To prevent attackers from learning about your key by submitting tampered ciphertexts and analyzing error responses, ML-KEM <em>never throws an error</em> for bad ciphertexts.
                </p>
                <p>
                  Instead, if the ciphertext is valid, the algorithm decrypts it normally using <strong>dk_PKE</strong> (ignoring <strong>z</strong>). If the ciphertext is tampered with, the algorithm uses the seed <strong>z</strong> to derive a dummy, random-looking shared secret. Because the attacker gets a random-looking key instead of a decryption error, they learn nothing about your private key.
                </p>
                <p>
                  Try it yourself: alter characters near the beginning (modifying dk_PKE) and decryption will fail (triggering an AES-GCM tag verification error). Alter characters at the very end (modifying z) and valid messages will still decrypt successfully!
                </p>
              </div>
            </details>
          </div>
        </div>
      {/if}
    </div>
  {/if}

  <!-- EDUCATIONAL SECTION: Interactive Cryptographic flow diagram -->
  <div class="p-4 rounded-xl bg-slate-950/20 border border-white/5 space-y-4">
    <h3 class="text-[10px] font-bold text-slate-400 font-mono uppercase tracking-wider">// How Hybrid Post-Quantum Encryption Works</h3>
    
    <div class="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs font-sans text-slate-400">
      
      <div class="p-3.5 rounded bg-slate-950/40 border border-white/5 space-y-2">
        <div class="flex items-center space-x-1.5">
          <span class="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center justify-center text-[10px] font-mono">1</span>
          <span class="font-semibold text-slate-200">Key Encapsulation (KEM)</span>
        </div>
        <p class="text-[10px] leading-relaxed">
          Unlike RSA, lattice algorithms cannot encrypt messages directly. Instead, the sender uses the recipient's <strong>ML-KEM-768</strong> public key to encapsulate a random 32-byte shared secret, producing a 1088-byte ciphertext.
        </p>
      </div>

      <div class="p-3.5 rounded bg-slate-950/40 border border-white/5 space-y-2">
        <div class="flex items-center space-x-1.5">
          <span class="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center justify-center text-[10px] font-mono">2</span>
          <span class="font-semibold text-slate-200">Symmetric Encryption</span>
        </div>
        <p class="text-[10px] leading-relaxed">
          The message itself is encrypted symmetrically using <strong>AES-256-GCM</strong> (an authenticated cipher secure against quantum speedups), using a key derived from the encapsulated shared secret via <strong>HKDF-SHA-256</strong>.
        </p>
      </div>

      <div class="p-3.5 rounded bg-slate-950/40 border border-white/5 space-y-2">
        <div class="flex items-center space-x-1.5">
          <span class="w-4 h-4 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 flex items-center justify-center text-[10px] font-mono">3</span>
          <span class="font-semibold text-slate-200">Zero Server Metadata</span>
        </div>
        <p class="text-[10px] leading-relaxed">
          Symmetric ciphertext and KEM parameters are stored strictly in the <strong>URL hash fragment</strong>. Since browsers do not transmit hash fragments to servers in requests, the host never sees the message content.
        </p>
      </div>

    </div>

    <!-- Hybrid PQC Flow Visual Diagram -->
    <div class="p-4 rounded-lg bg-slate-950/80 border border-white/5 flex flex-col items-center justify-center text-slate-500 font-mono text-[9px] space-y-4">
      <div class="text-[9px] font-bold text-slate-400 tracking-wider">HYBRID POST-QUANTUM DATA PATH (HPQC)</div>
      
      <div class="flex flex-col md:flex-row items-center justify-center gap-4 w-full max-w-lg text-center">
        
        <!-- Box A: ML-KEM-768 -->
        <div class="flex-1 p-2 rounded border border-blue-500/25 bg-blue-500/5 text-blue-300 w-full md:w-auto">
          <div class="font-bold">ML-KEM-768 KEM</div>
          <div class="text-[8px] mt-1 text-blue-400/80">Encapsulates Shared Secret (ss)</div>
          <div class="text-[8px] font-bold text-blue-300 mt-1">Output: KEM Ciphertext (1088B)</div>
        </div>

        <div class="text-slate-600 font-bold rotate-90 md:rotate-0">&rarr;</div>

        <!-- Box B: KDF -->
        <div class="flex-1 p-2 rounded border border-white/10 bg-slate-900 text-slate-400 w-full md:w-auto">
          <div class="font-bold">HKDF-SHA256</div>
          <div class="text-[8px] mt-1 text-slate-500">Derives AES-256 Symmetric Key</div>
        </div>

        <div class="text-slate-600 font-bold rotate-90 md:rotate-0">&rarr;</div>

        <!-- Box C: AES-256-GCM -->
        <div class="flex-1 p-2 rounded border border-emerald-500/25 bg-emerald-500/5 text-emerald-300 w-full md:w-auto">
          <div class="font-bold">AES-256-GCM DEM</div>
          <div class="text-[8px] mt-1 text-emerald-400/80">Encrypts Plaintext Msg + Tag</div>
          <div class="text-[8px] font-bold text-emerald-300 mt-1">Output: Ciphertext + IV</div>
        </div>

      </div>

      <div class="text-[8px] text-slate-500 pt-1">
        Combined Output Payload: [KEM Ciphertext] + [12B IV] + [AES Ciphertext + 16B Tag]
      </div>
    </div>
  </div>

</div>
