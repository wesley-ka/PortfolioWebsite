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
  
  // Import API state and stores
  import { checkBackendConnection, isBackendOnline, apiLogs, backendStatus } from '../services/api.js';

  // Navigation states: 'signing' | 'zkp' | 'vault' | 'certificate' | 'tsa'
  let activeModule = 'signing';
  let isOnline = false;
  let connInterval;

  // Telemetry inspector state
  let showTelemetry = false;
  let selectedLog = null;

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

      <!-- Connection Status indicator at sidebar bottom (clickable) -->
      <button
        on:click={() => showTelemetry = true}
        class="hidden lg:flex items-center space-x-2.5 pt-4 border-t border-white/5 mt-auto text-left group w-full cursor-pointer hover:bg-white/5 p-2 rounded-lg transition-all"
        aria-label="Inspect cryptographic engine telemetry"
      >
        <div class="relative flex h-2 w-2">
          {#if isOnline}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
          {:else}
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
          {/if}
        </div>
        <div class="flex-grow min-w-0">
          <span class="text-[9px] font-extrabold font-mono tracking-wider block truncate {isOnline ? 'text-blue-400' : 'text-amber-500'}">
            {isOnline ? 'SPRING BOOT: ONLINE' : 'OFFLINE FALLBACK'}
          </span>
          <span class="text-[8px] font-mono text-slate-500 group-hover:text-blue-400 transition-colors block mt-0.5">
            Click to inspect telemetry &rarr;
          </span>
        </div>
      </button>
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
          
          <!-- Mobile connection badge (clickable) -->
          <button
            on:click={() => showTelemetry = true}
            class="flex lg:hidden shrink-0 mt-0.5 cursor-pointer text-[8px] font-bold font-mono tracking-wider px-2.5 py-0.5 rounded border transition-colors {isOnline ? 'bg-blue-500/10 border-blue-500/20 hover:border-blue-400 text-blue-400' : 'bg-amber-500/10 border-amber-500/20 hover:border-amber-400 text-amber-500'}"
            aria-label="Inspect cryptographic engine telemetry"
          >
            {isOnline ? 'API: ONLINE' : 'FALLBACK'} &rarr;
          </button>
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
            class="text-xs font-semibold font-mono text-slate-400 hover:text-slate-100 bg-white/5 hover:bg-white/10 px-2.5 py-1 rounded border border-white/10 transition-colors"
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
                    class="text-[9px] font-mono text-slate-500 hover:text-red-400 transition-colors"
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
                      class="w-full p-2.5 rounded-lg border text-left font-mono text-[10px] transition-all flex flex-col space-y-1 relative overflow-hidden group {selectedLog?.id === log.id ? 'bg-blue-500/10 border-blue-500/30 text-blue-300 shadow-glass-sm' : 'bg-slate-950/60 border-white/5 hover:bg-white/5 hover:border-white/10 text-slate-300'}"
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
                    <div class="px-2.5 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-semibold text-slate-400">
                      Request Body (JSON)
                    </div>
                    <pre class="p-2.5 text-[9px] text-slate-300 overflow-x-auto max-h-[110px] leading-relaxed"><code>{JSON.stringify(selectedLog.payload, null, 2)}</code></pre>
                  </div>

                  <!-- Response payload -->
                  <div class="relative rounded border border-white/10 overflow-hidden bg-slate-950">
                    <div class="px-2.5 py-1 bg-slate-900 border-b border-white/5 text-[9px] font-semibold text-slate-400">
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
