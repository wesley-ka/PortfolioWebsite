<script>
  import { onMount } from 'svelte';

  let open = $state(false);
  let message = $state('');
  let phone = $state('');
  let email = $state('');
  let status = $state('idle'); // idle | sending | sent | error
  let statusText = $state('');

  let animateAttention = $state(false);

  onMount(() => {
    const interval = setInterval(() => {
      if (!open) {
        animateAttention = true;
        setTimeout(() => {
          animateAttention = false;
        }, 1200); // Matches CSS animation duration
      }
    }, 12000); // Triggers every 12 seconds

    return () => clearInterval(interval);
  });

  function toggle() {
    open = !open;
    if (open) {
      status = 'idle';
      statusText = '';
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!message.trim()) return;

    status = 'sending';
    statusText = 'Sending...';

    try {
      const res = await fetch('/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: message.trim(),
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (data.ok) {
        status = 'sent';
        statusText = 'Message sent — I\'ll get back to you!';
        message = '';
        phone = '';
        email = '';
        setTimeout(() => {
          status = 'idle';
          statusText = '';
        }, 4000);
      } else {
        status = 'error';
        statusText = data.error || 'Could not send message.';
      }
    } catch {
      status = 'error';
      statusText = 'Network error. Please try again.';
    }
  }
</script>

<!-- Floating chat button (always visible) -->
<button
  onclick={toggle}
  class="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-400/40 transition-all duration-300 cursor-pointer overflow-hidden techy-aura {animateAttention ? 'attention-bounce attention-pulse' : ''}"
  aria-label={open ? 'Close contact panel' : 'Send me a message'}
>
  <span class="relative z-10 flex items-center justify-center">
    {#if open}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
      </svg>
    {:else}
      <svg xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    {/if}
  </span>
</button>

<!-- Chat panel -->
{#if open}
  <div
    class="fixed bottom-24 right-6 z-50 w-80 sm:w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-white/10 bg-slate-900/95 backdrop-blur-xl shadow-glass-lg overflow-hidden animate-fade-in"
  >
    <!-- Header -->
    <div class="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-slate-800/40">
      <div class="flex items-center space-x-2.5">
        <div class="relative flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/20">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </div>
        <div>
          <p class="text-sm font-semibold text-slate-100">Send me a message</p>
          <p class="text-[10px] font-mono text-slate-500">SECURE_CHANNEL</p>
        </div>
      </div>
      <span class="flex items-center space-x-1.5 text-[10px] font-mono text-emerald-400">
        <span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
        <span>ONLINE</span>
      </span>
    </div>

    <!-- Body -->
    <div class="p-4">
      {#if status === 'sent'}
        <div class="flex flex-col items-center justify-center py-6 text-center space-y-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-10 w-10 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="text-sm text-slate-300 font-medium">Message sent!</p>
          <p class="text-xs text-slate-500">I've got your message — I'll be in touch soon.</p>
        </div>
      {:else}
        <form onsubmit={handleSubmit} class="space-y-3">
          <!-- Phone field (optional) -->
          <div>
            <label for="chat-phone" class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              Phone <span class="text-slate-600">(optional)</span>
            </label>
            <input
              id="chat-phone"
              type="tel"
              bind:value={phone}
              placeholder="+34 612 345 678"
              maxlength="30"
              disabled={status === 'sending'}
              class="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
          </div>

          <!-- Email field (required) -->
          <div>
            <label for="chat-email" class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              Email <span class="text-red-400">*</span>
            </label>
            <input
              id="chat-email"
              type="email"
              bind:value={email}
              placeholder="you@example.com"
              maxlength="120"
              required
              disabled={status === 'sending'}
              class="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all disabled:opacity-50"
            />
          </div>

          <!-- Message field -->
          <div>
            <label for="chat-message" class="block text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
              Message <span class="text-red-400">*</span>
            </label>
            <textarea
              id="chat-message"
              bind:value={message}
              placeholder="Hey! I saw your portfolio and..."
              rows="3"
              maxlength="2000"
              required
              disabled={status === 'sending'}
              class="w-full px-3 py-2 rounded-lg bg-slate-800/60 border border-white/5 text-sm text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/40 focus:ring-1 focus:ring-blue-500/20 transition-all resize-none disabled:opacity-50"
            ></textarea>
            <p class="text-[10px] font-mono text-slate-600 text-right mt-1">{message.length}/2000</p>
          </div>

          <!-- Status / Error -->
          {#if status === 'error'}
            <p class="text-xs text-red-400 flex items-center space-x-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{statusText}</span>
            </p>
          {/if}

          <!-- Submit -->
          <button
            type="submit"
            disabled={status === 'sending' || !message.trim() || !email.trim()}
            class="w-full py-2.5 rounded-lg bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-400 hover:to-blue-500 text-white text-sm font-semibold shadow-md shadow-blue-500/20 hover:shadow-blue-400/30 transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            {#if status === 'sending'}
              <span class="flex items-center justify-center space-x-2">
                <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Sending...</span>
              </span>
            {:else}
              Send Message
            {/if}
          </button>
        </form>
      {/if}
    </div>

    <!-- Footer -->
    <div class="px-4 py-2 border-t border-white/5 bg-slate-800/20">
      <p class="text-[9px] font-mono text-slate-600 text-center">
        Please provide a valid email so I can reach back out to you.
      </p>
    </div>
  </div>
{/if}

<style>
  .animate-fade-in {
    animation: fade-in 0.2s ease-out;
  }
  @keyframes fade-in {
    from {
      opacity: 0;
      transform: translateY(8px) scale(0.97);
    }
    to {
      opacity: 1;
      transform: translateY(0) scale(1);
    }
  }

  /* Attention-grabbing bounce and shake animation */
  .attention-bounce {
    animation: attention-bounce 1.2s ease-in-out;
  }
  @keyframes attention-bounce {
    0%, 100% {
      transform: translateY(0) scale(1);
    }
    15% {
      transform: translateY(-8px) scale(1.05);
    }
    30% {
      transform: translateY(2px) scale(0.98);
    }
    45% {
      transform: translateY(-3px) scale(1.02) rotate(-4deg);
    }
    60% {
      transform: translateY(0) scale(1) rotate(4deg);
    }
    75% {
      transform: translateY(0) scale(1) rotate(-2deg);
    }
    90% {
      transform: translateY(0) scale(1) rotate(0deg);
    }
  }

  /* Pulsing glowing halo */
  .attention-pulse::after {
    content: '';
    position: absolute;
    inset: 0;
    border-radius: 9999px;
    box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    animation: attention-pulse 1.2s cubic-bezier(0.66, 0, 0, 1);
  }
  @keyframes attention-pulse {
    0% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7);
    }
    70% {
      box-shadow: 0 0 0 15px rgba(59, 130, 246, 0);
    }
    100% {
      box-shadow: 0 0 0 0 rgba(59, 130, 246, 0);
    }
  }

  /* techy glowing inner aura radiating from center but not exceeding borders */
  .techy-aura::before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 130%;
    height: 130%;
    transform: translate(-50%, -50%) scale(0.5);
    background: radial-gradient(circle, rgba(255, 255, 255, 0.3) 0%, rgba(59, 130, 246, 0.25) 40%, rgba(59, 130, 246, 0) 70%);
    border-radius: 50%;
    pointer-events: none;
    animation: techy-aura 4s ease-in-out infinite;
    z-index: 0;
  }
  @keyframes techy-aura {
    0%, 100% {
      transform: translate(-50%, -50%) scale(0.35);
      opacity: 0.2;
    }
    50% {
      transform: translate(-50%, -50%) scale(1.0);
      opacity: 0.95;
    }
  }
</style>
