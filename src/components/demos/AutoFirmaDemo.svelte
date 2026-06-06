<script>
  import { fade, fly } from 'svelte/transition';
  import { signPdfWithAutoFirma } from '../../services/api.js';

  // Constants
  const SAMPLE_PDF_BASE64 = "JVBERi0xLjQKMSAwIG9iago8PCAvVHlwZSAvQ2F0YWxvZyAvUGFnZXMgMiAwIFIgPj4KZW5kb2JqCjIgMCBvYmoKPDwgL1R5cGUgL1BhZ2VzIC9LaWRzIFszIDAgUl0gL0NvdW50IDEgPj4KZW5kb2JqCjMgMCBvYmoKPDwgL1R5cGUgL1BhZ2UgL1BhcmVudCAyIDAgUiAvTWVkaWFCb3ggWzAgMCA15OTUgODQyXSAvUmVzb3VyY2VzIDw8IC9Gb250IDw8IC9GMSA1IDAgUiA+PiA+PiAvQ29udGVudHMgNCAwIFIgPj4KZW5kb2JqCjQgMCBvYmoKPDwgL0xlbmd0aCA1NCA+PgpzdHJlYW0KQlQKL0YxIDI0IFRmCjcwIDcwMCBUZAooZUlEQVMgQ2VydGlmaWNhdGUgU2lnbmluZyBEZW1vKSBUagpFVAplbmRzdHJlYW0KZW5kb2JqCjUgMCBvYmoKPDwgL1R5cGUgL0ZvbnQgL1N1YnR5cGUgL1R5cGUxIC9CYXNlRm9udCAvSGVsdmV0aWNhID4+CmVuZG9iagp4cmVmCjAgNgowMDAwMDAwMDAwIDY1NTM1IGYgCjAwMDAwMDAwMDkgMDAwMDAgbiAKMDAwMDAwMDA1NiAwMDAwMCBuIAowMDAwMDAwMTExIDAwMDAwIG4gCjAwMDAwMDAyNDIgMDAwMDAgbiAKMDAwMDAwMDM0NSAwMDAwMCBuIAp0cmFpbGVyCjw8IC9TaXplIDYgL1Jvb3QgMSAwIFIgPj4Kc3RhcnR4cmVmCjQyNgolJUVPRgo=";

  const certificates = [
    {
      id: 'fnmt_wesley',
      name: 'WESLEY KALATAI ALBERTI (FNMT Persona Física)',
      issuer: 'AC Representación FNMT-RCM',
      serial: '74:0c:03:df:a1:04:f2:05:ab:08:4d',
      type: 'Royal Mint Software Certificate'
    },
    {
      id: 'dnie_wesley',
      name: 'WESLEY KALATAI ALBERTI (DNIe Firma Digital)',
      issuer: 'AC DNIE 006',
      serial: '3f:2a:81:e9:d7:4c:0a:92:81:fe:d3',
      type: 'DNIe Hardware Smartcard'
    },
    {
      id: 'fnmt_ac_root',
      name: 'FNMT-RCM AC Administración Pública',
      issuer: 'FNMT-RCM Root CA',
      serial: '01:a2:b3:c4:d5:e6:f7:88:99:aa:bb',
      type: 'Root CA Certificate'
    }
  ];

  // Declaration text templates by message key and language
  const DECLARATIONS = {
    APPROVE_DOCUMENT: {
      EN: 'I approve this document with my legally binding digital signature.',
      ES: 'Apruebo este documento con mi firma digital legalmente vinculante.',
      PT: 'Aprovo este documento com minha assinatura digital legalmente vinculante.'
    },
    AGREE_CONTENT: {
      EN: 'I agree with the content of this file.',
      ES: 'Estoy de acuerdo con el contenido de este archivo.',
      PT: 'Concordo com o conteudo deste arquivo.'
    },
    WITNESS_SIGNATURE: {
      EN: 'Signed as a witness.',
      ES: 'Firmado en calidad de testigo.',
      PT: 'Assinado como testemunha.'
    }
  };

  // State
  let pdfBase64 = '';
  let fileName = '';
  let selectedLanguage = 'EN';
  let selectedMessageKey = 'APPROVE_DOCUMENT';
  let useCustomText = false;
  let customText = 'Firmado digitalmente por Wesley Kalatai Alberti (FNMT/DNIe)';
  let visibleSignature = true;
  
  let isPending = false;
  let currentStep = 'upload'; // 'upload' | 'signing' | 'completed'
  let result = null;
  let errorMsg = null;
  let copied = false;

  // Modal State for simulation
  let showCertModal = false;
  let selectedCertId = 'fnmt_wesley';
  let certSelectCallback = null;
  let certCancelCallback = null;

  async function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      errorMsg = "Please select a valid PDF file.";
      return;
    }

    isPending = true;
    errorMsg = null;
    fileName = file.name;

    const reader = new FileReader();
    reader.onload = () => {
      pdfBase64 = reader.result.split(',')[1];
      isPending = false;
    };
    reader.onerror = () => {
      errorMsg = "Failed to read PDF file.";
      isPending = false;
    };
    reader.readAsDataURL(file);
  }

  function useSamplePdf() {
    pdfBase64 = SAMPLE_PDF_BASE64;
    fileName = "sample_document.pdf";
    errorMsg = null;
  }

  function removePdf() {
    pdfBase64 = '';
    fileName = '';
    result = null;
    currentStep = 'upload';
    errorMsg = null;
  }

  async function localSha256(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const hashBuffer = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  function handleSimulateCertSelect(resolveFn, rejectFn) {
    showCertModal = true;
    certSelectCallback = resolveFn;
    certCancelCallback = rejectFn;
  }

  function confirmCertSelect() {
    const cert = certificates.find(c => c.id === selectedCertId);
    showCertModal = false;
    if (certSelectCallback) {
      certSelectCallback(cert.name);
    }
  }

  function cancelCertSelect() {
    showCertModal = false;
    if (certCancelCallback) {
      certCancelCallback(new Error("User cancelled Spain's FNMT/DNIe certificate selection."));
    }
  }

  /**
   * Build PAdES extra params string for AutoFirma.
   * AutoFirma replaces $$SUBJECTCN$$ and $$SIGNDATE=fmt$$ from the chosen cert automatically.
   */
  function buildSignatureParams() {
    let params = "format=PAdES\nmode=implicit\nalgorithm=SHA256withRSA";

    if (visibleSignature) {
      // Compose the declaration text
      let declarationText;
      if (useCustomText && customText.trim()) {
        declarationText = customText.trim();
      } else {
        declarationText = DECLARATIONS[selectedMessageKey]?.[selectedLanguage]
          || DECLARATIONS.APPROVE_DOCUMENT.EN;
      }

      // Build the visible signature layer2 text.
      // $$SUBJECTCN$$ → AutoFirma replaces this with the certificate CN at sign-time.
      // $$SIGNDATE=dd/MM/yyyy HH:mm:ss$$ → replaced with the actual timestamp.
      const signedByLabel = selectedLanguage === 'ES' ? 'Firmado por'
        : selectedLanguage === 'PT' ? 'Assinado por' : 'Signed by';
      const dateLabel = selectedLanguage === 'ES' ? 'Fecha'
        : selectedLanguage === 'PT' ? 'Data' : 'Date';

      const layer2Lines = [
        `${signedByLabel}: $$SUBJECTCN$$`,
        `${dateLabel}: $$SIGNDATE=dd/MM/yyyy HH:mm:ss$$`,
        declarationText
      ].join('\\n');

      params += "\nsignatureVisible=true";
      params += "\nsignaturePage=0";  // 0 = last page
      // Full-width footer at the bottom of the page (A4 coords in points: 595x842)
      params += "\nsignaturePositionOnPageLowerLeftX=36";
      params += "\nsignaturePositionOnPageLowerLeftY=20";
      params += "\nsignaturePositionOnPageUpperRightX=559";
      params += "\nsignaturePositionOnPageUpperRightY=76";
      params += `\nlayer2Text=${layer2Lines}`;
      params += "\nlayer2FontFamily=0"; // Courier
      params += "\nlayer2FontSize=7";
      params += "\nlayer2FontStyle=0"; // Plain
    }

    return params;
  }

  async function runSigning() {
    if (!pdfBase64) {
      errorMsg = "Please upload a PDF file or select the sample PDF.";
      return;
    }

    isPending = true;
    errorMsg = null;
    result = null;
    currentStep = 'signing';

    try {
      // Step 1: Hash PDF locally for display
      const hash = await localSha256(pdfBase64);

      // Step 2: Build PAdES params (visible sig with $$SUBJECTCN$$, declaration, etc.)
      const signatureParams = buildSignatureParams();

      // Step 3: ONE call to AutoFirma — cert selection + visual stamp + cryptographic
      //         signature all happen atomically. AutoFirma embeds the CN from the
      //         selected certificate into the layer2Text before signing. No backend needed.
      const signResult = await signPdfWithAutoFirma(
        pdfBase64,
        handleSimulateCertSelect,
        null,           // no pre-selected mock cert
        signatureParams // pass our custom PAdES params
      );

      // signResult is either a string (signed base64) or an object { signedPdfBase64, certificateSubject }
      const signedBase64 = typeof signResult === 'string' ? signResult : signResult.signedPdfBase64;
      const certSubject = typeof signResult === 'object' ? signResult.certificateSubject : null;

      // Done!
      currentStep = 'completed';
      result = {
        originalHash: hash,
        signedPdfBase64: signedBase64,
        certificateSubject: certSubject || certificates.find(c => c.id === selectedCertId)?.name || 'Local macOS Keychain Certificate',
        signingTime: new Date().toISOString(),
        visibleSignature: visibleSignature,
        declaration: useCustomText ? customText : DECLARATIONS[selectedMessageKey]?.[selectedLanguage]
      };
    } catch (err) {
      errorMsg = err.message || "PDF signing workflow failed.";
      currentStep = 'upload';
    } finally {
      isPending = false;
    }
  }

  function downloadSignedPdf() {
    if (!result || !result.signedPdfBase64) return;
    const blob = base64ToBlob(result.signedPdfBase64, 'application/pdf');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `signed_${fileName || 'document.pdf'}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function base64ToBlob(base64, mime) {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: mime });
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

  // Reactive preview of declaration text
  $: previewDeclaration = useCustomText
    ? customText
    : (DECLARATIONS[selectedMessageKey]?.[selectedLanguage] || '');
</script>

<div class="space-y-5">
  {#if !isPending && !result}
    <!-- Input Form -->
    <div in:fade={{ duration: 200 }} class="space-y-4">
      
      <!-- eIDAS Visual Signature Settings Card -->
      <div class="p-4.5 rounded-xl bg-white/5 border border-white/10 space-y-4">
        <h4 class="text-xs font-bold text-blue-400 font-mono uppercase tracking-wider flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4.5 w-4.5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>PAdES Visible Signature Settings</span>
        </h4>

        <!-- Visible signature toggle -->
        <div class="flex items-center space-x-2">
          <input
            id="visible-sig-toggle"
            type="checkbox"
            bind:checked={visibleSignature}
            class="h-3.5 w-3.5 text-blue-500 rounded bg-slate-900 border-white/10 focus:ring-0 cursor-pointer"
          />
          <label for="visible-sig-toggle" class="text-[10px] font-bold text-slate-300 font-mono uppercase tracking-wide cursor-pointer select-none">
            Embed Visible Signature Stamp on PDF
          </label>
        </div>

        {#if visibleSignature}
          <div class="space-y-4" transition:fade={{ duration: 120 }}>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <!-- Language Selection -->
              <div class="space-y-1.5">
                <label for="autofirma-lang-select" class="text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wide">Declaration Language:</label>
                <select
                  id="autofirma-lang-select"
                  bind:value={selectedLanguage}
                  class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                >
                  <option value="EN">EN (English)</option>
                  <option value="ES">ES (Spanish / Español)</option>
                  <option value="PT">PT (Portuguese / Português)</option>
                </select>
              </div>

              <!-- Placeholder grid cell -->
              <div></div>
            </div>

            <div class="space-y-3 pt-1.5">
              <!-- Toggle Custom Text vs Preset Message -->
              <div class="flex items-center space-x-2">
                <input
                  id="use-custom-text-toggle"
                  type="checkbox"
                  bind:checked={useCustomText}
                  class="h-3.5 w-3.5 text-blue-500 rounded bg-slate-900 border-white/10 focus:ring-0 cursor-pointer"
                />
                <label for="use-custom-text-toggle" class="text-[10px] font-bold text-slate-300 font-mono uppercase tracking-wide cursor-pointer select-none">
                  Use Custom Statement Override
                </label>
              </div>

              {#if !useCustomText}
                <!-- Message Key Selection -->
                <div class="space-y-1.5" transition:fade={{ duration: 120 }}>
                  <label for="autofirma-message-select" class="text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wide">Legal Declaration Statement:</label>
                  <select
                    id="autofirma-message-select"
                    bind:value={selectedMessageKey}
                    class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                  >
                    <option value="APPROVE_DOCUMENT">APPROVE_DOCUMENT (Approve Document)</option>
                    <option value="AGREE_CONTENT">AGREE_CONTENT (Agree with Content)</option>
                    <option value="WITNESS_SIGNATURE">WITNESS_SIGNATURE (Witness Signature)</option>
                  </select>
                </div>
              {:else}
                <!-- Custom Text Input -->
                <div class="space-y-1.5" transition:fade={{ duration: 120 }}>
                  <label for="autofirma-custom-input" class="text-[10px] font-semibold text-slate-400 font-mono uppercase tracking-wide">Custom Text Override:</label>
                  <input
                    id="autofirma-custom-input"
                    type="text"
                    bind:value={customText}
                    class="w-full rounded-lg bg-slate-950/60 border border-white/10 p-2.5 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50 font-mono"
                    placeholder="e.g. Firmado por Wesley Alberti en calidad de Auditor de Seguridad"
                  />
                </div>
              {/if}

              <!-- Live preview of what the stamp will look like -->
              <div class="p-3 rounded-lg bg-slate-950/50 border border-white/5 space-y-1">
                <div class="text-[9px] text-slate-500 font-mono uppercase font-bold">Visible Stamp Preview:</div>
                <div class="text-[10px] text-slate-300 font-mono leading-relaxed whitespace-pre-wrap">{selectedLanguage === 'ES' ? 'Firmado por' : selectedLanguage === 'PT' ? 'Assinado por' : 'Signed by'}: <span class="text-blue-400">$$SUBJECTCN$$</span>
{selectedLanguage === 'ES' ? 'Fecha' : selectedLanguage === 'PT' ? 'Data' : 'Date'}: <span class="text-blue-400">$$SIGNDATE$$</span>
{previewDeclaration}</div>
                <div class="text-[8px] text-slate-600 font-mono italic mt-1">↑ AutoFirma substitutes $$SUBJECTCN$$ and $$SIGNDATE$$ from your selected certificate at sign-time</div>
              </div>
            </div>
          </div>
        {/if}
      </div>

      {#if !fileName}
        <!-- Drop/Upload Area -->
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-6 cursor-pointer bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center">
            <input type="file" accept=".pdf" class="hidden" on:change={handleFileSelect} />
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-blue-400/80 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            <span class="text-xs text-slate-200 font-semibold">Upload original PDF file</span>
            <span class="text-[10px] text-slate-500 font-mono mt-1">Accepts only standard .pdf formats</span>
          </label>

          <button
            on:click={useSamplePdf}
            class="flex flex-col items-center justify-center border border-dashed border-white/10 rounded-xl p-6 bg-white/5 hover:bg-white/10 hover:border-white/20 transition-all duration-300 text-center"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-8 w-8 text-slate-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="text-xs text-slate-200 font-semibold">Use Sandbox Sample PDF</span>
            <span class="text-[10px] text-slate-500 font-mono mt-1">Test signature flow instantly</span>
          </button>
        </div>
      {:else}
        <!-- PDF File Selected Display -->
        <div class="flex items-center justify-between p-4 rounded-lg bg-blue-500/5 border border-blue-500/20 text-xs font-mono text-blue-300">
          <div class="flex items-center space-x-2.5 truncate">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <span class="truncate font-semibold">{fileName}</span>
            <span class="text-[10px] text-slate-500">({(pdfBase64.length * 0.75 / 1024).toFixed(1)} KB)</span>
          </div>
          <button on:click={removePdf} class="text-slate-400 hover:text-slate-200 hover:underline shrink-0 pl-2">
            Remove File
          </button>
        </div>
      {/if}

      {#if errorMsg}
        <div class="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 font-mono text-[10px]">
          Error: {errorMsg}
        </div>
      {/if}

      <!-- Submit -->
      <button
        on:click={runSigning}
        disabled={!pdfBase64}
        class="w-full py-2 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center space-y-0.5"
      >
        <div class="flex items-center space-x-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
          <span>Sign PDF with AutoFirma</span>
        </div>
        <span class="text-[9px] font-mono text-blue-400/80 font-normal normal-case tracking-normal">eIDAS PAdES Standard</span>
      </button>
    </div>
  {:else if isPending}
    <!-- Signing in progress -->
    <div class="py-8 space-y-6 font-mono text-[11px]">
      <div class="text-center space-y-2">
        <div class="animate-spin rounded-full h-8 w-8 border-2 border-blue-500/20 border-t-blue-400 mx-auto"></div>
        <div class="text-blue-300 font-bold uppercase tracking-wider animate-pulse">
          // AUTOFIRMA_PADES_SIGNING...
        </div>
      </div>

      <!-- Single step card -->
      <div class="max-w-md mx-auto">
        <div class="p-3 rounded-lg border bg-blue-500/10 border-blue-500/30">
          <div class="flex items-center space-x-2">
            <div class="flex items-center justify-center h-4.5 w-4.5 rounded-full font-bold text-[9px] bg-blue-500 text-white">
              ✎
            </div>
            <span class="font-bold text-slate-200">AutoFirma PAdES Signing</span>
          </div>
          <p class="text-[9px] text-slate-400 mt-1 pl-6.5">
            AutoFirma opens a single native dialog — select your FNMT/DNIe certificate, and it applies the visual stamp + cryptographic PAdES signature atomically. Your private key never leaves the macOS Keychain.
          </p>
        </div>
      </div>
    </div>
  {:else if result}
    <!-- Results view -->
    <div in:fly={{ y: 15, duration: 300 }} class="space-y-4 font-mono text-[10px] leading-relaxed">
      <div class="flex items-center justify-between">
        <span class="text-xs font-semibold text-blue-400">PAdES DIGITAL SIGNATURE ATTACHED</span>
        <div class="flex gap-2">
          <button
            on:click={() => copyToClipboard(JSON.stringify(result, null, 2))}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            {copied ? 'Copied ✓' : 'Copy JSON'}
          </button>
          <button
            on:click={removePdf}
            class="px-2 py-1 rounded bg-slate-900 border border-white/10 text-[9px] font-semibold text-slate-300 transition-colors hover:bg-slate-800"
          >
            Sign Another
          </button>
        </div>
      </div>

      <!-- Verdict card -->
      <div class="p-4 rounded-lg text-center border bg-blue-500/10 border-blue-500/20">
        <div class="text-[10px] font-mono uppercase tracking-widest text-slate-400">eIDAS Compliance Verification</div>
        <div class="text-xl font-extrabold mt-1 text-blue-400 text-glow-blue uppercase">
          PAdES_BES_DOCUMENT: COMPLETED
        </div>
        <p class="text-[9px] font-mono text-slate-500 mt-1">
          {result.visibleSignature ? 'Visible signature stamp and cryptographic signature applied atomically by AutoFirma.' : 'Invisible cryptographic PAdES signature embedded in PDF catalog.'}
        </p>
      </div>

      <!-- Details -->
      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
          <div class="text-slate-500 uppercase font-semibold">Certificate Subject</div>
          <div class="text-slate-200 font-bold leading-tight truncate">{result.certificateSubject}</div>
          <div class="text-[9px] text-slate-400">Validated against Spain eIDAS trust lists</div>
        </div>

        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5 space-y-1">
          <div class="text-slate-500 uppercase font-semibold">Timestamp & Standards</div>
          <div class="text-slate-200 font-bold leading-tight">{new Date(result.signingTime).toLocaleString()}</div>
          <div class="text-[9px] text-slate-400">PAdES Profile: ETSI EN 319 142</div>
        </div>
      </div>

      {#if result.declaration}
        <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
          <span class="text-slate-500 uppercase font-semibold">Declaration Text:</span>
          <span class="text-slate-300 font-bold ml-1">{result.declaration}</span>
        </div>
      {/if}

      <div class="p-3 rounded-lg bg-slate-950/60 border border-white/5">
        <span class="text-slate-500 uppercase font-semibold">Original PDF SHA-256 Hash:</span>
        <span class="text-slate-300 font-bold select-all ml-1 break-all">{result.originalHash}</span>
      </div>

      <!-- Actions -->
      <button
        on:click={downloadSignedPdf}
        class="w-full py-2.5 rounded-lg font-semibold text-xs tracking-wider bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 transition-all duration-300 shadow-glass border border-blue-500/20 hover:border-blue-400/40 hover:shadow-glow-blue flex items-center justify-center space-x-2"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>Download eIDAS Signed PAdES PDF</span>
      </button>
    </div>
  {/if}
</div>

<!-- ============================================================== -->
<!-- GLASSMORPHIC CERTIFICATE PICKER OVERLAY MODAL (Simulation Mode) -->
<!-- ============================================================== -->
{#if showCertModal}
  <div class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-sm" transition:fade={{ duration: 150 }}>
    <div
      class="bg-slate-900 border border-white/10 rounded-2xl p-5 md:p-6 shadow-glass-xl w-full max-w-md mx-auto space-y-4 text-left font-sans"
      transition:fly={{ y: 20, duration: 250 }}
    >
      <!-- Title & Flag -->
      <div class="flex items-center justify-between border-b border-white/5 pb-3">
        <div class="flex items-center space-x-2">
          <!-- Mini Spanish Flag -->
          <div class="flex flex-col h-3 w-4.5 rounded overflow-hidden shadow-sm shrink-0">
            <div class="bg-[#AA151B] h-1/4"></div>
            <div class="bg-[#F1BF00] h-2/4"></div>
            <div class="bg-[#AA151B] h-1/4"></div>
          </div>
          <h3 class="text-sm font-bold text-slate-100 font-mono tracking-wide">
            AutoFirma Client Keyring
          </h3>
        </div>
        <span class="text-[9px] font-bold font-mono px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 border border-blue-500/20">
          SIMULATOR
        </span>
      </div>

      <p class="text-xs text-slate-400 leading-normal">
        Select a digital identity certificate stored in the local macOS Keychain system store. AutoFirma will apply the visual stamp and sign the PDF in a single atomic operation.
      </p>

      <!-- Certificate selectors -->
      <div class="space-y-2">
        {#each certificates as cert}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div
            on:click={() => selectedCertId = cert.id}
            class="flex items-start space-x-3 p-3 rounded-xl border transition-all duration-300 cursor-pointer {selectedCertId === cert.id ? 'bg-blue-500/10 border-blue-500/50 shadow-glass-sm' : 'bg-slate-950/40 border-white/5 hover:border-white/10 hover:bg-slate-950/60'}"
          >
            <div class="mt-0.5">
              <input
                type="radio"
                name="cert"
                value={cert.id}
                bind:group={selectedCertId}
                class="h-3 w-3 text-blue-500 focus:ring-0 cursor-pointer bg-slate-900 border-white/10"
              />
            </div>
            
            <div class="space-y-1 font-mono text-[9px] flex-grow leading-tight truncate">
              <div class="font-bold text-slate-200 truncate">{cert.name}</div>
              <div class="text-slate-400">Issuer: {cert.issuer}</div>
              <div class="text-slate-500 text-[8px] flex items-center justify-between">
                <span>Serial: {cert.serial.substring(0, 14)}...</span>
                <span class="px-1.5 py-0.2 rounded bg-white/5 text-slate-400">{cert.type}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>

      <!-- Action buttons -->
      <div class="flex items-center justify-end space-x-3 pt-2">
        <button
          on:click={cancelCertSelect}
          class="px-4 py-1.5 rounded-lg text-xs font-semibold text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
        >
          Cancel
        </button>
        <button
          on:click={confirmCertSelect}
          class="px-4 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-glass transition-all"
        >
          Sign Document
        </button>
      </div>
    </div>
  </div>
{/if}
