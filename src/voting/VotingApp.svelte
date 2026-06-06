<script>
  import { onMount, setContext } from 'svelte';
  import { writable } from 'svelte/store';
  import { backendStatus, checkBackendConnection } from '../services/api.js';
  
  // Views
  import CreateElection from './components/CreateElection.svelte';
  import CastBallot from './components/CastBallot.svelte';
  import AuditResults from './components/AuditResults.svelte';

  // Navigation store
  const currentPath = writable(window.location.pathname);
  
  // Expose routing context to child components
  setContext('router', {
    path: currentPath,
    navigate(path) {
      window.history.pushState({}, '', path);
      currentPath.set(path);
    }
  });

  // State derived from pathname
  let route = $state('create');
  let voteId = $state('');

  onMount(() => {
    // Check connection immediately and setup periodic check
    checkBackendConnection();
    const checkInterval = setInterval(checkBackendConnection, 15000);

    const handlePopState = () => {
      currentPath.set(window.location.pathname);
    };

    window.addEventListener('popstate', handlePopState);
    
    // Subscribe to path store changes to update route state
    const unsubscribe = currentPath.subscribe(path => {
      const voteMatch = path.match(/^\/vote\/([^/]+)/);
      if (voteMatch) {
        route = 'vote';
        voteId = voteMatch[1];
        return;
      }

      const resultsMatch = path.match(/^\/results\/([^/]+)/);
      if (resultsMatch) {
        route = 'results';
        voteId = resultsMatch[1];
        return;
      }

      route = 'create';
      voteId = '';
    });

    return () => {
      clearInterval(checkInterval);
      window.removeEventListener('popstate', handlePopState);
      unsubscribe();
    };
  });

  const currentYear = new Date().getFullYear();
</script>

<!-- Stellar Dark Outer Wrapper -->
<div class="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-slate-950 text-slate-100 z-10 font-sans">
  
  <!-- Glow Layer -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute top-[-15%] left-[5%] w-[35rem] md:w-[50rem] h-[35rem] md:h-[50rem] bg-indigo-600/5 rounded-full blur-[120px] md:blur-[180px] animate-blob-1"></div>
    <div class="absolute bottom-[-10%] right-[5%] w-[35rem] md:w-[50rem] h-[35rem] md:h-[50rem] bg-violet-600/5 rounded-full blur-[120px] md:blur-[180px] animate-blob-2"></div>
    
    <!-- Cyberpunk grid overlay -->
    <div class="absolute inset-0 bg-[linear-gradient(to_right,#ffffff02_1px,transparent_1px),linear-gradient(to_bottom,#ffffff02_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]"></div>
  </div>

  <!-- Content -->
  <div class="relative z-10 flex flex-col min-h-screen w-full">
    
    <!-- Top Navigation Header -->
    <header class="w-full border-b border-white/5 backdrop-blur-md bg-slate-950/60 sticky top-0 z-50">
      <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        
        <!-- Left: Branding -->
        <div class="flex items-center space-x-3">
          <a href="/" class="text-xs font-mono text-slate-400 hover:text-white transition-colors flex items-center space-x-1.5 group">
            <span class="transform group-hover:-translate-x-1 transition-transform inline-block">←</span>
            <span>Portfolio</span>
          </a>
          <span class="text-slate-700">|</span>
          <button onclick={() => window.history.pushState({}, '', '/voting') || currentPath.set('/voting')} class="flex items-center space-x-2 bg-transparent border-0 cursor-pointer p-0 text-left">
            <span class="text-lg">🗳️</span>
            <span class="font-bold tracking-tight bg-gradient-to-r from-white via-indigo-200 to-indigo-400 bg-clip-text text-transparent font-sans">EPH_VOTE</span>
          </button>
          <span class="hidden sm:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">ZKP_SCHNORR</span>
        </div>

        <!-- Right: Telemetry/Engine Status -->
        <div class="flex items-center space-x-2">
          {#if $backendStatus.online}
            <div class="flex items-center space-x-2 bg-emerald-500/5 border border-emerald-500/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.05)]">
              <span class="relative flex h-2 w-2">
                <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span class="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span class="text-[10px] sm:text-xs font-mono text-emerald-400 tracking-wider">ENGINE_ONLINE ({$backendStatus.ping}ms)</span>
            </div>
          {:else}
            <div class="flex items-center space-x-2 bg-amber-500/5 border border-amber-500/20 px-3 py-1 rounded-full shadow-[0_0_15px_rgba(245,158,11,0.05)]">
              <span class="relative flex h-2 w-2">
                <span class="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
              </span>
              <span class="text-[10px] sm:text-xs font-mono text-amber-400 tracking-wider">OFFLINE_SANDBOX</span>
            </div>
          {/if}
        </div>

      </div>
    </header>

    <!-- Main Content Area -->
    <main class="flex-grow w-full max-w-4xl mx-auto px-4 py-8 sm:py-12 flex flex-col justify-center">
      {#if route === 'create'}
        <CreateElection />
      {:else}
        <!-- Dynamic component mounting for cleaner parameters handling -->
        {#if route === 'vote'}
          <CastBallot {voteId} />
        {:else if route === 'results'}
          <AuditResults {voteId} />
        {/if}
      {/if}
    </main>

    <!-- Footer -->
    <footer class="w-full text-center py-6 border-t border-white/5 backdrop-blur-md bg-slate-950/40 mt-8">
      <div class="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between text-[11px] font-mono text-slate-500 gap-3">
        <div>
          &copy; {currentYear} Wesley Kalatai Alberti. All rights reserved.
        </div>
        <div class="flex items-center space-x-4">
          <span class="text-indigo-500/50">#ZERO_DATABASE</span>
          <span class="text-slate-800">|</span>
          <span>eIDAS_READY</span>
          <span class="text-slate-800">|</span>
          <span class="text-indigo-400">Cryptographically Auditable</span>
        </div>
      </div>
    </footer>

  </div>
</div>
