<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade, fly } from 'svelte/transition';
  
  // Import sub-demos
  import SigningDemo from './demos/SigningDemo.svelte';
  import ZkpDemo from './demos/ZkpDemo.svelte';
  import VaultDemo from './demos/VaultDemo.svelte';
  import CertificateDemo from './demos/CertificateDemo.svelte';
  import TsaDemo from './demos/TsaDemo.svelte';
  import AutoFirmaDemo from './demos/AutoFirmaDemo.svelte';
  import QuantumDemo from './demos/QuantumDemo.svelte';
  import VcDemo from './demos/VcDemo.svelte';
  import LedgerDemo from './demos/LedgerDemo.svelte';
  
  // Import API state and stores
  import { checkBackendConnection, isBackendOnline, apiLogs, backendStatus } from '../services/api.js';

  // Navigation states: 'dashboard' | 'vc' | 'ledger' | 'signing' | 'zkp' | 'vault' | 'certificate' | 'tsa' | 'autofirma' | 'quantum'
  let activeModule = 'dashboard';
  let isOnline = false;
  let connInterval;

  // Telemetry inspector state
  let showTelemetry = false;
  let selectedLog = null;

  // Categorized List of modules
  const modules = [
    {
      id: 'vc',
      title: 'Verifiable Credentials Wallet',
      shortTitle: 'VC Wallet',
      category: 'identity',
      complexity: 'Advanced',
      desc: 'Issue signed W3C credentials with biometric scanning, then verify signatures over dynamic QR codes.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2v-3M18 8a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 119.9-1.1" /></svg>`
    },
    {
      id: 'zkp',
      title: 'Schnorr Age ZKP',
      shortTitle: 'ZKP',
      category: 'identity',
      complexity: 'Advanced',
      desc: 'Verify a Proof-of-Knowledge age assertion without disclosing the absolute secret birth year.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>`
    },
    {
      id: 'certificate',
      title: 'X.509 Certificate Parser',
      shortTitle: 'X.509',
      category: 'identity',
      complexity: 'Intermediate',
      desc: 'Decode DER-encoded X.509 citizen certificates, verify expiration, algorithms, and authority signatures.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>`
    },
    {
      id: 'ledger',
      title: 'Cryptographic Provenance Ledger',
      shortTitle: 'Provenance',
      category: 'ledger',
      complexity: 'Advanced',
      desc: 'Build secure audit trails for hardware assets, track previous hash linkages, and simulate DB tampering verification.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 0-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>`
    },
    {
      id: 'vault',
      title: 'AES-GCM Vault & Audit',
      shortTitle: 'Vault',
      category: 'ledger',
      complexity: 'Intermediate',
      desc: 'Encrypt sensitive documents using AES-256-GCM and log access events into a Merkle ledger.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
    },
    {
      id: 'tsa',
      title: 'RFC 3161 Timestamping',
      shortTitle: 'TSA',
      category: 'ledger',
      complexity: 'Intermediate',
      desc: 'Verify proof of document existence at a specific time by requesting sealed TSA tokens.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    },
    {
      id: 'quantum',
      title: 'Quantum-Safe Messages',
      shortTitle: 'PQC Msg',
      category: 'advanced',
      complexity: 'Advanced',
      desc: 'Encrypt and share messages using NIST ML-KEM-768 key encapsulation combined with AES-256-GCM symmetric encryption.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>`
    },
    {
      id: 'autofirma',
      title: 'eIDAS PDF AutoFirma',
      shortTitle: 'AutoFirma',
      category: 'advanced',
      complexity: 'Advanced',
      desc: 'Sign PDF documents using Spanish eIDAS-compliant local AutoFirma client and certificates Keychain.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`
    },
    {
      id: 'signing',
      title: 'ECDSA Sign & Verify',
      shortTitle: 'ECDSA',
      category: 'advanced',
      complexity: 'Basic',
      desc: 'Generate SHA-256 digests and sign using curves, then verify signatures against public key coordinates.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`
    }
  ];

  $: activeModuleData = modules.find(m => m.id === activeModule);

  async function checkConn() {
    isOnline = await checkBackendConnection();
  }

  onMount(() => {
    // Check for incoming quantum-safe message links or verifications
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'encrypt' || (window.location.hash && window.location.hash.includes('payload='))) {
      activeModule = 'quantum';
    } else if (params.has('vcUrl') || window.location.pathname.includes('/verify-vc')) {
      activeModule = 'vc';
    }

    // Run connection checker initially
    checkConn();
    
    // Check every 5 seconds
    connInterval = setInterval(checkConn, 5000);
  });

  onDestroy(() => {
    if (connInterval) clearInterval(connInterval);
  });
</script>

<div class="relative w-full rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-5 md:p-7 shadow-glass-lg overflow-hidden flex flex-col min-h-[550px]">
  <!-- Subtle decoration glows inside the card -->
  <div class="absolute -bottom-10 -left-10 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute -top-10 -right-10 w-44 h-44 bg-slate-700/5 rounded-full blur-3xl pointer-events-none"></div>

  {#if activeModule === 'dashboard'}
    <!-- CATEGORIZED DASHBOARD GRID -->
    <div in:fade={{ duration: 150 }} class="relative z-10 flex flex-col space-y-6 flex-grow">
      
      <!-- Dashboard Title & Connection Status -->
      <div class="flex flex-col md:flex-row md:items-center justify-between border-b border-white/5 pb-4 gap-3">
        <div>
          <h2 class="text-xl font-bold tracking-tight text-slate-100 font-sans">
            Cryptographic Engine Dashboard
          </h2>
          <p class="text-xs text-slate-400 mt-1">
            Explore advanced cryptographic engines, decentralized identity protocols, and verifiable ledger proof-of-concepts.
          </p>
        </div>
        
        <!-- Connection Status clickable badge -->
        <button
          on:click={() => showTelemetry = true}
          class="inline-flex items-center space-x-2.5 px-3 py-1.5 rounded-lg border bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 transition-all text-left cursor-pointer max-w-xs shrink-0"
          aria-label="Inspect cryptographic engine telemetry"
        >
          <div class="relative flex h-2.5 w-2.5">
            {#if isOnline}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
            {:else}
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
            {/if}
          </div>
          <div class="font-mono text-[9px] leading-tight">
            <span class="font-extrabold block tracking-wider {isOnline ? 'text-blue-400' : 'text-amber-500'}">
              {isOnline ? 'ENGINE: ONLINE (SPRING BOOT)' : 'ENGINE: LOCAL SIMULATOR'}
            </span>
            <span class="text-[8px] text-slate-500 font-normal">Click to inspect telemetry</span>
          </div>
        </button>
      </div>

      <!-- Categories Columns Grid -->
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        <!-- Category 1: Identity & Credentials -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2 border-b border-white/5 pb-2 h-[44px]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-purple-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <h3 class="text-xs font-bold text-slate-300 font-mono uppercase tracking-widest">Identity & Credentials</h3>
          </div>
          <div class="space-y-3">
            {#each modules.filter(m => m.category === 'identity') as mod}
              <button
                on:click={() => activeModule = mod.id}
                class="w-full text-left p-4 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-purple-500/30 transition-all duration-300 group flex flex-col justify-between min-h-[125px] cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(168,85,247,0.05)] hover:-translate-y-0.5"
              >
                <div class="space-y-1 w-full">
                  <div class="flex justify-between items-start w-full">
                    <span class="text-purple-400 bg-purple-500/10 p-1.5 rounded-lg">
                      {@html mod.icon}
                    </span>
                    <span class="px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-widest uppercase rounded bg-purple-500/20 text-purple-300 border border-purple-500/30 shadow-sm">
                      {mod.complexity}
                    </span>
                  </div>
                  <h4 class="text-xs font-bold text-slate-100 group-hover:text-purple-300 transition-colors font-sans pt-1">
                    {mod.title}
                  </h4>
                  <p class="text-[10px] text-slate-400 leading-relaxed font-sans line-clamp-2">
                    {mod.desc}
                  </p>
                </div>
                <div class="text-[8px] font-mono text-slate-500 group-hover:text-purple-400 transition-colors pt-2 border-t border-white/5 w-full flex items-center justify-between">
                  <span>REST API + CLIENT MOCK</span>
                  <span>Launch Sandbox &rarr;</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Category 2: Data Integrity & Ledgers -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2 border-b border-white/5 pb-2 h-[44px]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <h3 class="text-xs font-bold text-slate-300 font-mono uppercase tracking-widest">Integrity & Ledgers</h3>
          </div>
          <div class="space-y-3">
            {#each modules.filter(m => m.category === 'ledger') as mod}
              <button
                on:click={() => activeModule = mod.id}
                class="w-full text-left p-4 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-blue-500/30 transition-all duration-300 group flex flex-col justify-between min-h-[125px] cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(59,130,246,0.05)] hover:-translate-y-0.5"
              >
                <div class="space-y-1 w-full">
                  <div class="flex justify-between items-start w-full">
                    <span class="text-blue-400 bg-blue-500/10 p-1.5 rounded-lg">
                      {@html mod.icon}
                    </span>
                    <span class="px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-widest uppercase rounded bg-blue-500/20 text-blue-300 border border-blue-500/30 shadow-sm">
                      {mod.complexity}
                    </span>
                  </div>
                  <h4 class="text-xs font-bold text-slate-100 group-hover:text-blue-300 transition-colors font-sans pt-1">
                    {mod.title}
                  </h4>
                  <p class="text-[10px] text-slate-400 leading-relaxed font-sans line-clamp-2">
                    {mod.desc}
                  </p>
                </div>
                <div class="text-[8px] font-mono text-slate-500 group-hover:text-blue-400 transition-colors pt-2 border-t border-white/5 w-full flex items-center justify-between">
                  <span>REST API + CLIENT MOCK</span>
                  <span>Launch Sandbox &rarr;</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

        <!-- Category 3: Advanced Cryptography -->
        <div class="space-y-3">
          <div class="flex items-center space-x-2 border-b border-white/5 pb-2 h-[44px]">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
            <h3 class="text-xs font-bold text-slate-300 font-mono uppercase tracking-widest">Advanced Cryptography</h3>
          </div>
          <div class="space-y-3">
            {#each modules.filter(m => m.category === 'advanced') as mod}
              <button
                on:click={() => activeModule = mod.id}
                class="w-full text-left p-4 rounded-xl border border-white/5 bg-slate-900/40 hover:bg-slate-900/80 hover:border-emerald-500/30 transition-all duration-300 group flex flex-col justify-between min-h-[125px] cursor-pointer shadow-sm hover:shadow-[0_0_15px_rgba(16,185,129,0.05)] hover:-translate-y-0.5"
              >
                <div class="space-y-1 w-full">
                  <div class="flex justify-between items-start w-full">
                    <span class="text-emerald-400 bg-emerald-500/10 p-1.5 rounded-lg">
                      {@html mod.icon}
                    </span>
                    <span class="px-1.5 py-0.5 text-[8px] font-bold font-mono tracking-widest uppercase rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow-sm">
                      {mod.complexity}
                    </span>
                  </div>
                  <h4 class="text-xs font-bold text-slate-100 group-hover:text-emerald-300 transition-colors font-sans pt-1">
                    {mod.title}
                  </h4>
                  <p class="text-[10px] text-slate-400 leading-relaxed font-sans line-clamp-2">
                    {mod.desc}
                  </p>
                </div>
                <div class="text-[8px] font-mono text-slate-500 group-hover:text-emerald-400 transition-colors pt-2 border-t border-white/5 w-full flex items-center justify-between">
                  <span>{mod.id === 'quantum' ? 'POST-QUANTUM KEM' : 'REST API + CLIENT MOCK'}</span>
                  <span>Launch Sandbox &rarr;</span>
                </div>
              </button>
            {/each}
          </div>
        </div>

      </div>

    </div>
  {:else}
    <!-- ACTIVE MODULE SANDBOX WORKSPACE (FULL WIDTH) -->
    <div in:fade={{ duration: 150 }} class="relative z-10 flex flex-col space-y-4 flex-grow">
      
      <!-- Workspace Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-3 gap-3">
        <div class="flex items-center space-x-3 min-w-0">
          <!-- Back button -->
          <button
            on:click={() => { activeModule = 'dashboard'; }}
            class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 transition-all flex items-center space-x-1 cursor-pointer shrink-0"
          >
            <span>&larr; Back</span>
          </button>
          
          <div class="min-w-0">
            <div class="flex items-center space-x-1.5">
              <span class="text-[8px] font-bold font-mono text-blue-400 uppercase tracking-wider block">
                {activeModuleData.category === 'identity' ? 'Identity & Credentials' : activeModuleData.category === 'ledger' ? 'Data Integrity & Ledgers' : 'Advanced Cryptography'}
              </span>
              <span class="text-[7px] px-1 py-0.2 rounded font-mono font-bold bg-white/5 border border-white/10 text-slate-400">
                {activeModuleData.complexity}
              </span>
            </div>
            <h2 class="text-sm font-bold tracking-tight text-slate-100 font-sans mt-0.5 truncate leading-none">
              {activeModuleData.title}
            </h2>
          </div>
        </div>

        <!-- Category Dropdown to quickly switch tools -->
        <div class="flex items-center space-x-2 shrink-0">
          <label for="module-select" class="hidden sm:inline text-[8px] font-mono text-slate-500 uppercase">Engine:</label>
          <select
            id="module-select"
            bind:value={activeModule}
            class="bg-slate-950 border border-white/10 p-1.5 rounded text-[10px] text-slate-300 font-sans focus:outline-none focus:border-blue-500/50"
          >
            <optgroup label="Identity & Credentials">
              <option value="vc">Verifiable Credentials Wallet</option>
              <option value="zkp">Schnorr Age ZKP</option>
              <option value="certificate">X.509 Certificate Parser</option>
            </optgroup>
            <optgroup label="Data Integrity & Ledgers">
              <option value="ledger">Cryptographic Provenance Ledger</option>
              <option value="vault">AES-GCM Vault & Audit</option>
              <option value="tsa">RFC 3161 Timestamping</option>
            </optgroup>
            <optgroup label="Advanced Cryptography">
              <option value="quantum">Quantum-Safe Messages</option>
              <option value="autofirma">eIDAS PDF AutoFirma</option>
              <option value="signing">ECDSA Sign & Verify</option>
            </optgroup>
          </select>
          
          <!-- Telemetry inspect trigger -->
          <button
            on:click={() => showTelemetry = true}
            class="cursor-pointer text-[8px] font-bold font-mono tracking-wider px-2 py-1.5 rounded border border-white/10 bg-white/5 hover:bg-white/10 text-slate-400 transition-all flex items-center space-x-1 shrink-0"
            aria-label="Inspect cryptographic engine telemetry"
          >
            <span class="relative flex h-1.5 w-1.5 mr-0.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-1.5 w-1.5 bg-blue-500"></span>
            </span>
            <span>TELEMETRY</span>
          </button>
        </div>
      </div>

      <!-- Render active sub-demo component -->
      <div class="flex-grow">
        {#if activeModule === 'signing'}
          <div in:fade={{ duration: 150 }}>
            <SigningDemo />
          </div>
        {:else if activeModule === 'zkp'}
          <div in:fade={{ duration: 150 }}>
            <ZkpDemo />
          </div>
        {:else if activeModule === 'vault'}
          <div in:fade={{ duration: 150 }}>
            <VaultDemo />
          </div>
        {:else if activeModule === 'certificate'}
          <div in:fade={{ duration: 150 }}>
            <CertificateDemo />
          </div>
        {:else if activeModule === 'tsa'}
          <div in:fade={{ duration: 150 }}>
            <TsaDemo />
          </div>
        {:else if activeModule === 'autofirma'}
          <div in:fade={{ duration: 150 }}>
            <AutoFirmaDemo />
          </div>
        {:else if activeModule === 'quantum'}
          <div in:fade={{ duration: 150 }}>
            <QuantumDemo />
          </div>
        {:else if activeModule === 'vc'}
          <div in:fade={{ duration: 150 }}>
            <VcDemo />
          </div>
        {:else if activeModule === 'ledger'}
          <div in:fade={{ duration: 150 }}>
            <LedgerDemo />
          </div>
        {/if}
      </div>

    </div>
  {/if}

  <!-- Slide-in Telemetry Console Drawer -->
  {#if showTelemetry}
    <div
      transition:fly={{ x: 300, duration: 250 }}
      class="absolute inset-0 bg-slate-950/98 backdrop-blur-xl z-30 p-6 flex flex-col justify-between border-l border-white/10"
    >
      <div class="flex flex-col h-full overflow-hidden">
        <!-- Drawer Header -->
        <div class="flex justify-between items-center border-b border-white/10 pb-3.5 mb-4 shrink-0">
          <div class="flex items-center space-x-2">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
            </svg>
            <h3 class="text-sm font-extrabold font-mono text-blue-400 tracking-wider">
              CRYPTOGRAPHIC ENGINE TELEMETRY
            </h3>
          </div>
          <button
            on:click={() => { showTelemetry = false; selectedLog = null; }}
            class="text-xs font-semibold font-mono text-slate-400 hover:text-slate-100 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/10 transition-colors cursor-pointer"
          >
            ESC / CLOSE [X]
          </button>
        </div>

        <!-- Telemetry Main Body (Scrollable) -->
        <div class="flex-grow overflow-y-auto space-y-5 pr-1 scrollbar-thin">
          
          <!-- Connection and Stats Summary Grid -->
          <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div class="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
              <span class="text-[9px] font-bold font-mono text-slate-500 uppercase">Engine Health Check</span>
              <div class="flex items-center space-x-2 mt-1">
                <span class="flex h-2 w-2 relative">
                  {#if $backendStatus.online}
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                  {:else}
                    <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                    <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                  {/if}
                </span>
                <span class="text-xs font-bold font-mono {$backendStatus.online ? 'text-blue-400' : 'text-amber-500'}">
                  {$backendStatus.online ? 'SPRING_BOOT: ONLINE' : 'OFFLINE_FALLBACK'}
                </span>
              </div>
            </div>
            
            <div class="p-3 rounded-lg bg-slate-900/60 border border-white/5 space-y-1">
              <span class="text-[9px] font-bold font-mono text-slate-500 uppercase">Health Ping Latency</span>
              <div class="text-xs font-bold font-mono text-slate-300 mt-1">
                {$backendStatus.ping !== null ? `${$backendStatus.ping} ms` : 'N/A (Simulated)'}
              </div>
            </div>
          </div>

          <!-- Documentation Schema Section -->
          <div class="p-3 rounded-lg bg-slate-900/40 border border-white/5 space-y-2.5">
            <span class="text-[10px] font-bold font-mono text-slate-400 uppercase tracking-wider block">
              Cryptographic Schema & Primitives
            </span>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-[10px] font-mono text-slate-500">
              <div class="flex items-center justify-between p-1.5 rounded bg-slate-950/40 border border-white/5">
                <span class="text-slate-400">ECDSA Sign & Verify:</span>
                <span class="text-slate-300">Curve secp256r1 (SHA-256)</span>
              </div>
              <div class="flex items-center justify-between p-1.5 rounded bg-slate-950/40 border border-white/5">
                <span class="text-slate-400">Zero Knowledge (ZKP):</span>
                <span class="text-slate-300">Schnorr Proof-of-Knowledge</span>
              </div>
              <div class="flex items-center justify-between p-1.5 rounded bg-slate-950/40 border border-white/5">
                <span class="text-slate-400">Document Vault Crypt:</span>
                <span class="text-slate-300">AES-256-GCM (Auth Tag verified)</span>
              </div>
              <div class="flex items-center justify-between p-1.5 rounded bg-slate-950/40 border border-white/5">
                <span class="text-slate-400">Timestamping (TSA):</span>
                <span class="text-slate-300">RFC 3161 Standard Tokens</span>
              </div>
            </div>
          </div>

          <!-- Split layout: Logs list vs Selected Inspect Pane -->
          <div class="grid grid-cols-1 lg:grid-cols-12 gap-4">
            
            <!-- Log List Pane (Left/Center) -->
            <div class="lg:col-span-6 space-y-2">
              <div class="flex items-center justify-between">
                <span class="text-[10px] font-bold font-mono text-slate-400 uppercase">
                  Session Log Feed ({$apiLogs.length})
                </span>
                {#if $apiLogs.length > 0}
                  <button
                    on:click={() => apiLogs.set([])}
                    class="text-[9px] font-mono text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
                  >
                    Clear Logs
                  </button>
                {/if}
              </div>

              {#if $apiLogs.length === 0}
                <div class="p-8 text-center rounded-lg border border-white/5 bg-slate-950/60 font-mono text-xs text-slate-600">
                  No requests logged this session.<br/>
                  <span class="text-[10px]">Execute any demo tab module to record REST API calls.</span>
                </div>
              {:else}
                <div class="space-y-1.5 max-h-[260px] overflow-y-auto pr-1.5 scrollbar-thin">
                  {#each $apiLogs as log (log.id)}
                    <button
                      on:click={() => selectedLog = log}
                      class="w-full p-2.5 rounded-lg border text-left font-mono text-[10px] transition-all flex flex-col space-y-1 relative overflow-hidden group cursor-pointer {selectedLog?.id === log.id ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-glass-sm' : 'bg-slate-950/60 border-white/5 hover:bg-white/5 hover:border-white/10 text-slate-300'}"
                    >
                      <div class="flex items-center justify-between">
                        <span class="font-extrabold uppercase text-[9px] px-1.5 py-0.5 rounded {log.online ? 'bg-blue-500/15 text-blue-400' : 'bg-amber-500/15 text-amber-400'}">
                          {log.online ? 'SPRING_BOOT' : 'FALLBACK'}
                        </span>
                        <span class="text-slate-500 text-[8px]">
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <div class="flex items-center justify-between">
                        <span class="font-semibold text-slate-300 truncate max-w-[150px]">{log.method} {log.path}</span>
                        <span class="font-extrabold {log.status === 200 || log.status === 'FALLBACK_OK' ? 'text-blue-400' : 'text-red-400'}">
                          {log.status}
                        </span>
                      </div>
                      <div class="flex items-center justify-between text-[8px] text-slate-500 pt-0.5 border-t border-white/5">
                        <span>Latency: {log.latency}ms</span>
                        <span class="group-hover:text-blue-400 transition-colors text-[9px]">Inspect Payload &rarr;</span>
                      </div>
                    </button>
                  {/each}
                </div>
              {/if}
            </div>

            <!-- Inspect Payload Pane (Right) -->
            <div class="lg:col-span-6 space-y-2">
              <span class="text-[10px] font-bold font-mono text-slate-400 uppercase block">
                Payload Inspector
              </span>
              
              {#if !selectedLog}
                <div class="p-8 text-center rounded-lg border border-dashed border-white/10 bg-slate-950/40 font-mono text-[10px] text-slate-600 h-[260px] flex items-center justify-center">
                  Select a request from the session feed to view request/response bodies and execution parameters.
                </div>
              {:else}
                <div class="space-y-3 max-h-[300px] overflow-y-auto pr-1 scrollbar-thin font-mono text-[10px]">
                  
                  <!-- Endpoint summary in details -->
                  <div class="p-2.5 rounded bg-slate-900 border border-white/5 space-y-1">
                    <div>Endpoint: <span class="text-blue-400 font-bold">{selectedLog.path}</span></div>
                    <div>Method: <span class="text-slate-300">{selectedLog.method}</span></div>
                    <div>Latency: <span class="text-slate-300">{selectedLog.latency} ms</span></div>
                    <div>Status: <span class="text-blue-400 font-bold">{selectedLog.status}</span></div>
                  </div>

                  <!-- Request payload -->
                  <div class="relative rounded border border-white/10 overflow-hidden bg-slate-950">
                    <div class="px-2.5 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-semibold text-slate-400 font-mono">
                      Request Body (JSON)
                    </div>
                    <pre class="p-2.5 text-[9px] text-slate-300 overflow-x-auto max-h-[110px] leading-relaxed"><code>{JSON.stringify(selectedLog.payload, null, 2)}</code></pre>
                  </div>

                  <!-- Response payload -->
                  <div class="relative rounded border border-white/10 overflow-hidden bg-slate-950">
                    <div class="px-2.5 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-semibold text-slate-400 font-mono">
                      Response Data (JSON)
                    </div>
                    <pre class="p-2.5 text-[9px] text-slate-300 overflow-x-auto max-h-[110px] leading-relaxed"><code>{JSON.stringify(selectedLog.response, null, 2)}</code></pre>
                  </div>

                </div>
              {/if}

            </div>

          </div>

        </div>
      </div>
    </div>
  {/if}
</div>
