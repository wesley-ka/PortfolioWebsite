<script>
  import { onMount, onDestroy } from 'svelte';
  import { fade } from 'svelte/transition';
  
  // Import sub-demos
  import SigningDemo from './demos/SigningDemo.svelte';
  import ZkpDemo from './demos/ZkpDemo.svelte';
  import VaultDemo from './demos/VaultDemo.svelte';
  import CertificateDemo from './demos/CertificateDemo.svelte';
  import TsaDemo from './demos/TsaDemo.svelte';
  import AutoFirmaDemo from './demos/AutoFirmaDemo.svelte';
  
  // Import API state
  import { checkBackendConnection, isBackendOnline } from '../services/api.js';

  // Navigation states: 'signing' | 'zkp' | 'vault' | 'certificate' | 'tsa'
  let activeModule = 'signing';
  let isOnline = false;
  let connInterval;

  // List of modules for loop rendering
  const modules = [
    {
      id: 'signing',
      title: 'ECDSA Sign & Verify',
      shortTitle: 'ECDSA',
      desc: 'Generate SHA-256 digests and sign using curves, then verify signatures against public key coordinates.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>`
    },
    {
      id: 'zkp',
      title: 'Schnorr Age ZKP',
      shortTitle: 'ZKP',
      desc: 'Verify a Proof-of-Knowledge age assertion without disclosing the absolute secret birth year.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>`
    },
    {
      id: 'vault',
      title: 'AES-GCM Vault & Audit',
      shortTitle: 'Vault',
      desc: 'Encrypt sensitive documents using AES-256-GCM and log access events into a Merkle ledger.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>`
    },
    {
      id: 'certificate',
      title: 'X.509 Certificate Parser',
      shortTitle: 'X.509',
      desc: 'Decode DER-encoded X.509 citizen certificates, verify expiration, algorithms, and authority signatures.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>`
    },
    {
      id: 'tsa',
      title: 'RFC 3161 Timestamping',
      shortTitle: 'TSA',
      desc: 'Verify proof of document existence at a specific time by requesting sealed TSA tokens.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>`
    },
    {
      id: 'autofirma',
      title: 'eIDAS PDF AutoFirma',
      shortTitle: 'AutoFirma',
      desc: 'Sign PDF documents using Spanish eIDAS-compliant local AutoFirma client and certificates Keychain.',
      icon: `<svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>`
    }
  ];

  $: activeModuleData = modules.find(m => m.id === activeModule);

  async function checkConn() {
    isOnline = await checkBackendConnection();
  }

  onMount(() => {
    // Run connection checker initially
    checkConn();
    
    // Check every 5 seconds
    connInterval = setInterval(checkConn, 5000);
  });

  onDestroy(() => {
    if (connInterval) clearInterval(connInterval);
  });
</script>

<div class="relative w-full rounded-2xl bg-white/5 backdrop-blur-md border border-white/10 p-6 md:p-8 shadow-glass-lg overflow-hidden flex flex-col min-h-[520px]">
  <!-- Subtle decoration glows inside the card -->
  <div class="absolute -bottom-10 -left-10 w-44 h-44 bg-blue-500/5 rounded-full blur-3xl pointer-events-none"></div>
  <div class="absolute -top-10 -right-10 w-44 h-44 bg-slate-700/5 rounded-full blur-3xl pointer-events-none"></div>

  <!-- Layout: Grid wrapper for Dashboard -->
  <div class="relative z-10 flex flex-col lg:grid lg:grid-cols-12 gap-6 h-full flex-grow">
    
    <!-- LEFT SIDEBAR: Navigtion controls -->
    <div class="lg:col-span-4 flex flex-col space-y-4 border-b lg:border-b-0 lg:border-r border-white/5 pb-4 lg:pb-0 lg:pr-4">
      <div class="hidden lg:block space-y-1">
        <h3 class="text-[10px] font-bold text-slate-500 uppercase tracking-widest font-mono">
          Engine Modules
        </h3>
        <p class="text-[9px] text-slate-600 font-mono">
          ENDPOINT: :8080/api/v1
        </p>
      </div>

      <!-- Module Selection Buttons (Vertical on desktop, horizontal scroll on mobile) -->
      <nav class="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 scrollbar-none">
        {#each modules as mod}
          <button
            on:click={() => activeModule = mod.id}
            class="flex items-center space-x-2.5 px-3 py-2 rounded-lg text-xs font-semibold tracking-wide transition-all duration-300 shrink-0 text-left w-auto lg:w-full border {activeModule === mod.id ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-glass-sm' : 'bg-transparent border-transparent text-slate-400 hover:text-slate-200 hover:bg-white/5'}"
          >
            <!-- Render raw HTML icon -->
            <span class="{activeModule === mod.id ? 'text-blue-400' : 'text-slate-500'}">
              {@html mod.icon}
            </span>
            <span class="hidden lg:inline">{mod.title}</span>
            <span class="inline lg:hidden">{mod.shortTitle}</span>
          </button>
        {/each}
      </nav>

      <!-- Connection Status indicator at sidebar bottom (hidden on mobile) -->
      <div class="hidden lg:flex items-center space-x-2 pt-4 border-t border-white/5 mt-auto">
        <div class="relative flex h-2 w-2">
          {#if isOnline}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          {:else}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          {/if}
        </div>
        <span class="text-[9px] font-bold font-mono tracking-wider {isOnline ? 'text-blue-400' : 'text-amber-500'}">
          {isOnline ? 'SPRING BOOT: ONLINE' : 'SIMULATION MODE (OFFLINE)'}
        </span>
      </div>
    </div>

    <!-- RIGHT MAIN WINDOW: Selected module display -->
    <div class="lg:col-span-8 flex flex-col justify-between min-h-[360px] lg:pl-2">
      <div class="space-y-4">
        <!-- Dashboard Header Info -->
        <div class="flex items-start justify-between gap-4 border-b border-white/5 pb-3">
          <div>
            <h2 class="text-lg font-bold tracking-tight text-slate-100 font-sans">
              {activeModuleData.title}
            </h2>
            <p class="text-[11px] text-slate-400 mt-1 leading-normal">
              {activeModuleData.desc}
            </p>
          </div>
          
          <!-- Mobile connection badge -->
          <div class="flex lg:hidden shrink-0 mt-0.5">
            <span class="text-[8px] font-bold font-mono tracking-wider px-2 py-0.5 rounded border {isOnline ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 text-amber-500'}">
              {isOnline ? 'API: ONLINE' : 'SIMULATION'}
            </span>
          </div>
        </div>

        <!-- Render active sub-demo with transition -->
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
          {/if}
        </div>
      </div>
    </div>

  </div>
</div>
