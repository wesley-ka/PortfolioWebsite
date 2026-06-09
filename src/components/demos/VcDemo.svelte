<script>
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { 
    issueVerifiableCredential, 
    fetchCredentialFromUrl, 
    verifyVerifiableCredential,
    isBackendOnline 
  } from '../../services/api.js';

  // Navigation tabs: 'issuer' | 'verifier'
  let activeTab = 'issuer';
  
  // Pending & Status states
  let isPending = false;
  let isScanning = false;
  let errorMsg = null;
  let copied = false;
  
  // Issuer Form State
  let subjectId = 'did:example:citizen123';
  let fullName = 'Juana de Arco';
  let jurisdiction = 'Madrid';
  let eligibleToVote = true;
  let expirationDays = 30;
  
  // Issued VC Response
  let issuedVc = null;
  let cardFlipped = false;
  let qrCodeUrl = '';
  
  // Verifier State
  let inputVcUrl = '';
  let fetchedVcJson = '';
  let verificationResult = null;
  let showManualInput = false;
  let verifyInputMethod = 'url'; // 'url' | 'json'
  let pastedVcJson = '';
  let isDragging = false;

  // Connection notice
  let connectionNotice = '';

  onMount(() => {
    // Check if URL has vcUrl parameter
    const params = new URLSearchParams(window.location.search);
    const vcUrlParam = params.get('vcUrl');
    
    if (vcUrlParam || window.location.pathname.includes('/verify-vc')) {
      activeTab = 'verifier';
      if (vcUrlParam) {
        inputVcUrl = vcUrlParam;
        autoFetchAndVerify(vcUrlParam);
      }
    }
  });

  async function runIssuing() {
    isPending = true;
    issuedVc = null;
    cardFlipped = false;
    errorMsg = null;
    
    try {
      const payload = {
        subjectId,
        fullName,
        attributes: {
          eligibleToVote,
          jurisdiction
        },
        expirationDays
      };
      
      const response = await issueVerifiableCredential(payload);
      issuedVc = response;
      
      // Construct QR URL dynamically pointing to verify-vc route
      const cleanShareUrl = response.shareUrl;
      const apiOrigin = window.location.origin;
      const verifyUrl = `${apiOrigin}/verify-vc?vcUrl=${encodeURIComponent(apiOrigin + cleanShareUrl)}`;
      qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(verifyUrl)}`;
      
      // Auto-prefill verifier
      inputVcUrl = apiOrigin + cleanShareUrl;
      fetchedVcJson = JSON.stringify(response.credential, null, 2);

      // Trigger laser scanning animation before flipping the card
      setTimeout(() => {
        isPending = false;
        cardFlipped = true;
      }, 1500);
      
    } catch (err) {
      errorMsg = err.message || "Failed to issue Verifiable Credential.";
      isPending = false;
    }
  }

  async function autoFetchAndVerify(vcUrl) {
    isScanning = true;
    verificationResult = null;
    connectionNotice = '';
    errorMsg = null;
    
    try {
      // Fetch credential
      const credential = await fetchCredentialFromUrl(vcUrl);
      fetchedVcJson = JSON.stringify(credential, null, 2);
      
      // Call verify endpoint
      const result = await verifyVerifiableCredential(credential);
      verificationResult = result;
    } catch (err) {
      console.warn("Fetch failed, loading fallback simulated credential...", err);
      connectionNotice = "Local API server unreachable. Loaded high-fidelity simulated Verifiable Credential.";
      
      // Load fallback simulated credential directly
      const mockResult = await fetchCredentialFromUrl('http://localhost:8080/api/v1/identity/vc/share/simulated');
      fetchedVcJson = JSON.stringify(mockResult, null, 2);
      
      const result = await verifyVerifiableCredential(mockResult);
      verificationResult = result;
    } finally {
      isScanning = false;
    }
  }

  async function runVerification() {
    isScanning = true;
    verificationResult = null;
    errorMsg = null;
    
    try {
      let credObject;
      try {
        credObject = JSON.parse(fetchedVcJson);
      } catch (e) {
        throw new Error("Invalid JSON formatting in VC Payload editor.");
      }
      
      const result = await verifyVerifiableCredential(credObject);
      verificationResult = result;
    } catch (err) {
      errorMsg = err.message || "Credential verification failed.";
    } finally {
      isScanning = false;
    }
  }

  async function handlePasteJsonRaw() {
    errorMsg = null;
    verificationResult = null;
    try {
      const text = await navigator.clipboard.readText();
      pastedVcJson = text || '';
    } catch (err) {
      console.warn("Could not read from clipboard:", err);
      pastedVcJson = '';
    }
    showManualInput = true;
    verifyInputMethod = 'json';
  }

  // SHA-256 helper for client-side sample creation
  async function localSha256(str) {
    const buffer = new TextEncoder().encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async function loadSampleVc(isValid) {
    errorMsg = null;
    verificationResult = null;
    isScanning = true;
    
    try {
      let credential;
      
      // If backend is active online, fetch a real cryptographic credential from the API
      if (isValid && isBackendOnline) {
        const response = await issueVerifiableCredential({
          subjectId: "did:example:citizen123",
          fullName: "Juana de Arco",
          attributes: {
            eligibleToVote: true,
            jurisdiction: "Madrid"
          },
          expirationDays: 30
        });
        credential = response.credential;
      } else if (!isValid && isBackendOnline) {
        // Issue a real credential and then tamper with it so it fails validation on the backend
        const response = await issueVerifiableCredential({
          subjectId: "did:example:citizen123",
          fullName: "Juana de Arco",
          attributes: {
            eligibleToVote: true,
            jurisdiction: "Madrid"
          },
          expirationDays: 30
        });
        credential = response.credential;
        // Tampering: modify full name and eligibility key
        credential.credentialSubject.fullName = "Juana de Arco (Hacked)";
        credential.credentialSubject.eligibleToVote = false;
      } else {
        // Offline simulated VC generation
        const currentIso = new Date().toISOString();
        const expDate = new Date();
        expDate.setDate(expDate.getDate() + (isValid ? 30 : -5)); // Expired if invalid
        
        const subject = {
          "id": "did:example:citizen123",
          "fullName": isValid ? "Juana de Arco" : "Juana de Arco (Hacked)",
          "eligibleToVote": isValid ? true : false,
          "jurisdiction": "Madrid"
        };

        const expectedPayload = {
          subjectId: subject.id,
          fullName: subject.fullName,
          attributes: {
            eligibleToVote: subject.eligibleToVote,
            jurisdiction: subject.jurisdiction
          },
          expirationDays: 30
        };
        
        const subjectHash = await localSha256(JSON.stringify(expectedPayload));
        const mockSignature = btoa(`SHA256withECDSA:${isValid ? subjectHash : 'tampered-hash-value-12345'}`);
        
        credential = {
          "@context": ["https://www.w3.org/2018/credentials/v1", "https://schema.org"],
          "id": `urn:uuid:${isValid ? 'valid-uuid-1111' : 'invalid-uuid-0000'}`,
          "type": ["VerifiableCredential", "CivicCitizenCredential"],
          "issuer": "did:web:engine.civictech.org",
          "issuanceDate": currentIso,
          "expirationDate": expDate.toISOString(),
          "credentialSubject": subject,
          "proof": {
            "type": "JsonWebSignature2020",
            "created": currentIso,
            "proofPurpose": "assertionMethod",
            "verificationMethod": "did:web:engine.civictech.org#key-1",
            "publicKeyX": "7c98f828a2d3e4f506172839405a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3",
            "publicKeyY": "8f89e2c2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0",
            "proofValue": mockSignature
          }
        };
      }
      
      pastedVcJson = JSON.stringify(credential, null, 2);
      showManualInput = true;
      verifyInputMethod = 'json';
      connectionNotice = `Loaded simulated ${isValid ? 'VALID' : 'TAMPERED / EXPIRED'} W3C Verifiable Credential into the editor below.`;
    } catch (err) {
      errorMsg = err.message || "Failed to load sample credential.";
    } finally {
      isScanning = false;
    }
  }

  async function downloadJson() {
    if (!issuedVc) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(issuedVc.credential, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `citizen_credential_${issuedVc.vcId.substring(0,8)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
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

  function handleCardKeydown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      if (issuedVc) cardFlipped = !cardFlipped;
    }
  }

  let dragCounter = 0;

  function cleanJsonString(str) {
    if (!str) return '';
    let cleaned = str.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```[a-zA-Z]*\n?/, '');
      cleaned = cleaned.replace(/\n?```$/, '');
    }
    return cleaned.trim();
  }

  // Drag & Drop handlers
  function handleDragEnter(e) {
    e.preventDefault();
    dragCounter++;
    isDragging = true;
  }

  function handleDragOver(e) {
    e.preventDefault();
  }
  
  function handleDragLeave(e) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) {
      isDragging = false;
    }
  }
  
  async function handleDrop(e) {
    e.preventDefault();
    isDragging = false;
    dragCounter = 0;
    
    const file = e.dataTransfer.files[0];
    if (!file) return;
    
    await processFile(file);
  }
  
  async function handleVerifierFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    await processFile(file);
  }
  
  async function processFile(file) {
    isScanning = true;
    verificationResult = null;
    errorMsg = null;
    connectionNotice = '';
    
    try {
      const text = await file.text();
      let cred = JSON.parse(cleanJsonString(text));
      if (cred && cred.credential) {
        cred = cred.credential;
      }
      fetchedVcJson = JSON.stringify(cred, null, 2);
      
      const result = await verifyVerifiableCredential(cred);
      verificationResult = result;
    } catch (err) {
      errorMsg = err.message || "Failed to parse or verify selected credential file.";
    } finally {
      isScanning = false;
    }
  }
  
  async function runPastedVerification() {
    isScanning = true;
    verificationResult = null;
    errorMsg = null;
    connectionNotice = '';
    
    try {
      let cred = JSON.parse(cleanJsonString(pastedVcJson));
      if (cred && cred.credential) {
        cred = cred.credential;
      }
      fetchedVcJson = JSON.stringify(cred, null, 2);
      
      const result = await verifyVerifiableCredential(cred);
      verificationResult = result;
    } catch (err) {
      errorMsg = err.message || "Failed to parse or verify pasted JSON payload.";
    } finally {
      isScanning = false;
    }
  }
</script>

<div class="space-y-5">
  <!-- Internal Tabs -->
  <div class="flex border-b border-white/5 pb-0.5">
    <button
      class="px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'issuer' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'issuer'; errorMsg = null; }}
    >
      Issuer Portal (Desktop)
    </button>
    <button
      class="px-4 py-2 text-xs font-semibold border-b-2 transition-all duration-300 {activeTab === 'verifier' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}"
      on:click={() => { activeTab = 'verifier'; errorMsg = null; }}
    >
      Verifier Portal (Mobile Scan)
    </button>
  </div>

  <!-- Error Alerts -->
  {#if errorMsg}
    <div in:scale={{duration: 200}} class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
      [ERROR] {errorMsg}
    </div>
  {/if}

  <!-- TAB 1: ISSUER VIEW -->
  {#if activeTab === 'issuer'}
    <div in:fade={{ duration: 150 }} class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      
      <!-- Issuer Form (Left) -->
      <div class="lg:col-span-6 space-y-4">
        <div class="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
          <h3 class="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
            Identity Attributes
          </h3>
          
          <div class="space-y-1">
            <label for="vc-subject" class="text-[10px] font-semibold text-slate-400 font-mono">Subject DID</label>
            <input
              id="vc-subject"
              type="text"
              bind:value={subjectId}
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
            />
          </div>

          <div class="space-y-1">
            <label for="vc-fullname" class="text-[10px] font-semibold text-slate-400 font-mono">Full Name</label>
            <input
              id="vc-fullname"
              type="text"
              bind:value={fullName}
              class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div class="space-y-1">
              <label for="vc-jurisdiction" class="text-[10px] font-semibold text-slate-400 font-mono">Jurisdiction</label>
              <input
                id="vc-jurisdiction"
                type="text"
                bind:value={jurisdiction}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            
            <div class="space-y-1">
              <label for="vc-expiration" class="text-[10px] font-semibold text-slate-400 font-mono">Expiration Days</label>
              <input
                id="vc-expiration"
                type="number"
                bind:value={expirationDays}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
              />
            </div>
          </div>

          <div class="flex items-center space-x-2 py-2">
            <input
              id="vc-vote"
              type="checkbox"
              bind:checked={eligibleToVote}
              class="rounded bg-slate-900 border-white/10 text-blue-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
            />
            <label for="vc-vote" class="text-xs font-semibold text-slate-300 select-none cursor-pointer">
              Citizen is eligible to vote
            </label>
          </div>
        </div>

        <button
          on:click={runIssuing}
          disabled={isPending}
          class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex flex-col items-center justify-center space-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          <div class="flex items-center space-x-2">
            {#if isPending}
              <div class="animate-spin rounded-full h-3 w-3 border-2 border-white/20 border-t-white"></div>
              <span>Signing Identity Payload...</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <span>ISSUE VERIFIABLE CREDENTIAL</span>
            {/if}
          </div>
          <span class="text-[8px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">POST /v1/identity/vc/issue</span>
        </button>
      </div>

      <!-- Glowing ID Card Mockup (Right) -->
      <div class="lg:col-span-6 flex flex-col items-center justify-center py-4">
        
        <!-- Card Perspective Wrapper -->
        <div
          class="perspective-1000 w-[320px] h-[190px] text-left block border-none bg-transparent p-0 focus:outline-none rounded-2xl"
        >
          <!-- Inner flipper container -->
          <div class="transform-style-3d transition-transform duration-700 relative w-full h-full {cardFlipped ? 'rotate-y-180' : ''}">
            
            <!-- CARD FRONT -->
            <div 
              role="button"
              tabindex="0"
              on:click|stopPropagation={() => { if (issuedVc) cardFlipped = true; }}
              on:keydown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && issuedVc) { e.preventDefault(); cardFlipped = true; } }}
              class="backface-hidden card-front absolute inset-0 rounded-2xl border bg-slate-900/80 border-white/10 shadow-glass-lg p-5 flex flex-col justify-between overflow-hidden {cardFlipped ? 'pointer-events-none z-0' : 'z-10'}"
              aria-label="Civic identity card front face. Click or press Enter to flip and reveal sharing QR code."
            >
              <!-- Grid background lines -->
              <div class="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:10px_10px] pointer-events-none"></div>
              
              <!-- Scanning fingerprint laser animation overlay -->
              {#if isPending}
                <div class="absolute inset-0 z-20 flex flex-col items-center justify-center bg-blue-950/70 backdrop-blur-sm">
                  <!-- Biometric scan grid lines -->
                  <div class="relative w-20 h-20 border border-blue-500/30 rounded-xl overflow-hidden flex items-center justify-center">
                    <!-- Laser line -->
                    <div class="absolute left-0 top-0 w-full h-[2px] bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,1)] animate-laser-line z-20"></div>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-12 w-12 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                      <!-- Scanning reticle corners -->
                      <path d="M3 8V5a2 2 0 0 1 2-2h3" />
                      <path d="M16 3h3a2 2 0 0 1 2 2v3" />
                      <path d="M21 16v3a2 2 0 0 1-2 2h-3" />
                      <path d="M8 21H5a2 2 0 0 1-2-2v-3" />
                      
                      <!-- Biometric Face/ID Silhouette -->
                      <circle cx="12" cy="10" r="3" />
                      <path d="M7 20c0-3 3-5 5-5s5 2 5 5" />
                      
                      <!-- Center reticle dot -->
                      <circle cx="12" cy="10" r="0.5" fill="currentColor" />
                    </svg>
                  </div>
                  <span class="text-[9px] font-mono text-blue-400 mt-2 tracking-widest animate-pulse">BIOMETRIC SIGNING...</span>
                </div>
              {/if}

              <!-- Card Header -->
              <div class="flex justify-between items-start z-10">
                <div class="flex items-center space-x-2">
                  <div class="w-6 h-6 rounded-md bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-[10px] font-bold text-blue-400 font-mono">
                    C1
                  </div>
                  <div>
                    <h4 class="text-[10px] font-bold font-mono tracking-wider text-slate-200">CIVIC TECH WALLET</h4>
                    <span class="text-[7px] text-slate-500 font-mono">DECENTRALIZED IDENTITY SYSTEM</span>
                  </div>
                </div>
                <span class="text-[7px] font-mono text-slate-500 tracking-widest">NIST_P256</span>
              </div>

              <!-- Card Body (Subject Details) -->
              <div class="flex items-center space-x-4 my-2 z-10">
                <!-- Avatar placeholder with abstract biometric icon -->
                <div class="w-12 h-12 rounded-lg bg-slate-950 border border-white/5 flex items-center justify-center text-slate-600 relative overflow-hidden group shadow-inner">
                  <div class="absolute inset-0 bg-gradient-to-t from-blue-500/10 to-transparent"></div>
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
                <div class="flex-grow min-w-0 space-y-1">
                  <div class="text-[14px] font-bold text-slate-100 tracking-tight truncate leading-tight">
                    {fullName || 'Juana de Arco'}
                  </div>
                  <div class="text-[9px] text-slate-400 font-medium leading-tight">
                    Jurisdiction: <span class="text-slate-300">{jurisdiction || 'Madrid'}</span>
                  </div>
                  <div class="text-[8px] text-slate-500 font-mono truncate">
                    {subjectId || 'did:example:citizen123'}
                  </div>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="flex justify-between items-end border-t border-white/5 pt-2 z-10">
                <div class="space-y-0.5">
                  <span class="text-[6px] text-slate-600 font-mono block">VOTING PRIVILEGES</span>
                  <div class="inline-flex items-center px-1.5 py-0.5 rounded text-[8px] font-mono {eligibleToVote ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}">
                    {eligibleToVote ? 'ELIGIBLE [VOTE:YES]' : 'INELIGIBLE [VOTE:NO]'}
                  </div>
                </div>
                
                <div class="text-right">
                  <span class="text-[6px] text-slate-600 font-mono block">SECURITY CLEARANCE</span>
                  <span class="text-[8px] font-bold font-mono text-blue-400">CLASS_A_CITIZEN</span>
                </div>
              </div>
            </div>
            
            <!-- CARD BACK -->
            <div 
              role="button"
              tabindex="0"
              on:click|stopPropagation={() => { cardFlipped = false; }}
              on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cardFlipped = false; } }}
              class="backface-hidden card-back absolute inset-0 rounded-2xl border bg-slate-900/90 border-white/10 shadow-glass-lg p-4 flex items-center justify-between overflow-hidden {cardFlipped ? 'z-10' : 'pointer-events-none z-0'}"
              aria-label="Civic identity card back face. Click or press Enter to flip back to front."
            >
              <!-- QR Code left -->
              <div class="w-[120px] h-[120px] bg-white rounded-lg p-1 flex items-center justify-center shadow-lg shrink-0">
                {#if qrCodeUrl}
                  <img src={qrCodeUrl} alt="VC Sharing QR Code" class="w-full h-full" />
                {:else}
                  <div class="w-full h-full bg-slate-200 animate-pulse"></div>
                {/if}
              </div>

              <!-- Back text and buttons right -->
              <div class="flex-grow pl-4 flex flex-col justify-between h-full">
                <div class="space-y-1">
                  <h4 class="text-[10px] font-bold font-mono tracking-wide text-slate-200">CRYPTOGRAPHIC SIGN</h4>
                  <p class="text-[8px] text-slate-400 leading-normal">
                    This badge contains an ECDSA cryptographic signature. Scan this QR code on a mobile device to run verifications against the issuer's key.
                  </p>
                </div>

                <div class="space-y-1.5 pt-2">
                  <button
                    on:click|stopPropagation={downloadJson}
                    class="w-full py-1 text-[9px] font-semibold text-slate-200 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 rounded-md transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    <span>Download JSON</span>
                  </button>

                  <button
                    on:click|stopPropagation={() => { activeTab = 'verifier'; }}
                    class="w-full py-1 text-[9px] font-semibold text-blue-300 bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 rounded-md transition-all flex items-center justify-center space-x-1 cursor-pointer"
                  >
                    <span>Inspect & Verify</span>
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

          </div>
        </div>

        <!-- Flip Hint -->
        <span class="text-[9px] font-mono text-slate-500 mt-3 hover:text-slate-400 transition-colors text-center block w-full">
          {issuedVc ? 'Click ID Card to flip. You can drag the downloaded JSON directly into the Verifier Portal!' : 'Fill details and click Issue to activate card'}
        </span>
      </div>

    </div>
  {/if}

  <!-- TAB 2: VERIFIER VIEW -->
  {#if activeTab === 'verifier'}
    <div 
      in:fade={{ duration: 150 }} 
      class="space-y-4 relative min-h-[300px]"
      on:dragenter={handleDragEnter}
      on:dragover={handleDragOver}
      on:dragleave={handleDragLeave}
      on:drop={handleDrop}
      role="region"
      aria-label="Verifier Portal drag and drop zone"
    >
      {#if isDragging}
        <div 
          transition:fade={{ duration: 150 }} 
          class="absolute inset-0 z-50 rounded-xl border-2 border-dashed border-blue-500 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center space-y-3 pointer-events-none"
        >
          <div class="w-16 h-16 rounded-full bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
          </div>
          <span class="text-xs font-mono font-bold text-blue-400 tracking-wider">DROP JSON CREDENTIAL HERE</span>
          <span class="text-[9px] font-mono text-slate-500">Release to automatically verify cryptographic signature</span>
        </div>
      {/if}

      <!-- Connection Notice / Simulated Banner -->
      {#if connectionNotice}
        <div class="p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-amber-500 font-mono text-[10px] flex items-center justify-between">
          <span>{connectionNotice}</span>
          <button on:click={() => connectionNotice = ''} class="hover:text-amber-400 font-bold shrink-0 ml-2">Dismiss</button>
        </div>
      {/if}

      {#if !isScanning && !verificationResult}
        <div class="space-y-4">
          
          <!-- Default View: Scan instructions or Drag/Drop upload zone -->
          <div 
            class="p-6 rounded-xl text-center space-y-4 max-w-lg mx-auto border transition-all duration-300 {isDragging ? 'bg-blue-500/10 border-blue-500/40 shadow-glow-blue/10 scale-[1.01]' : 'bg-slate-900/30 border-white/5'}"
            role="region"
            aria-label="Credential Drop Zone"
          >
            <!-- Dropzone clickable icon -->
            <label class="block cursor-pointer group">
              <input type="file" accept=".json" class="hidden" on:change={handleVerifierFileSelect} />
              
              <div class="w-12 h-12 rounded-full bg-blue-500/5 border border-blue-500/20 group-hover:border-blue-400 group-hover:bg-blue-500/10 flex items-center justify-center mx-auto text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.15)] transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              
              <div class="space-y-1 mt-3">
                <h3 class="text-xs font-bold text-slate-200 uppercase tracking-wider group-hover:text-blue-300 transition-colors">
                  Drag & Drop or Click to Upload JSON
                </h3>
                <p class="text-[10px] text-slate-400 max-w-sm mx-auto leading-relaxed">
                  Drag and drop your signed `.json` W3C credential file here, or click to browse. You can also scan the issuer card's QR code using your mobile device.
                </p>
              </div>
            </label>

            <div class="space-y-2 border-t border-white/5 pt-4">
              <div class="text-[9px] font-mono text-slate-500">// SIMULATE ON LOCAL MACHINE</div>
              <div class="flex flex-wrap gap-2 justify-center">
                <button
                  on:click={() => loadSampleVc(true)}
                  class="px-2.5 py-1.5 rounded bg-slate-950 border border-white/10 hover:border-blue-500/30 text-[10px] font-mono text-slate-300 hover:text-blue-300 transition-all cursor-pointer"
                >
                  Load Valid VC
                </button>
                <button
                  on:click={() => loadSampleVc(false)}
                  class="px-2.5 py-1.5 rounded bg-slate-950 border border-white/10 hover:border-red-500/30 text-[10px] font-mono text-slate-300 hover:text-red-400 transition-all cursor-pointer"
                >
                  Load Tampered VC
                </button>
                <button
                  on:click={handlePasteJsonRaw}
                  class="px-2.5 py-1.5 rounded bg-slate-950 border border-white/10 hover:border-slate-300/30 text-[10px] font-mono text-slate-300 hover:text-slate-100 transition-all cursor-pointer"
                >
                  Paste JSON Raw
                </button>
                <button
                  on:click={() => { showManualInput = true; verifyInputMethod = 'url'; }}
                  class="px-2.5 py-1.5 rounded bg-slate-950 border border-white/10 hover:border-slate-300/30 text-[10px] font-mono text-slate-300 hover:text-slate-100 transition-all cursor-pointer"
                >
                  Input Share URL
                </button>
              </div>
            </div>
          </div>

          <!-- Manual Input Modal panel (URL fetch or raw JSON pasting) -->
          {#if showManualInput || inputVcUrl}
            <div in:fade={{ duration: 150 }} class="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-4 max-w-lg mx-auto">
              
              <!-- Segmented Controls inside sub-form -->
              <div class="flex border-b border-white/5 pb-1.5 gap-4 font-mono text-[9px] uppercase tracking-wider text-slate-500">
                <button 
                  type="button" 
                  class="font-bold hover:text-slate-300 transition-colors {verifyInputMethod === 'url' ? 'text-blue-400 font-extrabold' : ''}" 
                  on:click={() => verifyInputMethod = 'url'}
                >
                  Verify by Share URL
                </button>
                <button 
                  type="button" 
                  class="font-bold hover:text-slate-300 transition-colors {verifyInputMethod === 'json' ? 'text-blue-400 font-extrabold' : ''}" 
                  on:click={() => verifyInputMethod = 'json'}
                >
                  Paste JSON Payload
                </button>
              </div>

              {#if verifyInputMethod === 'url'}
                <div class="space-y-2" in:fade={{ duration: 100 }}>
                  <label for="vc-url-input" class="text-[8px] font-bold font-mono text-slate-500 uppercase">Credential Share URL (vcUrl):</label>
                  <input
                    id="vc-url-input"
                    type="text"
                    bind:value={inputVcUrl}
                    placeholder="http://localhost:8080/api/v1/identity/vc/share/..."
                    class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/40 font-mono"
                  />
                  <button
                    on:click={() => autoFetchAndVerify(inputVcUrl)}
                    disabled={!inputVcUrl}
                    class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 rounded text-[10px] font-semibold text-slate-100 transition-colors disabled:opacity-50 cursor-pointer mt-1"
                  >
                    Fetch & Verify URL
                  </button>
                </div>
              {:else}
                <div class="space-y-2" in:fade={{ duration: 100 }}>
                  <label for="vc-paste-input" class="text-[8px] font-bold font-mono text-slate-500 uppercase">Raw Credential JSON Payload:</label>
                  <textarea
                    id="vc-paste-input"
                    bind:value={pastedVcJson}
                    rows="6"
                    placeholder="Paste signed W3C Verifiable Credential JSON here..."
                    class="w-full rounded bg-slate-950/60 border border-white/10 p-2.5 text-[10px] text-slate-200 focus:outline-none focus:border-blue-500/40 font-mono resize-none leading-relaxed"
                  ></textarea>
                  <button
                    on:click={runPastedVerification}
                    disabled={!pastedVcJson}
                    class="w-full py-1.5 bg-blue-600 hover:bg-blue-500 border border-blue-500/20 rounded text-[10px] font-semibold text-slate-100 transition-colors disabled:opacity-50 cursor-pointer mt-1"
                  >
                    Verify Pasted JSON
                  </button>
                </div>
              {/if}

              <div class="flex justify-end pt-1">
                <button
                  on:click={() => { showManualInput = false; inputVcUrl = ''; pastedVcJson = ''; }}
                  class="text-[9px] font-mono text-slate-500 hover:text-slate-300 hover:underline cursor-pointer"
                >
                  Cancel / Collapse
                </button>
              </div>
            </div>
          {/if}
        </div>
      {:else if isScanning}
        <!-- Scanning Animation: Circular Radar -->
        <div class="flex flex-col items-center justify-center py-12 space-y-6">
          <div class="relative w-28 h-28 flex items-center justify-center">
            <!-- Radar scan ripple ring 1 -->
            <div class="absolute inset-0 rounded-full border border-blue-500/20 animate-ping opacity-60"></div>
            <!-- Radar scan ripple ring 2 -->
            <div class="absolute w-20 h-20 rounded-full border border-blue-500/35 animate-ping opacity-45"></div>
            <!-- Center scanning core -->
            <div class="w-14 h-14 rounded-full bg-blue-500/5 border border-blue-500/40 flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.15)]">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6 text-blue-400 animate-spin-slow" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <div class="text-center font-mono text-[11px] text-slate-400 animate-pulse">
            // SEARCHING_CRYPTOGRAPHIC_SIGNATURES...
            <span class="block text-[9px] text-slate-600 mt-1 font-normal">Recomputing SHA-256 coordinates</span>
          </div>
        </div>
      {:else if verificationResult}
        <!-- Verification Output Screen -->
        <div in:fly={{ y: 15, duration: 300 }} class="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          
          <!-- Left side: Status badge & metrics -->
          <div class="lg:col-span-5 space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400 font-mono">VERIFIER REPORT</span>
              <button
                on:click={() => { verificationResult = null; }}
                class="px-2.5 py-1.5 rounded bg-slate-900 border border-white/10 text-[9px] font-mono text-slate-300 hover:text-slate-100 transition-colors"
              >
                &larr; Reset
              </button>
            </div>

            <!-- Glowing Seal Badge -->
            <div class="p-6 rounded-2xl text-center border overflow-hidden relative shadow-glass-lg {verificationResult.verified ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20'}">
              <!-- Radial background glow -->
              <div class="absolute w-28 h-28 -top-10 -left-10 rounded-full blur-3xl pointer-events-none {verificationResult.verified ? 'bg-green-500/10' : 'bg-red-500/10'}"></div>
              
              <div class="text-[9px] font-mono uppercase tracking-widest text-slate-500">Identity Integrity Seal</div>
              
              <!-- Checkmark/X symbol -->
              <div class="w-16 h-16 rounded-full border flex items-center justify-center mx-auto my-4 shadow-lg {verificationResult.verified ? 'bg-green-500/10 border-green-500/35 text-green-400 shadow-glow-green/20' : 'bg-red-500/10 border-red-500/35 text-red-400 shadow-glow-red/20'}">
                {#if verificationResult.verified}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4" />
                  </svg>
                {:else}
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                {/if}
              </div>

              <div class="text-[14px] font-bold uppercase tracking-wide leading-snug {verificationResult.verified ? 'text-green-400 text-glow-green' : 'text-red-400'}">
                {verificationResult.verified ? 'VALID CRYPTOGRAPHIC CITIZEN' : 'VERIFICATION FAILURE'}
              </div>
              <span class="text-[8px] font-mono text-slate-500 block mt-1">
                {verificationResult.verified ? 'W3C Verifiable Credential verified successfully' : 'ECDSA signature check or hash check failed'}
              </span>
            </div>

            <!-- Cryptographic Assertions Checklist -->
            <div class="p-4 rounded-xl bg-slate-950/60 border border-white/5 space-y-2 font-mono text-[9px]">
              <div class="text-[8px] font-bold text-slate-500 uppercase tracking-widest pb-1 border-b border-white/5">
                Audit Checkpoints
              </div>
              
              <div class="flex items-center justify-between p-1">
                <span class="text-slate-400">signatureValid:</span>
                <span class={verificationResult.signatureValid ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {verificationResult.signatureValid ? '[✓] PASSED' : '[✗] FAILED'}
                </span>
              </div>
              <div class="flex items-center justify-between p-1">
                <span class="text-slate-400">integrityIntact:</span>
                <span class={verificationResult.integrityIntact ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {verificationResult.integrityIntact ? '[✓] PASSED' : '[✗] TAMPERED'}
                </span>
              </div>
              <div class="flex items-center justify-between p-1">
                <span class="text-slate-400">notExpired:</span>
                <span class={verificationResult.notExpired ? 'text-green-400 font-bold' : 'text-red-400 font-bold'}>
                  {verificationResult.notExpired ? '[✓] PASSED' : '[✗] EXPIRED'}
                </span>
              </div>
            </div>
          </div>

          <!-- Right side: JSON Editor for simulation tinkering -->
          <div class="lg:col-span-7 space-y-3">
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold text-slate-400 font-mono">CREDENTIAL PAYLOAD EDITOR</span>
              <div class="flex gap-2">
                <button
                  on:click={runVerification}
                  class="px-2.5 py-1 rounded bg-blue-500/10 border border-blue-500/20 hover:bg-blue-500/20 text-[10px] font-bold text-blue-300 transition-colors cursor-pointer"
                >
                  Verify Modified JSON
                </button>
                <button
                  on:click={() => copyToClipboard(fetchedVcJson)}
                  class="px-2.5 py-1 rounded bg-slate-900 border border-white/10 text-[10px] font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
                >
                  {copied ? 'Copied ✓' : 'Copy'}
                </button>
              </div>
            </div>

            <!-- Code block / text input area -->
            <div class="relative rounded-xl border border-white/10 overflow-hidden bg-slate-950 flex flex-col">
              <div class="px-3.5 py-1 bg-slate-900 border-b border-white/5 text-[8px] font-mono text-slate-500 flex items-center justify-between">
                <span>SIMULATOR CONSOLE: Modify values below to test tamper detection</span>
                <span class="text-[7px] text-blue-400 font-mono uppercase font-bold">SHA-256 Recalculation Active</span>
              </div>
              <textarea
                id="vc-payload-editor"
                bind:value={fetchedVcJson}
                rows="14"
                class="w-full bg-slate-950 text-[10px] font-mono text-slate-300 p-3.5 focus:outline-none resize-none leading-relaxed border-none focus:ring-0"
              ></textarea>
            </div>
            <p class="text-[9px] text-slate-500 font-mono leading-relaxed pl-1">
              * Note: The proof value in the JSON (`proof.proofValue`) is a cryptographic seal bound to the exact citizen attributes. Altering even a single letter in the names, DIDs, or toggling eligibility keys will trigger an integrity validation breach!
            </p>
          </div>

        </div>
      {/if}

    </div>
  {/if}
</div>

<style>
  /* 3D card flip animation utility */
  .perspective-1000 {
    perspective: 1000px;
  }
  .transform-style-3d {
    transform-style: preserve-3d;
  }
  .backface-hidden {
    backface-visibility: hidden;
  }
  .rotate-y-180 {
    transform: rotateY(180deg);
  }
  .card-front {
    transform: translateZ(1px);
  }
  .card-back {
    transform: rotateY(180deg) translateZ(1px);
  }

  /* Laser line animation */
  @keyframes scan {
    0% {
      top: 0%;
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    90% {
      opacity: 1;
    }
    100% {
      top: 100%;
      opacity: 0;
    }
  }

  .animate-laser-line {
    animation: scan 2s linear infinite;
  }
  
  .animate-spin-slow {
    animation: spin 6s linear infinite;
  }
  
  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }

  .text-glow-green {
    text-shadow: 0 0 10px rgba(74, 222, 128, 0.4);
  }
  
  :global(.shadow-glow-blue\/20) {
    box-shadow: 0 0 20px rgba(59, 130, 246, 0.2);
  }
  :global(.shadow-glow-green\/20) {
    box-shadow: 0 0 20px rgba(74, 222, 128, 0.2);
  }
  :global(.shadow-glow-red\/20) {
    box-shadow: 0 0 20px rgba(239, 68, 68, 0.2);
  }
</style>
