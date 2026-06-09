<script>
  // Wesley Kalatai Alberti Header
  export let pdfUrl = "/CV_Wesley_Alberti_Cybersecurity.pdf";
</script>

<header
  class="w-full flex items-center justify-between px-4 py-3 sm:px-6 sm:py-5 md:px-12 backdrop-blur-md bg-slate-950/40 border-b border-white/5 sticky top-0 z-50 gap-3"
>
  <!-- Branding / Logo -->
  <div class="flex items-center space-x-3">
    <!-- Sleek Monogram -->
    <div
      class="relative flex items-center justify-center w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500/10 to-slate-800/30 border border-white/10 text-blue-400 font-extrabold text-lg shadow-glass-sm tracking-wider font-mono"
    >
      WA
      <!-- Glowing dot -->
      <span class="absolute -top-1 -right-1 flex h-3.5 w-3.5">
        <span
          class="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"
        ></span>
        <span
          class="relative inline-flex rounded-full h-3.5 w-3.5 bg-blue-500 border-2 border-slate-950"
        ></span>
      </span>
    </div>

    <div class="min-w-0">
      <h1
        class="text-base sm:text-xl font-bold tracking-tight bg-gradient-to-r from-slate-100 to-slate-300 bg-clip-text text-transparent font-sans truncate"
      >
        Wesley Kalatai Alberti
      </h1>
      <p
        class="hidden sm:block text-[10px] font-mono tracking-widest text-slate-500 uppercase leading-none mt-0.5"
      >
        // FULLSTACK_CYBERSECURITY_ENGINEER
      </p>
    </div>
  </div>

  <!-- PDF Download Button & Profile Links -->
  <div class="flex items-center space-x-2 sm:space-x-3 shrink-0">
    <!-- LinkedIn (icon only on small screens) -->
    <a
      href="https://www.linkedin.com/in/wesleykalataialberti"
      target="_blank"
      rel="noreferrer"
      class="p-2 rounded bg-white/5 border border-white/10 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 transition-all shadow-glass-sm"
      aria-label="LinkedIn Profile"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z"
        />
      </svg>
    </a>

    <!-- GitHub (icon only on small screens) -->
    <a
      href="https://github.com/wesley-ka"
      target="_blank"
      rel="noreferrer"
      class="p-2 rounded bg-white/5 border border-white/10 hover:border-blue-500/30 text-slate-400 hover:text-blue-400 transition-all shadow-glass-sm"
      aria-label="GitHub Profile"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4"
        fill="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.9-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.9 1.52 2.34 1.07 2.91.83.1-.75.4-1.25.72-1.54-2.21-.25-4.55-1.1-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2z"
        />
      </svg>
    </a>

    <!-- CV Download -->
    <a
      href={pdfUrl}
      download="Wesley_Alberti_CV.pdf"
      class="group relative inline-flex items-center space-x-1.5 px-3 sm:px-4 py-2 rounded-lg bg-white/5 hover:bg-blue-500/10 border border-white/10 hover:border-blue-500/30 transition-all duration-300 shadow-glass text-xs font-semibold text-slate-200 hover:text-blue-300 overflow-hidden"
      id="cv-download-btn"
      aria-label="Download CV as PDF"
    >
      <span
        class="absolute inset-0 w-full h-full bg-gradient-to-r from-blue-500/10 to-indigo-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
      ></span>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        class="h-4 w-4 text-blue-400 group-hover:scale-110 transition-transform duration-300 shrink-0"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          stroke-linecap="round"
          stroke-linejoin="round"
          stroke-width="2"
          d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      <span class="hidden sm:inline tracking-wide">Download CV</span>
      <span class="inline sm:hidden tracking-wide text-[10px]">CV</span>
    </a>
  </div>
</header>
