<script>
  import { onMount } from 'svelte';

  // Svelte 5 Props
  let { onExplore } = $props();

  let message = $state('');
  let phone = $state('');
  let email = $state('');
  let status = $state('idle'); // idle | sending | sent | error
  let statusText = $state('');
  let showQrModal = $state(false);
  let pageUrl = $state('');

  onMount(() => {
    // Dynamically grab the current URL so the QR code matches where it's deployed
    pageUrl = window.location.href;
  });

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (!message.trim() || !email.trim()) return;

    status = 'sending';
    statusText = 'Encrypting & sending...';

    try {
      const res = await fetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          phone: phone.trim() || undefined,
          email: email.trim(),
        }),
      });

      const data = await res.json();

      if (data.ok) {
        status = 'sent';
        statusText = 'Message delivered successfully!';
        message = '';
        phone = '';
        email = '';
        setTimeout(() => {
          status = 'idle';
          statusText = '';
        }, 5000);
      } else {
        status = 'error';
        statusText = data.error || 'Transmission failed.';
      }
    } catch {
      status = 'error';
      statusText = 'Secure channel connection error.';
    }
  }

  function downloadVCard() {
    const originUrl = window.location.origin;
    const vcard = [
      'BEGIN:VCARD',
      'VERSION:3.0',
      'FN:Wesley Kalatai Alberti',
      'N:Alberti;Wesley;Kalatai;;',
      'TITLE:Senior Full Stack Developer (Security & Cryptography)',
      'ORG:Akkodis',
      'EMAIL;TYPE=INTERNET;TYPE=WORK:wesley@awka.dev',
      'URL;TYPE=WORK:' + originUrl,
      'URL;TYPE=LINKEDIN:https://www.linkedin.com/in/wesleykalataialberti',
      'URL;TYPE=GITHUB:https://github.com/wesley-ka',
      'REV:' + new Date().toISOString().replace(/[:.-]/g, ''),
      'END:VCARD'
    ].join('\r\n');

    const blob = new Blob([vcard], { type: 'text/vcard;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'Wesley_Alberti.vcf');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function toggleQrModal() {
    showQrModal = !showQrModal;
  }
</script>

<div class="w-full max-w-md mx-auto px-4 py-6 md:py-10 flex flex-col justify-center min-h-[calc(100vh-8rem)]">
  <!-- Glowing Interactive Background aura just for card page -->
  <div class="absolute inset-0 overflow-hidden pointer-events-none z-0">
    <div class="absolute top-[25%] left-[50%] -translate-x-1/2 w-[22rem] h-[22rem] bg-blue-500/10 rounded-full blur-[90px] pointer-events-none"></div>
  </div>

  <!-- Profile Glass Card -->
  <div class="relative z-10 w-full rounded-3xl bg-slate-900/70 backdrop-blur-xl border border-white/10 p-6 md:p-8 shadow-2xl flex flex-col justify-between overflow-hidden animate-fade-in">
    <!-- Top Monogram & Status -->
    <div class="flex justify-between items-center mb-6">
      <div class="relative flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-blue-500/15 to-slate-800/40 border border-white/10 text-blue-400 font-extrabold text-xl shadow-glass-sm tracking-wider font-mono select-none">
        WA
        <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-slate-950"></span>
        </span>
      </div>
      <span class="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-mono text-emerald-400">
        <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>AVAILABLE NOW</span>
      </span>
    </div>

    <!-- Identity details -->
    <div class="space-y-2 mb-6">
      <h2 class="text-2xl md:text-3xl font-bold text-slate-100 font-sans tracking-tight">
        Wesley Kalatai Alberti
      </h2>
      <p class="text-xs font-mono text-blue-400 tracking-wider">
        Software Engineer | Fullstack | Security
      </p>
      <div class="flex flex-wrap gap-1.5 pt-2">
        <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-white/5">M.Sc. Cybersecurity</span>
        <span class="text-[9px] font-mono px-2 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-white/5">M.Sc. Software Engineering</span>
      </div>
    </div>

    <!-- Messaging form (Visible immediately on phone) -->
    <div class="border-t border-white/5 pt-5 mb-6">
      <h3 class="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 flex items-center space-x-1.5">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <span>Send Secure Message</span>
      </h3>

      {#if status === 'sent'}
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-2 bg-emerald-950/20 border border-emerald-500/20 rounded-xl animate-fade-in p-4">
          <div class="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p class="text-sm text-slate-200 font-semibold">{statusText}</p>
          <p class="text-xs text-slate-400">I will get back to you shortly at the email provided.</p>
        </div>
      {:else}
        <form onsubmit={handleFormSubmit} class="space-y-3">
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label for="meet-email" class="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                Email <span class="text-red-400">*</span>
              </label>
              <input
                id="meet-email"
                type="email"
                bind:value={email}
                placeholder="your.email@domain.com"
                required
                disabled={status === 'sending'}
                class="w-full px-3 py-2 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
            </div>
            <div>
              <label for="meet-phone" class="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                Phone <span class="text-slate-600">(optional)</span>
              </label>
              <input
                id="meet-phone"
                type="tel"
                bind:value={phone}
                placeholder="+1 234 567 890"
                disabled={status === 'sending'}
                class="w-full px-3 py-2 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label for="meet-message" class="block text-[9px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              Message <span class="text-red-400">*</span>
            </label>
            <textarea
              id="meet-message"
              bind:value={message}
              placeholder="Hey Wesley, let's catch up and talk about..."
              rows="3"
              required
              disabled={status === 'sending'}
              class="w-full px-3 py-2 rounded-xl bg-slate-950/40 border border-white/5 text-xs text-slate-200 placeholder-slate-700 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-50"
            ></textarea>
          </div>

          {#if status === 'error'}
            <p class="text-xs text-red-400 flex items-center space-x-1 animate-pulse">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{statusText}</span>
            </p>
          {/if}

          <button
            type="submit"
            disabled={status === 'sending' || !message.trim() || !email.trim()}
            class="w-full py-2.5 rounded-xl bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/15 hover:shadow-blue-400/25 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center justify-center space-x-2"
          >
            {#if status === 'sending'}
              <svg class="animate-spin h-3.5 w-3.5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>{statusText}</span>
            {:else}
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
              <span>Transmit Message</span>
            {/if}
          </button>
        </form>
      {/if}
    </div>

    <!-- Actions & Networking -->
    <div class="border-t border-white/5 pt-5 space-y-3">
      <div class="grid grid-cols-2 gap-3">
        <!-- Save Contact Button -->
        <button
          onclick={downloadVCard}
          class="flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 hover:border-blue-500/50 text-blue-300 hover:text-blue-200 text-xs font-semibold shadow-glass-sm transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
          </svg>
          <span>Save Contact</span>
        </button>

        <!-- Share Card (QR Code) Button -->
        <button
          onclick={toggleQrModal}
          class="flex items-center justify-center space-x-1.5 py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-slate-300 hover:text-slate-200 text-xs font-semibold shadow-glass-sm transition-all cursor-pointer"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <span>Share Card</span>
        </button>
      </div>

      <!-- Explore Portfolio Redirect -->
      <button
        onclick={onExplore}
        class="w-full flex items-center justify-center space-x-1.5 py-2.5 rounded-xl bg-gradient-to-r from-slate-800 to-slate-900 hover:from-slate-700 hover:to-slate-800 border border-white/5 text-slate-400 hover:text-slate-200 text-xs font-medium transition-all cursor-pointer"
      >
        <span>Explore Full Portfolio</span>
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
        </svg>
      </button>

      <!-- Social Profiles -->
      <div class="flex justify-center space-x-4 pt-2">
        <a
          href="https://www.linkedin.com/in/wesleykalataialberti"
          target="_blank"
          rel="noreferrer"
          class="p-2 rounded-lg bg-slate-850 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 text-slate-500 hover:text-blue-400 transition-all"
          aria-label="LinkedIn"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
          </svg>
        </a>
        <a
          href="https://github.com/wesley-ka"
          target="_blank"
          rel="noreferrer"
          class="p-2 rounded-lg bg-slate-850 hover:bg-blue-500/10 border border-white/5 hover:border-blue-500/20 text-slate-500 hover:text-blue-450 transition-all"
          aria-label="GitHub"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.75.4-1.25.72-1.54-2.21-.25-4.55-1.1-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z" />
          </svg>
        </a>
      </div>
    </div>
  </div>
</div>

<!-- QR Code Modal Dialog -->
{#if showQrModal}
  <!-- Backdrop -->
  <div
    onclick={toggleQrModal}
    onkeydown={(e) => { if (e.key === 'Escape' || e.key === 'Enter') toggleQrModal(); }}
    role="button"
    tabindex="0"
    class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md animate-fade-in p-4 cursor-pointer"
  >
    <!-- Modal Content -->
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="qr-title"
      tabindex="-1"
      onclick={(e) => e.stopPropagation()}
      onkeydown={(e) => e.stopPropagation()}
      class="relative w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900 p-6 text-center shadow-2xl animate-scale-in cursor-default"
    >
      <button
        onclick={toggleQrModal}
        class="absolute top-4 right-4 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer"
        aria-label="Close QR Modal"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      <div class="space-y-4">
        <div>
          <h3 id="qr-title" class="text-lg font-bold text-slate-100">Scan QR Code</h3>
          <p class="text-[10px] font-mono text-blue-400 tracking-wider">SHARE_PORTFOLIO_LINK</p>
        </div>

        <!-- High contrast QR code frame -->
        <div class="mx-auto w-64 h-64 bg-white p-4 rounded-2xl flex items-center justify-center shadow-inner select-none">
          {#if pageUrl}
            <img
              src="https://api.qrserver.com/v1/create-qr-code/?size=256x256&color=0f172a&bgcolor=ffffff&qzone=1&data={encodeURIComponent(pageUrl)}"
              alt="QR Code to current URL"
              class="w-full h-full object-contain"
              loading="lazy"
            />
          {/if}
        </div>

        <p class="text-xs text-slate-400 leading-relaxed px-2">
          Point a phone camera at this screen to open Wesley's digital business card instantly.
        </p>

        <div class="pt-2">
          <span class="inline-block px-3 py-1 bg-slate-800 rounded-lg text-[10px] font-mono text-slate-300 break-all select-all border border-white/5">
            {pageUrl}
          </span>
        </div>
      </div>
    </div>
  </div>
{/if}

<style>
  .animate-fade-in {
    animation: fade-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  .animate-scale-in {
    animation: scale-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  }
  @keyframes scale-in {
    from {
      opacity: 0;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }

  /* Custom scrollbar config matching app theme */
  :global(.scrollbar-thin::-webkit-scrollbar) {
    width: 6px;
    height: 6px;
  }
  :global(.scrollbar-thin::-webkit-scrollbar-track) {
    background: transparent;
  }
  :global(.scrollbar-thin::-webkit-scrollbar-thumb) {
    background: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
  }
  :global(.scrollbar-thin::-webkit-scrollbar-thumb:hover) {
    background: rgba(255, 255, 255, 0.2);
  }
</style>
