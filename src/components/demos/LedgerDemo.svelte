<script>
  import { onMount } from 'svelte';
  import { fade, fly, scale } from 'svelte/transition';
  import { 
    createLedgerShipment, 
    appendLedgerEvent, 
    verifyLedgerChain, 
    getMockLedgerChain,
    fetchLatestLedgerBlock,
    fetchLedgerChain,
    resetLedgerChain,
    tamperLedgerBlock
  } from '../../services/api.js';

  // Asset tracking state
  let assetId = 'VM-9872';
  let assetType = 'VOTING_MACHINE';
  let manufacturer = 'SecureSystems Corp';
  
  // Ledger timeline state
  let blocks = [];
  let isPending = false;
  let errorMsg = null;
  
  // Append Event Form
  let eventType = 'CUSTODY_TRANSFER';
  let custodian = 'Carrier Alpha';
  let location = 'Warehouse Madrid-South';
  let transportMode = 'Truck-4';
  
  // Simulator State
  let simulateTampering = false;
  let isAuditing = false;
  let auditLogs = [];
  let auditReport = null;
  
  // Active block index being scanned during audit
  let scanningIndex = -1;
  let brokenIndex = -1;

  // Dynamic tampering config
  let tamperIndex = 1;
  let tamperLocation = 'Unknown Warehouse';
  let presetLocation = 'Unknown Warehouse';
  let autoRunAudit = false;
  let originalLocations = {};
  let isTamperingInProgress = false;
  let tamperAppliedMessage = "";

  // Search status
  let hasSearched = false;

  onMount(() => {
    loadLedgerState();
  });

  async function loadLedgerState() {
    try {
      blocks = await fetchLedgerChain(assetId);
      
      if (blocks.length > 0) {
        const genesis = blocks[0];
        if (genesis.assetType) assetType = genesis.assetType;
        if (genesis.meta && genesis.meta.manufacturer) manufacturer = genesis.meta.manufacturer;
      }
    } catch (err) {
      console.warn("Failed to load ledger state:", err);
    }
  }

  async function searchAsset() {
    isPending = true;
    errorMsg = null;
    auditReport = null;
    brokenIndex = -1;
    tamperAppliedMessage = "";
    
    try {
      blocks = await fetchLedgerChain(assetId);
      
      if (blocks.length > 0) {
        const genesis = blocks[0];
        if (genesis.assetType) assetType = genesis.assetType;
        if (genesis.meta && genesis.meta.manufacturer) manufacturer = genesis.meta.manufacturer;
      } else {
        errorMsg = `No ledger records found for Asset ID '${assetId}'.`;
      }
    } catch (err) {
      errorMsg = err.message || "Failed to retrieve asset history.";
      blocks = [];
    } finally {
      hasSearched = true;
      isPending = false;
    }
  }

  async function registerShipment() {
    isPending = true;
    errorMsg = null;
    try {
      const response = await createLedgerShipment({
        assetId,
        assetType,
        custodian: 'Central Election Office',
        meta: {
          manufacturer
        }
      });
      await loadLedgerState();
    } catch (err) {
      errorMsg = err.message || "Failed to register shipment.";
    } finally {
      isPending = false;
    }
  }

  async function appendEvent() {
    if (blocks.length === 0) return;
    isPending = true;
    errorMsg = null;
    
    try {
      const latestBlock = await fetchLatestLedgerBlock(assetId);
      const payload = {
        assetId,
        eventType,
        custodian,
        location,
        previousBlockHash: latestBlock.blockHash,
        meta: {
          transportMode
        }
      };
      
      await appendLedgerEvent(payload);
      
      // Reset defaults for next entry
      if (custodian === 'Carrier Alpha') {
        custodian = 'Local Electoral Commission';
        location = 'City Hall Madrid-Center';
        eventType = 'DELIVERED';
      } else {
        custodian = 'Carrier Alpha';
        location = 'Warehouse Madrid-South';
        eventType = 'CUSTODY_TRANSFER';
      }
      
      loadLedgerState();
    } catch (err) {
      errorMsg = err.message || "Failed to log event.";
    } finally {
      isPending = false;
    }
  }

  async function runChainAudit() {
    isAuditing = true;
    auditLogs = [];
    auditReport = null;
    scanningIndex = -1;
    brokenIndex = -1;
    
    // Refresh ledger state to sync memory representation
    await loadLedgerState();
    
    try {
      // If server is online, verifyLedgerChain will call backend,
      // otherwise it performs high-fidelity local calculations.
      const result = await verifyLedgerChain(assetId);
      
      // Step-by-step scanner animation
      for (let i = 0; i < blocks.length; i++) {
        scanningIndex = i;
        auditLogs = [...auditLogs, `Auditing Block #${i}: Checking hash linkage and ECDSA signatures...`];
        
        // Simulating audit inspection time per node
        await new Promise(r => setTimeout(r, 600));
        
        const reportItem = result.auditReport.find(r => r.index === i);
        const matches = reportItem ? reportItem.hashMatches && reportItem.signatureValid : true;
        
        if (!matches) {
          brokenIndex = i;
          auditLogs = [...auditLogs, `[BREACH DETECTED] Block #${i} failed integrity checks! Recalculated hash does not match block signature.`];
          // Chain breaks here, so stop scanning
          break;
        } else {
          auditLogs = [...auditLogs, `Block #${i} signature validated [✓] Parent hash matches predecessor.`];
        }
      }
      
      scanningIndex = -1;
      auditReport = result;
      
    } catch (err) {
      errorMsg = err.message || "Verification audit failed.";
    } finally {
      isAuditing = false;
    }
  }

  function handleTamperToggle() {
    // Reset report on changes
    auditReport = null;
    brokenIndex = -1;
    tamperAppliedMessage = "";
  }

  async function executeDatabaseTamper() {
    if (blocks.length === 0) return;
    if (tamperIndex < 0 || tamperIndex >= blocks.length) return;
    
    isTamperingInProgress = true;
    errorMsg = null;
    tamperAppliedMessage = "";
    
    try {
      const targetBlock = blocks[tamperIndex];
      // Save original location if not already recorded
      if (originalLocations[tamperIndex] === undefined) {
        originalLocations[tamperIndex] = targetBlock.location;
      }
      
      await tamperLedgerBlock(assetId, tamperIndex, tamperLocation);
      tamperAppliedMessage = `Successfully corrupted Block #${tamperIndex} in storage!`;
      
      // Reload timeline state
      await loadLedgerState();
      
      // Reset report as chain has changed
      auditReport = null;
      brokenIndex = -1;

      if (autoRunAudit) {
        // Run audit instantly
        await runChainAudit();
      }
    } catch (err) {
      errorMsg = err.message || "Failed to simulate tampering.";
    } finally {
      isTamperingInProgress = false;
    }
  }

  function handlePresetChange() {
    if (presetLocation !== 'custom') {
      tamperLocation = presetLocation;
    } else {
      tamperLocation = '';
    }
  }

  async function resetChain() {
    isPending = true;
    errorMsg = null;
    auditReport = null;
    brokenIndex = -1;
    simulateTampering = false;
    tamperAppliedMessage = "";
    originalLocations = {};
    hasSearched = false;
    
    try {
      await resetLedgerChain(assetId);
      blocks = [];
    } catch (err) {
      errorMsg = err.message || "Failed to reset ledger.";
    } finally {
      isPending = false;
    }
  }

  // Reactive constraint to keep tamperIndex in bounds
  $: if (blocks.length > 0 && tamperIndex >= blocks.length) {
    tamperIndex = blocks.length - 1;
  }

  // Clear all timeline state, audit reports, and logs when typing/changing the asset ID
  $: if (assetId) {
    blocks = [];
    auditLogs = [];
    auditReport = null;
    brokenIndex = -1;
    tamperAppliedMessage = "";
    hasSearched = false;
  }
</script>

<div class="space-y-5">
  
  <!-- Top bar controls -->
  <div class="flex flex-wrap items-center justify-between border-b border-white/5 pb-2 gap-3">
    <div class="flex items-center space-x-2">
      <span class="text-xs font-mono text-slate-400">Tracking Asset:</span>
      <input
        type="text"
        bind:value={assetId}
        on:keydown={(e) => e.key === 'Enter' && !isPending && assetId && searchAsset()}
        class="bg-slate-950/60 border border-white/10 px-2 py-1 rounded text-xs text-blue-300 font-mono focus:outline-none w-28"
        placeholder="Asset ID"
      />
      <button
        on:click={searchAsset}
        disabled={isPending || !assetId}
        class="px-2 py-1 rounded bg-blue-600/10 border border-blue-500/20 hover:bg-blue-600/20 text-blue-400 text-[10px] font-mono font-semibold transition-all cursor-pointer flex items-center space-x-1 disabled:opacity-50"
        title="Search / Refresh history"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <span>Search</span>
      </button>
    </div>
    
    <div class="flex gap-2">
      {#if blocks.length > 0}
        <button
          on:click={runChainAudit}
          disabled={isAuditing}
          class="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 text-blue-300 transition-colors flex items-center space-x-1 cursor-pointer disabled:opacity-50"
        >
          <span>Run Chain Audit</span>
        </button>
        <button
          on:click={resetChain}
          class="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-950 hover:bg-slate-900 border border-white/10 text-slate-400 hover:text-slate-200 transition-colors cursor-pointer"
        >
          Reset Ledger
        </button>
      {/if}
    </div>
  </div>

  <!-- Main layout grid: Actions and Timeline -->
  <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
    
    <!-- LEFT SIDE: Form Controls & Simulator Panel -->
    <div class="lg:col-span-5 space-y-4">
      
      <!-- Active Tracking Status Summary Card -->
      {#if blocks.length > 0}
        <div in:fade={{ duration: 150 }} class="p-4 rounded-xl bg-gradient-to-r from-blue-950/20 to-slate-900/40 border border-blue-500/20 space-y-3 relative overflow-hidden">
          <div class="absolute -right-10 -top-10 w-24 h-24 bg-blue-500/10 rounded-full blur-2xl pointer-events-none"></div>
          
          <div class="flex items-center justify-between border-b border-white/5 pb-2">
            <h3 class="text-[10px] font-bold font-mono text-blue-400 uppercase tracking-widest">
              Ledger Tracking Status
            </h3>
            <span class="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono bg-green-500/10 border border-green-500/20 text-green-400">
              <span class="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"></span>
              <span>LIVE TRACKING</span>
            </span>
          </div>

          <div class="grid grid-cols-2 gap-2 text-xs">
            <div class="space-y-0.5">
              <span class="text-[8px] font-mono text-slate-500 block">Asset ID</span>
              <span class="font-mono font-semibold text-blue-300 select-all">{assetId}</span>
            </div>
            <div class="space-y-0.5">
              <span class="text-[8px] font-mono text-slate-500 block">Asset Type</span>
              <span class="font-semibold text-slate-200">{assetType}</span>
            </div>
            <div class="space-y-0.5">
              <span class="text-[8px] font-mono text-slate-500 block">Manufacturer</span>
              <span class="font-semibold text-slate-200">{manufacturer}</span>
            </div>
            <div class="space-y-0.5">
              <span class="text-[8px] font-mono text-slate-500 block">Current Custodian</span>
              <span class="font-semibold text-slate-200">{blocks[blocks.length - 1].custodian}</span>
            </div>
          </div>
        </div>
      {/if}
      
      <!-- Register / Append actions -->
      <div class="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
        {#if blocks.length === 0}
          <!-- Shipment Creation Form -->
          <h3 class="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
            1. Register Shipment (Genesis Block)
          </h3>
          
          <div class="space-y-3">
            <div class="space-y-1">
              <label for="asset-type" class="text-[10px] font-semibold text-slate-400 font-mono">Asset Type</label>
              <input
                id="asset-type"
                type="text"
                bind:value={assetType}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500/50"
              />
            </div>
            <div class="space-y-1">
              <label for="asset-mfg" class="text-[10px] font-semibold text-slate-400 font-mono">Manufacturer</label>
              <input
                id="asset-mfg"
                type="text"
                bind:value={manufacturer}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200"
              />
            </div>

            <button
              on:click={registerShipment}
              disabled={isPending}
              class="w-full py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-slate-100 font-semibold text-xs tracking-wider rounded-lg border border-blue-500/20 hover:border-blue-400/40 shadow-glass transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>REGISTER GENESIS SHIPMENT</span>
            </button>
          </div>
        {:else}
          <!-- Append Event Form -->
          <h3 class="text-[10px] font-bold font-mono text-slate-500 uppercase tracking-widest">
            2. Log Custody Check-in Event
          </h3>
          
          <div class="space-y-3 font-mono text-[10px]">
            <div class="space-y-1 font-sans">
              <label for="event-type-sel" class="text-[10px] font-semibold text-slate-400 font-mono">Event Type</label>
              <select
                id="event-type-sel"
                bind:value={eventType}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none"
              >
                <option value="CUSTODY_TRANSFER">CUSTODY_TRANSFER</option>
                <option value="INSPECTION">INSPECTION</option>
                <option value="CUSTOMS_CLEARANCE">CUSTOMS_CLEARANCE</option>
                <option value="DELIVERED">DELIVERED</option>
              </select>
            </div>
            
            <div class="space-y-1 font-sans">
              <label for="event-custodian" class="text-[10px] font-semibold text-slate-400 font-mono">Custodian</label>
              <input
                id="event-custodian"
                type="text"
                bind:value={custodian}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            <div class="space-y-1 font-sans">
              <label for="event-location" class="text-[10px] font-semibold text-slate-400 font-mono">Location String</label>
              <input
                id="event-location"
                type="text"
                bind:value={location}
                class="w-full rounded bg-slate-950/60 border border-white/10 p-2 text-xs text-slate-200 focus:outline-none"
              />
            </div>

            <div class="text-[8px] text-slate-500 truncate pt-1">
              Previous Hash: <span class="text-blue-400/80">{blocks[blocks.length-1].blockHash.substring(0, 16)}...</span>
            </div>

            <button
              on:click={appendEvent}
              disabled={isPending}
              class="w-full py-2 bg-blue-600 hover:bg-blue-500 text-slate-100 font-semibold text-xs tracking-wider rounded-lg border border-blue-500/20 hover:border-blue-400/40 shadow-glass transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>APPEND SHIPMENT EVENT</span>
            </button>
          </div>
        {/if}
      </div>

      <!-- HACKER SIMULATOR PANEL -->
      {#if blocks.length > 0}
        <div in:fade={{ duration: 150 }} class="p-4 rounded-xl bg-slate-900/40 border border-white/5 space-y-3">
          <div class="flex items-center justify-between">
            <h3 class="text-[10px] font-bold font-mono text-red-400 uppercase tracking-widest">
              Hacker Simulator Panel
            </h3>
            
            <div class="flex items-center space-x-1.5">
              <input
                id="simulate-tamper-box"
                type="checkbox"
                bind:checked={simulateTampering}
                on:change={handleTamperToggle}
                class="rounded bg-slate-900 border-red-500/20 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
              />
              <label for="simulate-tamper-box" class="text-[9px] font-semibold text-red-400 select-none cursor-pointer">
                Tamper Database
              </label>
            </div>
          </div>

          <p class="text-[9px] text-slate-400 leading-normal">
            Toggle tampering to simulate database corruption by altering any block's geographic location field directly in active storage.
          </p>

          <!-- Hacker form controls -->
          {#if simulateTampering}
            <div in:fly={{ y: -5, duration: 150 }} class="space-y-3 pt-2 border-t border-red-500/10">
              <!-- Select Block Dropdown -->
              <div class="space-y-1">
                <label for="tamper-block-select" class="text-[10px] font-semibold text-red-400 font-mono">Select Target Block</label>
                <select
                  id="tamper-block-select"
                  bind:value={tamperIndex}
                  class="w-full rounded bg-slate-950/60 border border-red-500/25 p-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/50 font-mono"
                >
                  {#each blocks as block, idx}
                    <option value={idx}>Block #{idx} ({block.eventType} - {block.custodian})</option>
                  {/each}
                </select>
              </div>

              <!-- Location Presets Dropdown -->
              <div class="space-y-1">
                <label for="tamper-location-preset" class="text-[10px] font-semibold text-red-400 font-mono">Select Location Preset</label>
                <select
                  id="tamper-location-preset"
                  bind:value={presetLocation}
                  on:change={handlePresetChange}
                  class="w-full rounded bg-slate-950/60 border border-red-500/25 p-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/50 font-mono"
                >
                  <option value="Unknown Warehouse">Unknown Warehouse (Default)</option>
                  <option value="Black Market Depot (Rotterdam)">Black Market Depot (Rotterdam)</option>
                  <option value="Ransomware Drop-off Zone">Ransomware Drop-off Zone</option>
                  <option value="Intercepted Transit Node">Intercepted Transit Node</option>
                  <option value="custom">Custom Location Value...</option>
                </select>
              </div>

              <!-- Custom Location Input -->
              {#if presetLocation === 'custom'}
                <div class="space-y-1" transition:fade={{ duration: 150 }}>
                  <label for="tamper-custom-location" class="text-[10px] font-semibold text-red-400 font-mono">Custom Location String</label>
                  <input
                    id="tamper-custom-location"
                    type="text"
                    bind:value={tamperLocation}
                    placeholder="Enter custom location"
                    class="w-full rounded bg-slate-950/60 border border-red-500/25 p-2 text-xs text-slate-200 focus:outline-none focus:border-red-500/50 font-mono"
                  />
                </div>
              {/if}

              <!-- Auto-run Audit option -->
              <div class="flex items-center space-x-1.5 py-1">
                <input
                  id="auto-run-audit-box"
                  type="checkbox"
                  bind:checked={autoRunAudit}
                  class="rounded bg-slate-900 border-red-500/25 text-red-500 focus:ring-0 focus:ring-offset-0 cursor-pointer"
                />
                <label for="auto-run-audit-box" class="text-[9px] font-semibold text-slate-400 select-none cursor-pointer">
                  Auto-run verification audit after tampering
                </label>
              </div>

              <!-- Apply Button -->
              <button
                on:click={executeDatabaseTamper}
                disabled={isTamperingInProgress || blocks.length === 0}
                class="w-full py-1.5 bg-red-950/40 hover:bg-red-900/40 text-red-300 font-mono font-semibold text-xs tracking-wider rounded-lg border border-red-500/30 hover:border-red-400/50 transition-all flex items-center justify-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                <span>APPLY DATABASE CORRUPTION</span>
              </button>

              <!-- Success indicator -->
              {#if tamperAppliedMessage}
                <div class="text-[9px] text-green-400 font-mono bg-green-950/20 border border-green-500/20 px-2.5 py-1.5 rounded-md flex items-center space-x-1">
                  <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-green-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4" />
                  </svg>
                  <span>{tamperAppliedMessage}</span>
                </div>
              {/if}

              <!-- Storage DB Inspector Code Editor -->
              <div class="relative rounded-lg border border-red-500/20 overflow-hidden bg-slate-950 font-mono text-[9px] leading-relaxed">
                <div class="px-2.5 py-1 bg-red-950/20 border-b border-red-500/20 text-red-400 font-bold uppercase tracking-wider text-[8px]">
                  Storage DB Inspector: Block #{tamperIndex}
                </div>
                <pre class="p-3 text-slate-400 max-h-[140px] overflow-y-auto"><code>&#123;
  "index": {tamperIndex},
  "assetId": "{assetId}",
  "eventType": "{blocks[tamperIndex]?.eventType || 'CUSTODY_TRANSFER'}",
  "custodian": "{blocks[tamperIndex]?.custodian || 'Unknown'}",
{#if ((originalLocations[tamperIndex] !== undefined) ? originalLocations[tamperIndex] : blocks[tamperIndex]?.location) !== tamperLocation}
<span class="text-red-400 font-bold bg-red-500/10 px-1 border-l-2 border-red-500">- "location": "{(originalLocations[tamperIndex] !== undefined) ? originalLocations[tamperIndex] : blocks[tamperIndex]?.location}",</span>
<span class="text-red-400 font-bold bg-red-500/10 px-1 border-l-2 border-red-500">+ "location": "{tamperLocation}",</span>
{:else}
  "location": "{blocks[tamperIndex]?.location || ''}",
{/if}
  "previousBlockHash": "{blocks[tamperIndex]?.previousBlockHash?.substring(0, 16) || '0000000000000000'}...",
  "blockHash": "{blocks[tamperIndex]?.blockHash?.substring(0, 16) || ''}..." // Recalculation mismatch!
&#125;</code></pre>
              </div>
            </div>
          {/if}
        </div>
      {/if}

    </div>

    <!-- RIGHT SIDE: Vertical Timeline -->
    <div class="lg:col-span-7 space-y-4">
      
      {#if blocks.length === 0}
        {#if hasSearched}
          <div class="p-12 text-center rounded-2xl border border-dashed border-white/10 bg-slate-950/40 text-slate-500 font-mono text-xs">
            No records registered for Asset ID '{assetId}'.<br/>
            <span class="text-[10px] text-slate-600 block mt-1">Register a genesis shipment to build the timeline ledger.</span>
          </div>
        {:else}
          <div class="p-12 text-center rounded-2xl border border-white/5 bg-slate-950/20 text-slate-400 font-mono text-xs space-y-3">
            <div class="inline-flex items-center justify-center p-3 rounded-full bg-blue-500/5 border border-blue-500/10 text-blue-400 mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <h4 class="text-slate-200 font-bold tracking-wider">Provenance Ledger Workspace</h4>
            <p class="text-[10px] text-slate-500 max-w-sm mx-auto leading-relaxed">
              To begin, click <strong class="text-blue-400">Search</strong> to fetch the tracking history for <strong class="text-slate-300">"{assetId}"</strong>, or register a new genesis shipment using the form on the left.
            </p>
          </div>
        {/if}
      {:else}
        
        <!-- Timeline header audit reports -->
        {#if auditReport}
          <div in:fly={{ y: -10, duration: 200 }} class="p-4 rounded-xl border font-mono text-[10px] space-y-2 {auditReport.validChain ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-red-500/5 border-red-500/20 text-red-400'}">
            <div class="flex items-center space-x-1.5 font-bold uppercase tracking-wider">
              {#if auditReport.validChain}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M9 12l2 2 4-4" />
                </svg>
                <span>LEDGER AUDIT SUCCESSFUL [CHAIN_INTEGRITY_SECURE]</span>
              {:else}
                <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <span>LEDGER INTEGRITY BREACH CAUGHT AT BLOCK #{brokenIndex}!</span>
              {/if}
            </div>
            
            <p class="text-[9px] text-slate-300 leading-normal pl-5">
              {#if auditReport.validChain}
                All hashes recalculate correctly against ECDSA signatures, and the sequential linkages are intact.
              {:else}
                Recalculating hash of Block #{brokenIndex} data returns a value mismatch against the cryptographic signature value. Unauthorized database alteration detected!
              {/if}
            </p>
          </div>
        {/if}

        <!-- Audit live logs ticker -->
        {#if isAuditing || auditLogs.length > 0}
          <div class="p-3 rounded-lg bg-slate-950 border border-white/10 font-mono text-[8px] space-y-1 text-slate-400 max-h-[85px] overflow-y-auto">
            <div class="text-[7px] text-blue-400 font-bold uppercase tracking-widest mb-1 select-none">Audit Engine Logs</div>
            {#each auditLogs as log}
              <div class="truncate {log.includes('[BREACH') ? 'text-red-400 font-bold' : log.includes('validated') ? 'text-green-400/80' : ''}">
                {log}
              </div>
            {/each}
          </div>
        {/if}

        <!-- Vertical Timeline Nodes -->
        <div class="relative pl-6 space-y-8 py-3">
          
          <!-- Laser Scan Line overlay that sweeps down the timeline during audit -->
          {#if isAuditing && scanningIndex !== -1}
            <div
              class="absolute left-10 w-[85%] h-[2px] bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)] z-20 transition-all duration-300 pointer-events-none"
              style="top: {scanningIndex * 155 + 40}px;"
            ></div>
          {/if}

          <!-- Timeline Vertical Linkage Line -->
          <div class="absolute left-2.5 top-5 bottom-5 w-[2px] bg-slate-800 pointer-events-none z-0"></div>

          <!-- Timeline Blocks Loop -->
          {#each blocks as block, idx (block.timestamp)}
            <!-- Audit highlight colors -->
            {@const isScanningThis = scanningIndex === idx}
            {@const isPassedThis = auditReport && idx < brokenIndex && brokenIndex !== -1 || auditReport?.validChain}
            {@const isFailedThis = brokenIndex !== -1 && idx >= brokenIndex}
            
            <div
              in:fly={{ x: 20, duration: 250 }}
              class="relative flex flex-col space-y-2 z-10 transition-all duration-300"
            >
              
              <!-- Timeline Dot Node -->
              <div
                class="absolute -left-6 top-3 w-5.5 h-5.5 rounded-full border-2 bg-slate-950 flex items-center justify-center transition-all duration-300 z-10
                {isScanningThis ? 'border-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]' : ''}
                {isPassedThis ? 'border-green-500 shadow-[0_0_8px_rgba(74,222,128,0.5)]' : ''}
                {isFailedThis ? 'border-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)] animate-pulse-fast' : ''}
                {!isScanningThis && !isPassedThis && !isFailedThis ? 'border-slate-700' : ''}"
              >
                <!-- Dot icon -->
                {#if isFailedThis}
                  <span class="w-1.5 h-1.5 rounded-full bg-red-400"></span>
                {:else if isPassedThis}
                  <span class="w-1.5 h-1.5 rounded-full bg-green-400"></span>
                {:else if isScanningThis}
                  <span class="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping"></span>
                {:else}
                  <span class="w-1.5 h-1.5 rounded-full bg-slate-700"></span>
                {/if}
              </div>

              <!-- Particle burst block animation for tampering breach -->
              {#if isFailedThis && idx === brokenIndex && auditReport}
                <div class="absolute -left-20 top-2 z-30 pointer-events-none">
                  <!-- Explosion particle effects -->
                  <div class="relative w-24 h-12 flex items-center justify-center">
                    <span class="absolute w-2 h-2 bg-red-500 rounded-full animate-particle-1"></span>
                    <span class="absolute w-1.5 h-1.5 bg-amber-500 rounded-full animate-particle-2"></span>
                    <span class="absolute w-2.5 h-2.5 bg-red-600 rounded-full animate-particle-3"></span>
                    <span class="absolute w-1 h-1 bg-white rounded-full animate-particle-4"></span>
                  </div>
                </div>
              {/if}

              <!-- Block Card container -->
              <div
                class="w-full p-4 rounded-xl border bg-slate-900/60 backdrop-blur-sm shadow-glass transition-all duration-300 flex flex-col space-y-2 relative overflow-hidden
                {isScanningThis ? 'border-blue-500/50 bg-slate-900/80 shadow-[0_0_15px_rgba(59,130,246,0.15)] scale-[1.01]' : ''}
                {isPassedThis ? 'border-green-500/20 shadow-[0_0_15px_rgba(74,222,128,0.05)]' : ''}
                {isFailedThis ? 'border-red-500/40 bg-red-950/5 shadow-[0_0_15px_rgba(239,68,68,0.1)] shake-node' : 'border-white/5'}"
              >
                <!-- Card Inner Header -->
                <div class="flex items-center justify-between text-[9px] font-mono border-b border-white/5 pb-1.5">
                  <div class="flex items-center space-x-1.5">
                    <span class="px-1.5 py-0.5 rounded font-extrabold {idx === 0 ? 'bg-blue-500/15 text-blue-400' : 'bg-slate-800 text-slate-300'}">
                      BLOCK #{idx}
                    </span>
                    <span class="text-slate-500">{block.eventType}</span>
                  </div>
                  <span class="text-slate-500">
                    {new Date(block.timestamp).toLocaleTimeString()}
                  </span>
                </div>

                <!-- Event Details Grid -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                  <div class="space-y-0.5">
                    <span class="text-[8px] font-mono text-slate-500 block">Custodian Node</span>
                    <span class="font-semibold text-slate-200">{block.custodian}</span>
                  </div>
                  <div class="space-y-0.5">
                    <span class="text-[8px] font-mono text-slate-500 block">Geographic Location</span>
                    <span class="font-semibold text-slate-200 transition-colors duration-300 {isFailedThis && idx === brokenIndex ? 'text-red-400 font-extrabold bg-red-500/5 px-1 border border-red-500/20 rounded' : ''}">
                      {block.location}
                    </span>
                  </div>
                </div>

                <!-- Cryptographic metadata hashes -->
                <div class="border-t border-white/5 pt-1.5 text-[8px] font-mono space-y-0.5 text-slate-500">
                  <div class="flex items-center justify-between">
                    <span>Current Block Hash:</span>
                    <span class="text-slate-400 truncate max-w-[170px] select-all">{block.blockHash}</span>
                  </div>
                  {#if idx > 0}
                    <div class="flex items-center justify-between">
                      <span>Previous Block Hash:</span>
                      <span class="text-slate-400 truncate max-w-[170px] select-all">{block.previousBlockHash}</span>
                    </div>
                  {/if}
                  <div class="flex items-center justify-between">
                    <span>ECDSA Signature:</span>
                    <span class="truncate max-w-[170px] select-all {isFailedThis ? 'text-red-400 font-bold' : 'text-slate-500'}">
                      {isFailedThis ? 'HASH_MISMATCH_INVALID_SIGNATURE' : block.signature.substring(0, 32)}...
                    </span>
                  </div>
                </div>

              </div>
            </div>
          {/each}
        </div>
      {/if}

    </div>

  </div>
</div>

<style>
  /* Auditing laser scanner animation */
  .animate-pulse-fast {
    animation: pulse 1s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: .4;
    }
  }

  /* Shaking animation when block verification fails */
  .shake-node {
    animation: shake 0.4s ease-in-out;
  }
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    20%, 60% { transform: translateX(-4px); }
    40%, 80% { transform: translateX(4px); }
  }

  /* Particle burst animations for tampered database explosion */
  .animate-particle-1 { animation: explode-1 0.7s ease-out forwards; }
  .animate-particle-2 { animation: explode-2 0.7s ease-out forwards; }
  .animate-particle-3 { animation: explode-3 0.7s ease-out forwards; }
  .animate-particle-4 { animation: explode-4 0.7s ease-out forwards; }

  @keyframes explode-1 {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(-30px, -20px) scale(0); opacity: 0; }
  }
  @keyframes explode-2 {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(25px, -35px) scale(0); opacity: 0; }
  }
  @keyframes explode-3 {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(-15px, 30px) scale(0); opacity: 0; }
  }
  @keyframes explode-4 {
    0% { transform: translate(0, 0) scale(1); opacity: 1; }
    100% { transform: translate(35px, 20px) scale(0); opacity: 0; }
  }
  
  :global(.shadow-glow-blue\/20) {
    box-shadow: 0 0 15px rgba(59, 130, 246, 0.2);
  }
  :global(.shadow-glow-green\/20) {
    box-shadow: 0 0 15px rgba(74, 222, 128, 0.25);
  }
  :global(.shadow-glow-red\/20) {
    box-shadow: 0 0 15px rgba(239, 68, 68, 0.3);
  }
</style>
