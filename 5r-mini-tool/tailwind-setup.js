(() => {
  const style = document.createElement("style");
  style.type = "text/tailwindcss";
  style.textContent = String.raw`
    @theme {
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    }

    @layer base {
      :root { color-scheme: light; }
      * { @apply box-border; }
      body { @apply m-0 bg-zinc-50 text-zinc-950 antialiased; }
      main { width: min(1280px, calc(100vw - 32px)); @apply mx-auto my-5 grid gap-3; }
      h1 { @apply m-0 text-2xl font-bold leading-tight; }
      h2 { @apply mt-0 mb-3 text-sm font-semibold tracking-tight; }
      p { @apply m-0 leading-relaxed text-zinc-500; }
      section { @apply rounded-lg border border-zinc-200 bg-white p-4 shadow-sm; }
      label { @apply grid gap-1.5 text-xs font-medium text-zinc-500; }
      input, select, textarea { @apply w-full rounded-md border border-zinc-200 bg-white px-2.5 py-2 font-mono text-sm leading-snug text-zinc-950 shadow-xs outline-none transition focus:border-zinc-400 focus:ring-2 focus:ring-zinc-200; }
      button, .file-button { @apply inline-flex min-h-9 cursor-pointer items-center justify-center rounded-md border border-zinc-950 bg-zinc-950 px-3 py-2 text-sm font-medium text-white shadow-xs transition hover:bg-zinc-800 focus:outline-none focus:ring-2 focus:ring-zinc-300; }
      button:disabled { @apply cursor-not-allowed border-zinc-200 bg-zinc-100 text-zinc-400 shadow-none hover:bg-zinc-100; }
      table { @apply w-full border-collapse text-sm; }
      th, td { @apply whitespace-nowrap border-b border-zinc-200 px-2 py-1.5 text-left; }
      th { @apply text-xs font-medium text-zinc-500; }
      progress { @apply h-3 w-full; }
    }

    @layer components {
      button.secondary, .file-button { @apply border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-100; }
      button.danger { @apply border-red-600 bg-red-600 hover:bg-red-700; }

      .top { @apply flex items-end justify-between gap-4; }
      .section-head { @apply mb-3 flex items-start justify-between gap-3; }
      .section-head h2 { @apply mb-1; }
      .section-head p { @apply text-xs; }
      .grid { @apply grid grid-cols-4 gap-3; }
      .split { @apply grid grid-cols-[1.1fr_0.9fr] gap-4; }
      .actions { @apply flex flex-wrap items-center gap-2; }

      .connection-card { @apply mb-3 flex items-center justify-between gap-3 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-2.5; }
      .connection-card strong { @apply text-sm font-semibold; }
      .connect-card { @apply mb-3 grid grid-cols-2 gap-4 rounded-md border border-zinc-200 bg-zinc-50 p-3; }
      .connect-col { @apply grid content-start gap-1.5; }
      .col-head { @apply text-[11px] font-semibold uppercase tracking-wide text-zinc-500; }
      .col-meta { @apply text-[11px] leading-snug text-zinc-400; }
      .seg { @apply grid grid-cols-2 gap-1 rounded-md border border-zinc-200 bg-zinc-100 p-1; }
      .seg-btn { @apply min-h-8 rounded-md border-transparent bg-transparent px-2.5 py-1.5 text-sm font-medium text-zinc-500 shadow-none transition hover:bg-white hover:text-zinc-900; }
      .seg-btn.active { @apply bg-white text-zinc-950 shadow-xs hover:bg-white; }
      .seg-btn:disabled { @apply cursor-not-allowed bg-transparent text-zinc-400 shadow-none hover:bg-transparent; }
      .seg-btn.active:disabled { @apply bg-white text-zinc-500; }
      .conn-state { @apply inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500; }
      .conn-state .dot { @apply h-2 w-2 rounded-full bg-zinc-400; }
      .conn-state.on { @apply text-green-700; }
      .conn-state.on .dot { @apply bg-green-500; }
      .advanced-panel { @apply mt-3 text-zinc-500; }
      .advanced-panel summary { @apply cursor-pointer text-sm font-medium text-zinc-700; }
      .advanced-panel .grid, .advanced-actions, .progress { @apply mt-3; }
      .progress { @apply grid gap-2; }
      .progress-head { @apply flex items-center justify-between gap-3 text-xs font-medium text-zinc-500; }
      .progress-track { @apply h-2 overflow-hidden rounded-full bg-zinc-100; }
      .progress-bar { @apply h-full rounded-full bg-zinc-950 transition-all duration-300; }

      .status { @apply rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-2 text-sm text-zinc-500; }
      .status.ok { @apply border-green-200 bg-green-50 text-green-700; }
      .status.err { @apply border-red-200 bg-red-50 text-red-700; }

      .table-wrap { contain: content; overflow-anchor: none; @apply max-h-[520px] overflow-auto rounded-md border border-zinc-200; }
      .mini-table { @apply max-h-[360px]; }
      .channels-table { @apply table-fixed text-xs; }
      .channels-table th, .channels-table td { overflow-anchor: none; @apply h-[30px] px-1 py-0.5; }
      .channels-table th { @apply cursor-help text-[11px] underline decoration-dotted underline-offset-[3px]; }
      .channels-table input, .channels-table select { @apply h-6 min-h-6 px-1 py-0.5 text-xs leading-none; }
      .channels-table td input { @apply w-[74px]; }
      .channels-table td input.name { @apply w-[84px] font-sans; }
      .channels-table td select { @apply w-[64px]; }
      .channels-table .virtual-spacer td { @apply h-0 border-0 p-0; }

      .settings-layout { @apply grid grid-cols-2 gap-2.5; }
      .settings-group { @apply overflow-hidden rounded-md border border-zinc-200 bg-white shadow-xs; }
      .settings-group-head { @apply flex items-center justify-between gap-2 border-b border-zinc-200 bg-zinc-50 px-2.5 py-2; }
      .settings-group-head h3 { @apply m-0 text-xs font-semibold text-zinc-900; }
      .settings-list, .setting-card, .workmode-control { @apply grid; }
      .dtmf-settings .settings-list, .workmode-control { @apply grid-cols-2; }
      .setting-card, .dtmf-guide { @apply border-b border-zinc-200 px-2.5 py-2; }
      .setting-card { @apply gap-1; }
      .setting-card:last-child, .dtmf-settings .setting-card:nth-last-child(2) { @apply border-b-0; }
      .setting-card-top { @apply grid grid-cols-[minmax(120px,1fr)_142px] items-center gap-2; }
      .setting-card strong { @apply text-[13px] font-medium text-zinc-900; }
      .setting-card-wide .setting-card-top { @apply grid-cols-1 items-stretch; }
      .setting-card p, .dtmf-guide, .setting-help { @apply text-[11px] leading-snug text-zinc-500; }
      .setting-card input, .setting-card select { @apply h-7 px-2 py-1 text-xs; }
      .setting-help { @apply m-0 list-disc pl-3.5 leading-snug; }

      .wizard { @apply mb-3 grid gap-3 rounded-md border border-zinc-200 bg-zinc-50 p-3; }
      .wizard-head { @apply flex items-start justify-between gap-3; }
      .wizard h3, .wizard strong, .goal-strip strong { @apply text-sm font-semibold; }
      .wizard p { @apply text-xs; }
      .wizard-grid { grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); @apply grid gap-2.5; }
      .fleet-grid { grid-template-columns: repeat(auto-fit, minmax(230px, 1fr)); }
      .goal-strip { @apply grid grid-cols-3 gap-2.5; }
      .goal-strip > div, .wizard-step, .wizard-note { @apply grid gap-2 rounded-md border border-zinc-200 bg-white p-2.5 shadow-xs; }
      .wizard-step input, .wizard-step select, .setting-card input, .setting-card select { @apply h-7 px-1.5 py-1 text-sm; }
      .wizard-preview { @apply max-h-[190px]; }
      .boot-logo-layout { @apply grid grid-cols-[196px_1fr] gap-3; }
      .boot-logo-preview { @apply grid min-h-44 place-items-center overflow-hidden rounded-md border border-zinc-200 bg-zinc-950 p-3; }
      .boot-logo-preview canvas { image-rendering: pixelated; @apply h-auto max-h-32 w-auto max-w-full rounded border border-zinc-700 bg-black; }
      .boot-text-tool { @apply content-start; }
      .bg-pickers { @apply grid grid-cols-2 gap-2; }
      .bg-pickers input[type="color"] { @apply h-7 w-full cursor-pointer p-0.5; }
      .danger-zone { @apply border-red-200 bg-red-50; }
      .hidden-file { @apply hidden; }

      .log { @apply h-[300px] overflow-auto whitespace-pre-wrap rounded-md bg-zinc-950 p-2.5 font-mono text-xs leading-relaxed text-zinc-200; }
      .pill { @apply inline-flex min-h-7 items-center rounded-full border border-zinc-200 bg-white px-2 py-1 text-xs font-medium text-zinc-500; }
      .check { @apply inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500; }
      .check input { @apply w-auto; }

      .tabs { @apply flex flex-wrap items-center gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1; }
      .tab-button { @apply min-h-8 rounded-md border-transparent bg-transparent px-2.5 py-1.5 text-zinc-500 shadow-none hover:bg-white hover:text-zinc-900; }
      .tab-button.active { @apply border-zinc-200 bg-white text-zinc-950 shadow-xs; }
      .tab-separator { @apply ml-2.5 self-center border-l border-zinc-300 pl-3 text-[11px] font-semibold uppercase text-zinc-500; }
      .wizard-tab { @apply bg-transparent; }
      .pager { @apply my-2.5 flex flex-wrap items-end gap-2; }
      .pager label { @apply w-28; }
    }

    @layer components {
      @media (max-width: 900px) {
        .top, .split, .wizard-head { @apply grid; }
        .grid, .split, .settings-layout, .goal-strip, .subgrid, .setting-card-top, .wizard-head, .wizard-grid, .boot-logo-layout, .connect-card { @apply grid-cols-1; }
      }
    }
  `;
  document.head.append(style);
})();
