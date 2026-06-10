<script>
  import { onMount } from 'svelte';
  import Header from './components/Header.svelte';
  import MinimalCV from './components/MinimalCV.svelte';
  import CryptoDemo from './components/CryptoDemo.svelte';
  import LiveChat from './components/LiveChat.svelte';
  import GreetingCard from './components/GreetingCard.svelte';

  const currentYear = new Date().getFullYear();
  let isVerifyRoute = $state(false);
  let isConnectRoute = $state(false);

  onMount(() => {
    isVerifyRoute = window.location.pathname.includes('/verify-vc');
    isConnectRoute = ['/connect', '/hi', '/hello'].some(path => window.location.pathname.includes(path));
  });

  function handleExplorePortfolio() {
    isConnectRoute = false;
    window.history.pushState({}, '', '/');
  }
</script>

<!-- Main outer container with dark backdrop -->
<div class="relative min-h-screen flex flex-col justify-between overflow-x-hidden bg-slate-950 text-slate-100 z-10">

  <!-- Glowing Interactive Canvas Background -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <!-- Top left space-blue glow -->
    <div class="absolute top-[-10%] left-[-10%] md:top-[5%] md:left-[10%] w-[30rem] md:w-[45rem] h-[30rem] md:h-[45rem] bg-blue-500/5 rounded-full blur-[100px] md:blur-[150px] animate-blob-1 pointer-events-none"></div>
    <!-- Bottom right slate-gray glow -->
    <div class="absolute bottom-[-10%] right-[-10%] md:bottom-[5%] md:right-[5%] w-[30rem] md:w-[50rem] h-[30rem] md:h-[50rem] bg-slate-700/5 rounded-full blur-[110px] md:blur-[160px] animate-blob-2 pointer-events-none"></div>
  </div>

  <!-- Content Layer -->
  <div class="relative z-10 flex flex-col min-h-screen w-full">

    {#if isConnectRoute}
      <GreetingCard onExplore={handleExplorePortfolio} />
    {:else}
      <!-- Top navigation header -->
      <Header />

      <!-- Main Content Area -->
      <main class="flex-grow w-full max-w-7xl mx-auto px-4 py-8 md:py-12 md:px-8 lg:px-12 flex flex-col justify-center">

        <!-- Grid Layout: Left sidebar (CV) and Right / Center (Demo) -->
        <div class="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

          {#if !isVerifyRoute}
            <!-- MINIMAL CV (Left side) -->
            <div class="lg:col-span-5 order-2 lg:order-1">
              <MinimalCV />

              <!-- Subtle system metadata footer below CV -->
              <div class="mt-6 px-2 text-[10px] font-mono text-slate-600 space-y-1">
                <div class="flex items-center space-x-1.5">
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-500/40"></span>
                  <span>NODE_STATUS: ONLINE_SECURE</span>
                </div>
                <div>PROVER_SYSTEM: GROTH16_CIRCOM</div>
                <div>LEDGER_PROTOCOL: DLT_CONSENSUS_V1</div>
              </div>
            </div>
          {/if}

          <!-- HERO & LIVE CRYPTO DEMO (Right/Center focal point) -->
          <div class="{isVerifyRoute ? 'lg:col-span-12' : 'lg:col-span-7'} order-1 lg:order-2 space-y-6 w-full">
            {#if !isVerifyRoute}
              <!-- Intro / Hero Callout -->
              <div class="space-y-3 px-1">
                <div class="inline-flex items-center space-x-2 text-xs font-mono tracking-widest text-blue-400 uppercase">
                  <span>[ DEMO_SANDBOX ]</span>
                </div>
                <h2 class="text-3xl md:text-4xl font-extrabold tracking-tight bg-gradient-to-r from-slate-100 via-slate-200 to-slate-400 bg-clip-text text-transparent font-sans">
                  Cryptographic Proof-of-Concept
                </h2>
                <p class="text-sm md:text-base text-slate-400 max-w-xl leading-relaxed">
                  Interact with a hybrid cryptographic sandbox. Cryptographic signing, zero-knowledge proofs, and secure vault operations run on a live Spring Boot backend with automatic browser-side Web Crypto fallbacks.
                </p>
              </div>
            {/if}

            <!-- Central Glass Demo Card -->
            <CryptoDemo />
          </div>

        </div>

      </main>

      <!-- Footer -->
      <footer class="w-full text-center py-6 border-t border-white/5 backdrop-blur-md bg-slate-950/40 mt-8">
        <div class="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between text-[11px] font-mono text-slate-500 gap-3">
          <div>
            &copy; {currentYear} Wesley Kalatai Alberti. All rights reserved.
          </div>
          <div class="text-[10px] text-slate-600 text-center select-none">
            [ Simulated records and credentials are automatically purged after 7 days ]
          </div>
          <div class="flex items-center space-x-4">
            <span>SECURED_BY_AES_256</span>
            <span class="text-slate-700">|</span>
            <span class="text-slate-400 hover:text-blue-400 transition-colors cursor-pointer">Security Audited</span>
          </div>
        </div>
      </footer>
    {/if}

  </div>
</div>

<!-- Live Chat Widget -->
{#if !isConnectRoute}
  <LiveChat />
{/if}
