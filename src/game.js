const Game = (() => {
  const STORAGE_KEY = "datacentre-game-v3";
  const SAVE_INTERVAL = 10000;
  const TICK_INTERVAL = 100;

  const IPO_BASE_TARGET = 1_000_000;
  const IPO_PRESTIGE_MULTIPLIER = 12;
  const GENERATOR_COST_GROWTH = 1.13;
  const RACK_COST_GROWTH = 1.45;

  const GENERATORS = [
    { id: "shared", short: "SHR", icon: "🖥", name: "Shared Hosting Box", baseCost: 15, baseRate: 0.22 },
    { id: "vps", short: "VPS", icon: "🧱", name: "VPS Instance", baseCost: 90, baseRate: 1.9 },
    { id: "dedicated", short: "DED", icon: "🗄", name: "Dedicated Server", baseCost: 540, baseRate: 15.8 },
    { id: "rack", short: "RCK", icon: "📦", name: "Server Rack", baseCost: 3240, baseRate: 126.4 },
    { id: "pod", short: "POD", icon: "🏢", name: "Data Centre Pod", baseCost: 19440, baseRate: 1011.2 },
    { id: "region", short: "REG", icon: "🌐", name: "Hyperscale Region", baseCost: 116640, baseRate: 8089.6 },
    { id: "cable", short: "CBL", icon: "🌊", name: "Submarine Cable", baseCost: 699840, baseRate: 64716.8 },
    { id: "orbital", short: "ORB", icon: "🛰", name: "Orbital Compute Node", baseCost: 4199040, baseRate: 517734.4 }
  ];

  const REGIONS = [
    { id: "london", name: "London", lat: 51.5, lng: -0.1, unlockPrestige: 0, powerCost: 1.0, coolingBonus: 1.0 },
    { id: "frankfurt", name: "Frankfurt", lat: 50.1, lng: 8.7, unlockPrestige: 3, powerCost: 0.9, coolingBonus: 1.05 },
    { id: "ashburn", name: "Ashburn", lat: 39.0, lng: -77.5, unlockPrestige: 3, powerCost: 0.85, coolingBonus: 1.0 },
    { id: "singapore", name: "Singapore", lat: 1.3, lng: 103.8, unlockPrestige: 2, powerCost: 1.1, coolingBonus: 0.92 },
    { id: "sydney", name: "Sydney", lat: -33.9, lng: 151.2, unlockPrestige: 2, powerCost: 1.05, coolingBonus: 1.02 },
    { id: "sao-paulo", name: "Sao Paulo", lat: -23.5, lng: -46.6, unlockPrestige: 1, powerCost: 1.15, coolingBonus: 0.95 },
    { id: "tokyo", name: "Tokyo", lat: 35.7, lng: 139.7, unlockPrestige: 1, powerCost: 1.2, coolingBonus: 0.9 }
  ];

  const CABLE_ROUTES = {
    "atlantic-1": { from: "london", to: "ashburn", label: "TAT-14" },
    "atlantic-2": { from: "frankfurt", to: "ashburn", label: "AEC-2" },
    "pacific-1": { from: "ashburn", to: "tokyo", label: "FASTER" },
    "southeast-1": { from: "frankfurt", to: "singapore", label: "SEA-ME-WE 5" },
    transpacific: { from: "singapore", to: "sydney", label: "APX" },
    southatlantic: { from: "london", to: "sao-paulo", label: "EllaLink" }
  };

  const INCIDENT_DEFS = [
    { id: "power", label: "Power distribution fault", message: "⚠ Production incident — CU/s reduced 20%." },
    { id: "routing", label: "Transit routing instability", message: "⚠ Production incident — CU/s reduced 20%." },
    { id: "ops", label: "Ops escalation backlog", message: "⚠ Production incident — CU/s reduced 20%." }
  ];

  const BRANCHES = ["hardware", "network", "engineering", "reliability", "commercial"];

  const DEFAULT_NEWS = [
    "Operations committee reviewed thermal metrics and approved cautious optimism.",
    "Procurement confirmed that premium invoices improve enterprise confidence.",
    "Network team renamed latency variance to distributional flexibility.",
    "NimbusCore published a new reliability posture deck.",
    "Client onboarding throughput increased after quarterly alignment workshop."
  ];

  function makeGeneratorsRecord() {
    return Object.fromEntries(GENERATORS.map((g) => [g.id, { owned: 0, level: 0 }]));
  }

  function makeGeneratorThresholdUnlocks() {
    return Object.fromEntries(GENERATORS.map((g) => [g.id, g.id === "shared" || g.id === "vps"]));
  }

  function getRegionById(regionId) {
    return REGIONS.find((region) => region.id === regionId) || null;
  }

  function makeDatacentre(regionId) {
    const region = getRegionById(regionId) || REGIONS[0];
    return {
      id: region.id,
      name: region.name,
      lat: region.lat,
      lng: region.lng,
      unlocked: true,
      generators: makeGeneratorsRecord(),
      racks: 1,
      usedSlots: 0,
      productionMultiplier: region.coolingBonus / region.powerCost,
      powerCostMultiplier: region.powerCost
    };
  }

  function getIpoTarget(stateOrPrestige) {
    const prestigeCount = typeof stateOrPrestige === "number"
      ? Math.max(0, stateOrPrestige)
      : Math.max(0, stateOrPrestige.prestigeCount || 0);
    const targetMultiplier = typeof stateOrPrestige === "number"
      ? 1
      : Math.max(0.1, stateOrPrestige.ipoTargetMultiplier || 1);
    return Math.floor(IPO_BASE_TARGET * Math.pow(IPO_PRESTIGE_MULTIPLIER, prestigeCount) * targetMultiplier);
  }

  function createInitialState() {
    return {
      cu: 0,
      lifetimeCU: 0,
      clients: 0,

      prestigeCount: 0,
      prestigeTokens: 0,
      carryoverBonuses: {},

      racks: 1,
      slotsPerRack: 8,
      totalSlots: 8,
      usedSlots: 0,
      generators: makeGeneratorsRecord(),
      generatorThresholdUnlocks: makeGeneratorThresholdUnlocks(),

      unlockedNodes: ["ops-core"],
      skillTreeVisible: true,
      buyMode: "x1",

      activeDatacentreId: "london",
      datacentres: { london: makeDatacentre("london") },

      globeVisible: false,
      cables: [],
      satellites: [],

      ipoTarget: IPO_BASE_TARGET,
      ipoUnlocked: false,

      incidentLoad: 1,
      incidentReductionMultiplier: 1.0,
      activeIncident: null,

      generatorCostMultiplier: 1,
      globalProductionMultiplier: 1,
      generatorMultipliers: {},
      clickMultiplier: 1,
      clientMultiplier: 1,
      clientChurnMultiplier: 1,
      ipoTargetMultiplier: 1,
      ipoProgressVisible: false,
      peakRate: 0,
      carryoverRateBonus: 0,

      lastTick: Date.now(),
      totalPlaytime: 0,
      tickerMessages: [...DEFAULT_NEWS]
    };
  }

  const SKILL_NODES = [
    { id: "ops-core", label: "Operations Core", flavour: "The foundation of everything.", branch: "core", tier: 0, tokenCost: 0, requires: [], prestigeRequired: 0, visible: true, icon: "◉", effectText: "Unlocks all Tier 1 branches", effect: () => {} },

    { id: "vendor-negotiations", label: "Vendor Negotiations", flavour: "Finance found a cheaper supplier.", branch: "hardware", tier: 1, tokenCost: 1, requires: ["ops-core"], prestigeRequired: 0, visible: true, icon: "💼", effectText: "-5% generator cost", effect: (state) => { state.generatorCostMultiplier *= 0.95; } },
    { id: "bulk-procurement", label: "Bulk Procurement", flavour: "Quantity discounts. Mostly on things we do not need.", branch: "hardware", tier: 2, tokenCost: 3, requires: ["vendor-negotiations"], prestigeRequired: 0, visible: true, icon: "📦", effectText: "-15% generator cost", effect: (state) => { state.generatorCostMultiplier *= 0.85; } },
    { id: "reserved-capacity", label: "Reserved Capacity", flavour: "A rack. Bolted to the floor. Nobody asked where.", branch: "hardware", tier: 3, tokenCost: 6, requires: ["bulk-procurement"], prestigeRequired: 0, visible: true, icon: "🗄", effectText: "+2 slots per rack", effect: (state) => { state.slotsPerRack += 2; } },
    { id: "hardware-lifecycle", label: "Hardware Lifecycle Management", flavour: "Depreciation schedules, optimised.", branch: "hardware", tier: 4, tokenCost: 12, requires: ["reserved-capacity"], prestigeRequired: 1, visible: true, icon: "♻", effectText: "+10% global production", effect: (state) => { state.globalProductionMultiplier *= 1.1; } },
    { id: "hyperscale-contracts", label: "Hyperscale Contracts ★", flavour: "Tier 2 rack hardware unlocked.", branch: "hardware", tier: 5, tokenCost: 40, requires: ["hardware-lifecycle"], prestigeRequired: 2, visible: false, icon: "★", effectText: "Carryover: +2 slots/rack and tier2 rack access", effect: (state) => { state.carryoverBonuses.tier2Racks = true; state.slotsPerRack += 2; } },

    { id: "bgp-routing", label: "BGP Routing Optimisation", flavour: "Routes traffic efficiently. Mostly.", branch: "network", tier: 1, tokenCost: 1, requires: ["ops-core"], prestigeRequired: 0, visible: true, icon: "🧭", effectText: "+5% global production", effect: (state) => { state.globalProductionMultiplier *= 1.05; } },
    { id: "peering-agreements", label: "Peering Agreements", flavour: "Handshakes with ISPs. Real handshakes.", branch: "network", tier: 2, tokenCost: 4, requires: ["bgp-routing"], prestigeRequired: 0, visible: true, icon: "🤝", effectText: "+20% submarine cable production", effect: (state) => { state.generatorMultipliers.cable = (state.generatorMultipliers.cable || 1) * 1.2; } },
    { id: "cdn-layer", label: "CDN Layer", flavour: "Content cached globally.", branch: "network", tier: 3, tokenCost: 7, requires: ["peering-agreements"], prestigeRequired: 0, visible: true, icon: "🌍", effectText: "+12% global production", effect: (state) => { state.globalProductionMultiplier *= 1.12; } },
    { id: "subsea-expansion", label: "Subsea Expansion", flavour: "A second cable route unlocked.", branch: "network", tier: 4, tokenCost: 14, requires: ["cdn-layer", "multi-az-redundancy"], prestigeRequired: 1, visible: true, icon: "🌊", effectText: "Adds atlantic-2 cable route", effect: (state) => { if (!state.cables.some((c) => c.route === "atlantic-2")) state.cables.push({ route: "atlantic-2", active: true }); } },
    { id: "leo-uplink", label: "Low-Earth Orbit Uplink ★", flavour: "Latency sold as strategic orbit.", branch: "network", tier: 5, tokenCost: 45, requires: ["subsea-expansion"], prestigeRequired: 2, visible: false, icon: "🛰", effectText: "+50% orbital production and satellites", effect: (state) => { state.generatorMultipliers.orbital = (state.generatorMultipliers.orbital || 1) * 1.5; state.carryoverBonuses.orbitalUnlocked = true; if (!state.satellites.length) state.satellites.push({ orbit: "LEO-1", active: true, animated: true }, { orbit: "LEO-2", active: true, animated: true }); } },

    { id: "runbook-standardisation", label: "Runbook Standardisation", flavour: "Manual operations are now documented. Mostly.", branch: "engineering", tier: 1, tokenCost: 1, requires: ["ops-core"], prestigeRequired: 0, visible: true, icon: "📘", effectText: "2x click value", effect: (state) => { state.clickMultiplier *= 2; } },
    { id: "cicd-pipeline", label: "CI/CD Pipeline", flavour: "Deploys run automatically. Breaks run automatically too.", branch: "engineering", tier: 2, tokenCost: 3, requires: ["runbook-standardisation"], prestigeRequired: 0, visible: true, icon: "🔁", effectText: "+8% global production", effect: (state) => { state.globalProductionMultiplier *= 1.08; } },
    { id: "iac", label: "Infrastructure as Code", flavour: "Terraform. Or Pulumi. Or both.", branch: "engineering", tier: 3, tokenCost: 8, requires: ["cicd-pipeline"], prestigeRequired: 0, visible: true, icon: "🧱", effectText: "-10% costs and +10% production", effect: (state) => { state.generatorCostMultiplier *= 0.9; state.globalProductionMultiplier *= 1.1; } },
    { id: "kubernetes-orchestration", label: "Kubernetes Orchestration", flavour: "Nobody knows what it does. Production up.", branch: "engineering", tier: 4, tokenCost: 15, requires: ["iac", "runbook-standardisation"], prestigeRequired: 1, visible: true, icon: "☸", effectText: "+25% dedicated and rack production", effect: (state) => { state.generatorMultipliers.dedicated = (state.generatorMultipliers.dedicated || 1) * 1.25; state.generatorMultipliers.rack = (state.generatorMultipliers.rack || 1) * 1.25; } },
    { id: "autonomous-ops", label: "Autonomous Ops ★", flavour: "The system pages itself. Then fixes itself. Mostly.", branch: "engineering", tier: 5, tokenCost: 50, requires: ["kubernetes-orchestration", "on-call-rota"], prestigeRequired: 2, visible: false, icon: "🤖", effectText: "Carryover: 60s passive CU after prestige", effect: (state) => { state.carryoverBonuses.passiveCUOnPrestige = true; } },

    { id: "on-call-rota", label: "On-Call Rota", flavour: "Engineers now paged at 3am. Voluntarily.", branch: "reliability", tier: 1, tokenCost: 2, requires: ["ops-core"], prestigeRequired: 0, visible: true, icon: "📟", effectText: "-20% incident load", effect: (state) => { state.incidentReductionMultiplier *= 0.8; } },
    { id: "sla-framework", label: "SLA Framework", flavour: "Legally binding. Operationally aspirational.", branch: "reliability", tier: 2, tokenCost: 4, requires: ["on-call-rota"], prestigeRequired: 0, visible: true, icon: "📄", effectText: "-25% client churn", effect: (state) => { state.clientChurnMultiplier *= 0.75; } },
    { id: "chaos-engineering", label: "Chaos Engineering", flavour: "We break it on purpose now. Metrics improved.", branch: "reliability", tier: 3, tokenCost: 9, requires: ["sla-framework"], prestigeRequired: 0, visible: true, icon: "⚡", effectText: "-40% incident load and +5% production", effect: (state) => { state.incidentReductionMultiplier *= 0.6; state.globalProductionMultiplier *= 1.05; } },
    { id: "multi-az-redundancy", label: "Multi-AZ Redundancy", flavour: "Three zones. Two of them worked during the incident.", branch: "reliability", tier: 4, tokenCost: 16, requires: ["chaos-engineering"], prestigeRequired: 1, visible: true, icon: "🏙", effectText: "+30% region production", effect: (state) => { state.generatorMultipliers.region = (state.generatorMultipliers.region || 1) * 1.3; } },
    { id: "five-nines", label: "Five Nines Certification ★", flavour: "99.999% uptime. The 0.001% was a Tuesday.", branch: "reliability", tier: 5, tokenCost: 48, requires: ["multi-az-redundancy"], prestigeRequired: 2, visible: false, icon: "5N", effectText: "Carryover: retain one region setup", effect: (state) => { state.carryoverBonuses.carryForwardOneRegion = true; } },

    { id: "sales-enablement", label: "Sales Enablement Deck", flavour: "Converts latency into account expansion.", branch: "commercial", tier: 1, tokenCost: 1, requires: ["ops-core"], prestigeRequired: 0, visible: true, icon: "📈", effectText: "+10% clients", effect: (state) => { state.clientMultiplier *= 1.1; } },
    { id: "enterprise-pipeline", label: "Enterprise Pipeline", flavour: "Pipeline quality improved through committee.", branch: "commercial", tier: 2, tokenCost: 4, requires: ["sales-enablement"], prestigeRequired: 0, visible: true, icon: "👜", effectText: "+20% clients", effect: (state) => { state.clientMultiplier *= 1.2; } },
    { id: "analyst-coverage", label: "Analyst Coverage", flavour: "Someone wrote a report. It was mostly correct.", branch: "commercial", tier: 3, tokenCost: 7, requires: ["enterprise-pipeline"], prestigeRequired: 0, visible: true, icon: "📰", effectText: "Reveal IPO progress", effect: (state) => { state.ipoProgressVisible = true; } },
    { id: "pre-ipo-roadshow", label: "Pre-IPO Roadshow", flavour: "Investors nodded. One asked about blockchain.", branch: "commercial", tier: 4, tokenCost: 13, requires: ["analyst-coverage"], prestigeRequired: 1, visible: true, icon: "🧾", effectText: "Next IPO target -5%", effect: (state) => { state.ipoTargetMultiplier *= 0.95; } },
    { id: "market-maker", label: "Market Maker ★", flavour: "The float went up. Then sideways. Then up again.", branch: "commercial", tier: 5, tokenCost: 50, requires: ["pre-ipo-roadshow", "five-nines"], prestigeRequired: 2, visible: false, icon: "💹", effectText: "Carryover: +2% of prior peak CU/s", effect: (state) => { state.carryoverBonuses.cuRateCarryover = 0.02; } }
  ];

  const SKILL_BY_ID = Object.fromEntries(SKILL_NODES.map((node) => [node.id, node]));
  const GENERATOR_BY_ID = Object.fromEntries(GENERATORS.map((g) => [g.id, g]));

  function cloneState(state) {
    return {
      ...state,
      carryoverBonuses: { ...(state.carryoverBonuses || {}) },
      generators: Object.fromEntries(GENERATORS.map((g) => [g.id, { ...(state.generators?.[g.id] || { owned: 0, level: 0 }) }])),
      generatorThresholdUnlocks: Object.fromEntries(
        GENERATORS.map((g) => [g.id, state.generatorThresholdUnlocks?.[g.id] ?? (g.id === "shared" || g.id === "vps")])
      ),
      unlockedNodes: [...(state.unlockedNodes || [])],
      datacentres: Object.fromEntries(
        Object.entries(state.datacentres || {}).map(([id, dc]) => [id, {
          ...dc,
          generators: Object.fromEntries(GENERATORS.map((g) => [g.id, { ...(dc.generators?.[g.id] || { owned: 0, level: 0 }) }]))
        }])
      ),
      cables: [...(state.cables || [])],
      satellites: [...(state.satellites || [])],
      tickerMessages: [...(state.tickerMessages || DEFAULT_NEWS)],
      activeIncident: state.activeIncident ? { ...state.activeIncident } : null
    };
  }

  function enqueueTicker(state, message) {
    state.tickerMessages = [...(state.tickerMessages || []), message].slice(-30);
  }

  function getActiveDatacentre(state) {
    return state.datacentres[state.activeDatacentreId];
  }

  function getGeneratorOwned(state, generatorId, datacentreId = state.activeDatacentreId) {
    return state.datacentres?.[datacentreId]?.generators?.[generatorId]?.owned || 0;
  }

  function getTotalOwnedAcrossRegions(state, generatorId) {
    return Object.values(state.datacentres || {}).reduce((sum, dc) => sum + (dc.generators?.[generatorId]?.owned || 0), 0);
  }

  function getUsedSlotsForDatacentre(state, datacentreId = state.activeDatacentreId) {
    const dc = state.datacentres?.[datacentreId];
    if (!dc) return 0;
    return GENERATORS.reduce((sum, generator) => sum + (dc.generators?.[generator.id]?.owned || 0), 0);
  }

  function getTotalSlotsForDatacentre(state, datacentreId = state.activeDatacentreId) {
    const dc = state.datacentres?.[datacentreId];
    if (!dc) return Math.max(0, state.slotsPerRack || 8);
    return Math.max(0, dc.racks * Math.max(1, state.slotsPerRack || 8));
  }

  function syncActiveCapacity(state) {
    const active = getActiveDatacentre(state);
    if (!active) return;
    active.usedSlots = getUsedSlotsForDatacentre(state, active.id);
    state.racks = active.racks;
    state.usedSlots = active.usedSlots;
    state.totalSlots = getTotalSlotsForDatacentre(state, active.id);
  }

  function recomputeGlobalGenerators(state) {
    GENERATORS.forEach((generator) => {
      state.generators[generator.id].owned = Object.values(state.datacentres || {})
        .reduce((sum, dc) => sum + (dc.generators?.[generator.id]?.owned || 0), 0);
    });
  }

  function getPrestigeMultiplier(state) {
    return 1 + Math.max(0, state.prestigeCount || 0) * 0.08;
  }

  function getSkillTreeMultiplier(state, generatorId) {
    return state.generatorMultipliers?.[generatorId] || 1;
  }

  function getPolicyMultiplier() {
    return 1;
  }

  function getGeneratorCost(state, generatorId, datacentreId = state.activeDatacentreId) {
    const generator = GENERATOR_BY_ID[generatorId];
    if (!generator) return Infinity;
    const owned = getGeneratorOwned(state, generatorId, datacentreId);
    return generator.baseCost * Math.pow(GENERATOR_COST_GROWTH, owned) * (state.generatorCostMultiplier || 1);
  }

  function getRackCost(rackCountBeforePurchase) {
    const n = Math.max(1, rackCountBeforePurchase);
    return 2000 * Math.pow(RACK_COST_GROWTH, n - 1);
  }

  function getRegionUnlockCost(region) {
    return 250000 * Math.pow(5, region.unlockPrestige);
  }

  function getBaseUnlockState(state) {
    return {
      rate: getTotalProductionRate(state),
      clients: state.clients,
      lifetimeCU: state.lifetimeCU
    };
  }

  function isGeneratorThresholdConditionMet(generatorId, state) {
    const metrics = getBaseUnlockState(state);
    if (generatorId === "shared" || generatorId === "vps") return true;
    if (generatorId === "dedicated") return metrics.clients >= 25;
    if (generatorId === "rack") return metrics.rate >= 75;
    if (generatorId === "pod") return getTotalOwnedAcrossRegions(state, "rack") >= 6;
    if (generatorId === "region") return getTotalOwnedAcrossRegions(state, "pod") >= 4;
    if (generatorId === "cable") return getTotalOwnedAcrossRegions(state, "region") >= 2;
    if (generatorId === "orbital") return metrics.lifetimeCU >= 350000;
    return true;
  }

  function syncGeneratorThresholdUnlocks(state) {
    if (!state.generatorThresholdUnlocks) {
      state.generatorThresholdUnlocks = makeGeneratorThresholdUnlocks();
    }
    GENERATORS.forEach((generator) => {
      if (state.generatorThresholdUnlocks[generator.id]) return;
      if (isGeneratorThresholdConditionMet(generator.id, state)) {
        state.generatorThresholdUnlocks[generator.id] = true;
      }
    });
  }

  function isGeneratorThresholdUnlocked(generatorId, state) {
    if (state.generatorThresholdUnlocks?.[generatorId]) return true;
    return isGeneratorThresholdConditionMet(generatorId, state);
  }

  function isGeneratorUnlocked(generatorId, state, datacentreId = state.activeDatacentreId) {
    if (!isGeneratorThresholdUnlocked(generatorId, state)) return false;
    return getUsedSlotsForDatacentre(state, datacentreId) < getTotalSlotsForDatacentre(state, datacentreId);
  }

  function getRegionProductionRate(state, datacentreId) {
    const dc = state.datacentres?.[datacentreId];
    if (!dc) return 0;
    return GENERATORS.reduce((sum, generator) => {
      const owned = dc.generators?.[generator.id]?.owned || 0;
      if (!owned) return sum;
      const rate = generator.baseRate
        * (dc.productionMultiplier || 1)
        * (state.globalProductionMultiplier || 1)
        * getSkillTreeMultiplier(state, generator.id)
        * getPrestigeMultiplier(state)
        * getPolicyMultiplier(state, generator.id);
      return sum + rate * owned;
    }, 0);
  }

  function getTotalProductionRate(state) {
    const regional = Object.keys(state.datacentres || {}).reduce(
      (sum, datacentreId) => sum + getRegionProductionRate(state, datacentreId),
      0
    );
    return regional + Math.max(0, state.carryoverRateBonus || 0);
  }

  function getClients(state) {
    const infraOwned = GENERATORS.reduce((sum, generator) => sum + getTotalOwnedAcrossRegions(state, generator.id), 0);
    const demand = Math.pow(Math.max(1, state.lifetimeCU / 10), 0.62);
    const withMultiplier = demand * (state.clientMultiplier || 1);
    const churnAdjusted = withMultiplier * (state.clientChurnMultiplier || 1);
    return Math.max(0, Math.floor(churnAdjusted + infraOwned * 1.4));
  }

  function getIncidentLoad(state) {
    const tiersBeyondVps = ["dedicated", "rack", "pod", "region", "cable", "orbital"];
    const tierCount = tiersBeyondVps.reduce((sum, generatorId) => {
      return sum + (getTotalOwnedAcrossRegions(state, generatorId) > 0 ? 1 : 0);
    }, 0);
    const baseLoad = 1 + tierCount * 0.1;
    return Math.max(0.2, baseLoad * (state.incidentReductionMultiplier || 1));
  }

  function maybeTriggerIncident(state, deltaSeconds, now) {
    if (state.activeIncident) return;
    const lambda = Math.max(0.0001, state.incidentLoad / 120);
    const p = 1 - Math.exp(-lambda * deltaSeconds);
    if (Math.random() > p) return;
    const incident = INCIDENT_DEFS[Math.floor(Math.random() * INCIDENT_DEFS.length)];
    const resolvePercent = 0.2 + Math.random() * 0.4;
    const resolveCost = Math.max(0, state.cu * resolvePercent);
    state.activeIncident = {
      id: incident.id,
      label: incident.label,
      message: incident.message,
      startedAt: now,
      endsAt: now + 15000,
      reduction: 0.2,
      resolvePercent,
      resolveCost
    };
    enqueueTicker(state, "Incident active: " + incident.label + ".");
  }

  function applyUnlockedNodeEffects(state) {
    state.generatorCostMultiplier = 1;
    state.globalProductionMultiplier = 1;
    state.generatorMultipliers = {};
    state.clickMultiplier = 1;
    state.clientMultiplier = 1;
    state.clientChurnMultiplier = 1;
    state.incidentReductionMultiplier = 1;
    state.ipoTargetMultiplier = 1;
    state.ipoProgressVisible = false;
    state.slotsPerRack = 8;

    if (state.carryoverBonuses?.tier2Racks) state.slotsPerRack += 2;

    const unlocked = new Set(state.unlockedNodes || []);
    SKILL_NODES.forEach((node) => {
      if (!unlocked.has(node.id)) return;
      if (typeof node.effect === "function") node.effect(state);
    });

    Object.values(state.datacentres || {}).forEach((dc) => {
      dc.usedSlots = getUsedSlotsForDatacentre(state, dc.id);
    });

    syncActiveCapacity(state);
    state.ipoTarget = getIpoTarget(state);
  }

  function recalculateState(state) {
    applyUnlockedNodeEffects(state);
    recomputeGlobalGenerators(state);
    state.clients = getClients(state);
    syncGeneratorThresholdUnlocks(state);
    state.incidentLoad = getIncidentLoad(state);
    state.ipoTarget = getIpoTarget(state);
    syncActiveCapacity(state);
  }

  function getClickValue(state) {
    return (1 + Math.max(0, state.prestigeCount || 0) * 0.15) * (state.clickMultiplier || 1);
  }

  function getPurchaseQuantity(state, generatorId) {
    const dc = getActiveDatacentre(state);
    if (!dc || !GENERATOR_BY_ID[generatorId]) return 0;
    const availableSlots = Math.max(0, getTotalSlotsForDatacentre(state, dc.id) - getUsedSlotsForDatacentre(state, dc.id));
    const mode = state.buyMode || "x1";
    if (mode === "x1") return Math.min(1, availableSlots);
    if (mode === "x10") return Math.min(10, availableSlots);
    return availableSlots;
  }

  function getGeneratorBuyQuantity(state, generatorId, datacentreId = state.activeDatacentreId) {
    const generator = GENERATOR_BY_ID[generatorId];
    if (!generator) return 0;
    if (!isGeneratorThresholdUnlocked(generatorId, state)) return 0;
    const dc = state.datacentres?.[datacentreId];
    if (!dc) return 0;

    const availableSlots = Math.max(
      0,
      getTotalSlotsForDatacentre(state, datacentreId) - getUsedSlotsForDatacentre(state, datacentreId)
    );
    const mode = state.buyMode || "x1";
    if (mode === "x10" && availableSlots < 10) return 0;
    const targetQty = mode === "x1" ? Math.min(1, availableSlots) : mode === "x10" ? 10 : availableSlots;
    if (targetQty <= 0) return 0;

    const owned = getGeneratorOwned(state, generatorId, datacentreId);
    let simulatedCu = state.cu;
    let buyQty = 0;
    while (buyQty < targetQty) {
      const cost = generator.baseCost * Math.pow(GENERATOR_COST_GROWTH, owned + buyQty) * (state.generatorCostMultiplier || 1);
      if (cost > simulatedCu + 1e-9) break;
      simulatedCu -= cost;
      buyQty += 1;
    }
    if (mode === "x10" && buyQty < 10) return 0;
    return buyQty;
  }

  function buyGenerator(inputState, generatorId) {
    if (!GENERATOR_BY_ID[generatorId]) return inputState;
    const state = cloneState(inputState);
    const dc = getActiveDatacentre(state);
    if (!dc) return inputState;
    if (!isGeneratorThresholdUnlocked(generatorId, state)) return inputState;

    const quantity = getGeneratorBuyQuantity(state, generatorId, dc.id);
    if (quantity <= 0) return inputState;

    let bought = 0;
    while (bought < quantity) {
      const used = getUsedSlotsForDatacentre(state, dc.id);
      const total = getTotalSlotsForDatacentre(state, dc.id);
      if (used >= total) break;
      const cost = getGeneratorCost(state, generatorId, dc.id);
      if (cost > state.cu + 1e-9) break;
      state.cu -= cost;
      dc.generators[generatorId].owned += 1;
      bought += 1;
    }

    if (!bought) return inputState;

    dc.usedSlots = getUsedSlotsForDatacentre(state, dc.id);
    recalculateState(state);
    return state;
  }

  function getGeneratorSellRefund(state, generatorId, datacentreId = state.activeDatacentreId) {
    const generator = GENERATOR_BY_ID[generatorId];
    if (!generator) return 0;
    const owned = getGeneratorOwned(state, generatorId, datacentreId);
    if (owned <= 0) return 0;
    const nextCostAfterSale = generator.baseCost * Math.pow(GENERATOR_COST_GROWTH, owned - 1) * (state.generatorCostMultiplier || 1);
    return nextCostAfterSale * 0.5;
  }

  function sellGenerator(inputState, generatorId) {
    const generator = GENERATOR_BY_ID[generatorId];
    if (!generator) return inputState;
    const state = cloneState(inputState);
    const dc = getActiveDatacentre(state);
    if (!dc) return inputState;
    const owned = dc.generators?.[generatorId]?.owned || 0;
    if (owned <= 0) return inputState;

    const refund = getGeneratorSellRefund(state, generatorId, dc.id);
    dc.generators[generatorId].owned -= 1;
    state.cu += refund;
    dc.usedSlots = getUsedSlotsForDatacentre(state, dc.id);
    recalculateState(state);
    return state;
  }

  function buyRack(inputState) {
    const state = cloneState(inputState);
    const dc = getActiveDatacentre(state);
    if (!dc) return inputState;
    const cost = getRackCost(dc.racks);
    if (state.cu < cost) return inputState;
    state.cu -= cost;
    dc.racks += 1;
    syncActiveCapacity(state);
    return state;
  }

  function setBuyMode(inputState, mode) {
    const next = cloneState(inputState);
    next.buyMode = mode;
    return next;
  }

  function unlockRegion(inputState, regionId) {
    const region = getRegionById(regionId);
    if (!region) return inputState;
    if (inputState.datacentres?.[regionId]?.unlocked) return inputState;
    if ((inputState.prestigeCount || 0) < region.unlockPrestige) return inputState;

    const cost = getRegionUnlockCost(region);
    if (inputState.cu < cost) return inputState;

    const state = cloneState(inputState);
    state.cu -= cost;
    state.datacentres[region.id] = makeDatacentre(region.id);
    if (region.id === "ashburn" && !state.cables.some((c) => c.route === "atlantic-1")) {
      state.cables.push({ route: "atlantic-1", active: true });
    }
    enqueueTicker(state, region.name + " datacentre unlocked.");
    recalculateState(state);
    return state;
  }

  function setActiveDatacentre(inputState, regionId) {
    if (!inputState.datacentres?.[regionId]?.unlocked) return inputState;
    const state = cloneState(inputState);
    state.activeDatacentreId = regionId;
    syncActiveCapacity(state);
    return state;
  }

  function isNodeVisible(node, state) {
    if (node.visible === false) return (state.prestigeCount || 0) >= 1;
    return true;
  }

  function canPurchaseNode(node, state) {
    if (!isNodeVisible(node, state)) return false;
    if ((state.unlockedNodes || []).includes(node.id)) return false;
    if ((state.prestigeCount || 0) < node.prestigeRequired) return false;
    if ((state.prestigeTokens || 0) < node.tokenCost) return false;
    return node.requires.every((requiredId) => (state.unlockedNodes || []).includes(requiredId));
  }

  function buySkillNode(inputState, nodeId) {
    const node = SKILL_BY_ID[nodeId];
    if (!node || node.id === "ops-core") return inputState;
    const state = cloneState(inputState);
    if (!canPurchaseNode(node, state)) return inputState;
    state.prestigeTokens -= node.tokenCost;
    state.unlockedNodes = [...new Set([...(state.unlockedNodes || []), node.id])];
    enqueueTicker(state, "Skill unlocked: " + node.label + ".");
    recalculateState(state);
    return state;
  }

  function provisionClick(inputState) {
    const state = cloneState(inputState);
    const gain = getClickValue(state);
    state.cu += gain;
    state.lifetimeCU += gain;
    state.clients = getClients(state);
    syncGeneratorThresholdUnlocks(state);
    state.ipoUnlocked = state.lifetimeCU >= state.ipoTarget;
    return { state, gain };
  }

  function maybeOpenPrestige(state) {
    return state.lifetimeCU >= state.ipoTarget;
  }

  function applyPrestige(inputState) {
    if (!maybeOpenPrestige(inputState)) return inputState;

    const previous = cloneState(inputState);
    const performanceTokens =
      Math.floor(Math.log(Math.max(1, previous.lifetimeCU)) / Math.log(1000)) +
      ((previous.prestigeCount || 0) * 2);
    const unlockedRegionIds = Object.keys(previous.datacentres || {}).filter((id) => previous.datacentres[id]?.unlocked);

    const next = createInitialState();
    next.prestigeCount = (previous.prestigeCount || 0) + 1;
    next.prestigeTokens = Math.max(0, previous.prestigeTokens || 0) + Math.max(0, performanceTokens);
    next.unlockedNodes = [...new Set(["ops-core", ...(previous.unlockedNodes || [])])];
    next.carryoverBonuses = { ...(previous.carryoverBonuses || {}) };
    next.buyMode = previous.buyMode || "x1";

    next.datacentres = {};
    unlockedRegionIds.forEach((regionId) => {
      next.datacentres[regionId] = makeDatacentre(regionId);
    });
    if (!next.datacentres.london) next.datacentres.london = makeDatacentre("london");

    const priorActive = previous.activeDatacentreId;
    next.activeDatacentreId = next.datacentres[priorActive] ? priorActive : "london";

    applyUnlockedNodeEffects(next);

    if (next.carryoverBonuses.carryForwardOneRegion && previous.datacentres[priorActive] && next.datacentres[priorActive]) {
      next.datacentres[priorActive].generators = Object.fromEntries(
        GENERATORS.map((generator) => [generator.id, {
          ...(previous.datacentres[priorActive].generators?.[generator.id] || { owned: 0, level: 0 })
        }])
      );
      next.datacentres[priorActive].racks = previous.datacentres[priorActive].racks || 1;
    }

    next.carryoverRateBonus = 0;
    if (next.carryoverBonuses.cuRateCarryover) {
      next.carryoverRateBonus = Math.max(0, previous.peakRate || 0) * next.carryoverBonuses.cuRateCarryover;
    }

    recalculateState(next);

    if (next.carryoverBonuses.passiveCUOnPrestige) {
      const passiveGain = getTotalProductionRate(next) * 60;
      next.cu += passiveGain;
      next.lifetimeCU += passiveGain;
    }

    next.ipoTarget = getIpoTarget(next);
    next.ipoUnlocked = false;
    enqueueTicker(next, "Prestige complete. Awarded " + formatNumber(performanceTokens) + " prestige tokens.");
    return next;
  }

  function resolveIncident(inputState) {
    if (!inputState.activeIncident) return inputState;
    const state = cloneState(inputState);
    const cost = state.activeIncident.resolveCost || 0;
    if (state.cu < cost) return inputState;
    state.cu -= cost;
    state.activeIncident = null;
    enqueueTicker(state, "Incident manually resolved for " + formatCU(cost) + ".");
    return state;
  }

  function getIncidentResolveCost(state) {
    return state.activeIncident?.resolveCost || 0;
  }

  function tickState(inputState, deltaSeconds, now = Date.now()) {
    const state = cloneState(inputState);
    const safeDelta = Math.max(0, Math.min(1, deltaSeconds));
    state.totalPlaytime += safeDelta;

    if (state.activeIncident && now >= state.activeIncident.endsAt) {
      enqueueTicker(state, "Incident resolved: " + state.activeIncident.label + ".");
      state.activeIncident = null;
    }

    const baseRate = getTotalProductionRate(state);
    state.peakRate = Math.max(state.peakRate || 0, baseRate);
    const incidentMultiplier = state.activeIncident ? Math.max(0.1, 1 - state.activeIncident.reduction) : 1;
    const gain = baseRate * incidentMultiplier * safeDelta;

    state.cu += gain;
    state.lifetimeCU += gain;
    state.clients = getClients(state);
    syncGeneratorThresholdUnlocks(state);
    state.incidentLoad = getIncidentLoad(state);
    maybeTriggerIncident(state, safeDelta, now);
    state.ipoUnlocked = state.lifetimeCU >= state.ipoTarget;
    state.lastTick = now;
    return state;
  }

  function prepareSaveState(state) {
    const next = cloneState(state);
    next.lastTick = Date.now();
    return next;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prepareSaveState(state)));
  }

  function migrateLoadedState(parsed) {
    const base = createInitialState();
    const merged = {
      ...base,
      ...parsed,
      carryoverBonuses: { ...base.carryoverBonuses, ...(parsed.carryoverBonuses || {}) },
      unlockedNodes: Array.isArray(parsed.unlockedNodes) && parsed.unlockedNodes.length ? [...new Set(parsed.unlockedNodes)] : [...base.unlockedNodes],
      generators: makeGeneratorsRecord(),
      generatorThresholdUnlocks: { ...makeGeneratorThresholdUnlocks(), ...(parsed.generatorThresholdUnlocks || {}) },
      datacentres: { ...base.datacentres },
      tickerMessages: Array.isArray(parsed.tickerMessages) && parsed.tickerMessages.length ? [...parsed.tickerMessages] : [...base.tickerMessages]
    };

    const parsedDatacentres = parsed.datacentres || {};
    Object.keys(parsedDatacentres).forEach((regionId) => {
      const dc = parsedDatacentres[regionId];
      merged.datacentres[regionId] = {
        ...makeDatacentre(regionId),
        ...dc,
        generators: Object.fromEntries(
          GENERATORS.map((generator) => [generator.id, {
            ...(dc.generators?.[generator.id] || { owned: 0, level: 0 })
          }])
        )
      };
    });

    if (!merged.datacentres.london) merged.datacentres.london = makeDatacentre("london");
    if (!merged.datacentres[merged.activeDatacentreId]) merged.activeDatacentreId = "london";
    if (!merged.unlockedNodes.includes("ops-core")) merged.unlockedNodes.unshift("ops-core");
    if (!["x1", "x10", "MAX"].includes(merged.buyMode)) merged.buyMode = "x1";

    recalculateState(merged);
    return merged;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const fresh = createInitialState();
      recalculateState(fresh);
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw);
      const state = migrateLoadedState(parsed);
      const elapsedSeconds = Math.min(3600, Math.max(0, (Date.now() - (parsed.lastTick || Date.now())) / 1000));
      if (elapsedSeconds > 0) {
        const offlineGain = getTotalProductionRate(state) * elapsedSeconds;
        state.cu += offlineGain;
        state.lifetimeCU += offlineGain;
        state.clients = getClients(state);
        state.ipoUnlocked = state.lifetimeCU >= state.ipoTarget;
      }
      return state;
    } catch (error) {
      console.warn("Save load failed", error);
      const fresh = createInitialState();
      recalculateState(fresh);
      return fresh;
    }
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) return "0";
    const abs = Math.abs(value);
    if (abs >= 1e12) return (value / 1e12).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "T";
    if (abs >= 1e9) return (value / 1e9).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "B";
    if (abs >= 1e6) return (value / 1e6).toFixed(2).replace(/0+$/, "").replace(/\.$/, "") + "M";
    if (abs >= 1000) return Math.round(value).toLocaleString("en-GB");
    return value.toFixed(abs >= 10 ? 1 : 2).replace(/0+$/, "").replace(/\.$/, "");
  }

  function formatCU(value) {
    return formatNumber(value) + " CU";
  }

  function formatRate(value) {
    return "▲ " + formatNumber(value) + " CU/s";
  }

  function getVisibleNodes(state) {
    return SKILL_NODES.filter((node) => isNodeVisible(node, state));
  }

  function getNodeUi(state, node) {
    const unlocked = (state.unlockedNodes || []).includes(node.id);
    const purchasable = canPurchaseNode(node, state);
    return {
      ...node,
      unlocked,
      purchasable,
      locked: !unlocked && !purchasable
    };
  }

  function getRegionUi(state) {
    return REGIONS.map((region) => {
      const unlocked = !!state.datacentres?.[region.id]?.unlocked;
      return {
        ...region,
        unlocked,
        active: state.activeDatacentreId === region.id,
        unlockCost: getRegionUnlockCost(region),
        production: unlocked ? getRegionProductionRate(state, region.id) : 0,
        racks: unlocked ? state.datacentres[region.id].racks : 0
      };
    });
  }

  function getIncidentBanner(state) {
    if (!state.activeIncident) return null;
    const remainMs = Math.max(0, state.activeIncident.endsAt - Date.now());
    const remainS = Math.ceil(remainMs / 1000);
    return "⚠ Production incident — CU/s reduced 20% · " + state.activeIncident.label + " · " + remainS + "s remaining";
  }

  function getTelemetrySnapshot(state, now = Date.now()) {
    return {
      t: now,
      rate: getTotalProductionRate(state),
      clients: state.clients,
      cu: state.cu
    };
  }

  function getTelemetryDeltas(telemetry) {
    if (!telemetry.length) return { rateDeltaMinute: 0 };
    const latest = telemetry[telemetry.length - 1];
    const previous = telemetry.find((entry) => entry.t >= latest.t - 60000) || telemetry[0];
    return {
      rateDeltaMinute: latest.rate - previous.rate
    };
  }

  return {
    STORAGE_KEY,
    SAVE_INTERVAL,
    TICK_INTERVAL,
    GENERATORS,
    REGIONS,
    CABLE_ROUTES,
    SKILL_NODES,
    BRANCHES,
    createInitialState,
    cloneState,
    prepareSaveState,
    loadState,
    saveState,
    tickState,
    buyGenerator,
    sellGenerator,
    getGeneratorBuyQuantity,
    setBuyMode,
    buyRack,
    unlockRegion,
    setActiveDatacentre,
    buySkillNode,
    provisionClick,
    resolveIncident,
    maybeOpenPrestige,
    applyPrestige,
    getIpoTarget,
    getGeneratorCost,
    getGeneratorSellRefund,
    getRackCost,
    getRegionUnlockCost,
    getGeneratorOwned,
    getTotalOwnedAcrossRegions,
    isGeneratorThresholdUnlocked,
    isGeneratorUnlocked,
    getUsedSlotsForDatacentre,
    getTotalSlotsForDatacentre,
    getRegionProductionRate,
    getTotalProductionRate,
    getClients,
    getClickValue,
    getPrestigeMultiplier,
    getSkillTreeMultiplier,
    getPolicyMultiplier,
    getVisibleNodes,
    getNodeUi,
    getRegionUi,
    getIncidentBanner,
    getIncidentResolveCost,
    getTelemetrySnapshot,
    getTelemetryDeltas,
    formatNumber,
    formatCU,
    formatRate
  };
})();

export default Game;
