const NimbusCoreGame = (() => {
  const STORAGE_KEY = "nimbuscore-save-react-v1";
  const IPO_TARGET = 2000000;
  const IPO_TARGET_PRESTIGE_SCALE = 1.25;
  const BOARD_VOTE_BASE_STEP = 350000;
  const BOARD_VOTE_STEP_GROWTH = 1.35;
  const INCIDENT_UNLOCK_RATE = 50;
  const INCIDENT_INTERVAL_MIN = 180000;
  const INCIDENT_INTERVAL_MAX = 360000;
  const UNLOCK_ETA_CACHE_TTL_MS = 4000;
  const SAVE_INTERVAL = 10000;
  const TICK_INTERVAL = 100;

  const GENERATORS = [
    { id: "shared", short: "SHR", icon: "🖥", name: "Shared Hosting Box", baseCost: 15, baseRate: 0.22, unlock: () => true },
    { id: "vps", short: "VPS", icon: "🧱", name: "VPS Instance", baseCost: 135, baseRate: 1.76, unlock: () => true },
    { id: "dedicated", short: "DED", icon: "🗄", name: "Dedicated Server", baseCost: 1100, baseRate: 14.08, unlock: (state) => getClients(state) >= 50 },
    { id: "rack", short: "RCK", icon: "📦", name: "Server Rack", baseCost: 8800, baseRate: 112.64, unlock: (state) => getProductionRate(state) >= 200 },
    { id: "pod", short: "POD", icon: "🏢", name: "Data Centre Pod", baseCost: 70400, baseRate: 901.12, unlock: (state) => getGeneratorOwned(state, "rack") >= 10 },
    { id: "region", short: "REG", icon: "🌐", name: "Hyperscale Region", baseCost: 563200, baseRate: 7208.96, unlock: (state) => getGeneratorOwned(state, "pod") >= 5 },
    { id: "cable", short: "CBL", icon: "🌊", name: "Submarine Cable", baseCost: 4505600, baseRate: 57671.68, unlock: (state) => getGeneratorOwned(state, "region") >= 3 },
    { id: "orbital", short: "ORB", icon: "🛰", name: "Orbital Compute Node", baseCost: 36044800, baseRate: 461373.44, unlock: (state) => state.lifetimeCU >= 500000 }
  ];

  const UPGRADE_META = {
    blockchain: { type: "Legacy", appliesTo: "None", label: "no production change", metric: "none" },
    agile: { type: "Multiplier", appliesTo: "Manual provisioning", label: "click value", metric: "click" },
    dashboard: { type: "Multiplier", appliesTo: "All infrastructure", label: "all production", metric: "rate" },
    "sales-enablement": { type: "Multiplier", appliesTo: "Client growth", label: "client count", metric: "clients" },
    kubernetes: { type: "Multiplier", appliesTo: "Server production", label: "server production", metric: "rate" },
    reserved: { type: "Discount", appliesTo: "Next generator purchase", label: "next infrastructure cost", metric: "cost" },
    offshore: { type: "Multiplier", appliesTo: "All infrastructure", label: "all production", metric: "rate" },
    oncall: { type: "Safeguard", appliesTo: "Incident system", label: "incident load", metric: "incidents" },
    ai: { type: "Multiplier", appliesTo: "All production", label: "all CU/s", metric: "rate" }
  };

  const UPGRADES = [
    { id: "blockchain", name: "Blockchain (Legacy)", flavour: "Nobody asked for this.", cost: 1, available: () => true },
    { id: "agile", name: "Agile Methodology", flavour: "We move fast. We break things. Mostly SLAs.", cost: 100, available: () => true },
    { id: "dashboard", name: "Synergy Dashboard", flavour: "Adds a dashboard that shows other dashboards.", cost: 500, available: () => true },
    { id: "sales-enablement", name: "Sales Enablement Deck", flavour: "Converts latency into account expansion.", cost: 1500, available: () => true },
    { id: "kubernetes", name: "Kubernetes", flavour: "Nobody knows what it does. Production up 3×.", cost: 2000, available: (state) => getGeneratorOwned(state, "dedicated") > 0 },
    { id: "reserved", name: "Reserved Instances", flavour: "Finance approved a spreadsheet. Costs fell 10%.", cost: 3500, available: (state) => getProductionRate(state) >= 25 },
    { id: "offshore", name: "Offshore Data Centre", flavour: "For latency reasons.", cost: 5000, available: (state) => getProductionRate(state) >= 40 },
    { id: "oncall", name: "Hire On-Call Engineers", flavour: "Incident response moved to a staffed operations rota.", cost: 12000, available: (state) => state.lifetimeCU >= 5000 },
    { id: "ai", name: "AI Integration", flavour: "We added AI to the name. Valuation doubled.", cost: 25000, available: (state) => state.lifetimeCU >= 10000 }
  ];

  const POLICIES = [
    {
      id: "procurement",
      name: "Procurement Governance",
      flavour: "Finance negotiated a better baseline.",
      baseCost: 2,
      costGrowth: 1.5,
      maxLevel: 10,
      appliesTo: "Generator costs",
      effectType: "cost"
    },
    {
      id: "runbooks",
      name: "Provisioning Runbooks",
      flavour: "Manual operations are now documented.",
      baseCost: 2,
      costGrowth: 1.45,
      maxLevel: 10,
      appliesTo: "Click output",
      effectType: "click"
    },
    {
      id: "enterprise",
      name: "Enterprise Partnerships",
      flavour: "Pipeline quality improved through committee.",
      baseCost: 3,
      costGrowth: 1.5,
      maxLevel: 10,
      appliesTo: "Client growth",
      effectType: "clients"
    }
  ];

  const REGIONS = [
    { id: "eu", name: "EU", exposure: 0.0019 },
    { id: "usa", name: "USA", exposure: 0.0013 },
    { id: "apac", name: "APAC", exposure: 0.0015 },
    { id: "uk", name: "UK", exposure: 0.0012 },
    { id: "latam", name: "LATAM", exposure: 0.0011 }
  ];

  const BASE_NEWS = [
    "NimbusCore™ announces record uptime of 99.1% and a renewed focus on narrative quality.",
    "Client asks what the cloud actually is. Ticket marked WONTFIX.",
    "GDPR fine issued. Legal team responds with a 47-page PDF.",
    "CEO spotted at re:Invent wearing a NimbusCore™ fleece vest.",
    "New pricing tier introduced: costs more, does less.",
    "Kubernetes cluster achieved sentience. Ops team remains unaware.",
    "EU regulators open investigation. Compliance team adds checkbox.",
    "Analyst note describes NimbusCore™ margins as emotionally resilient.",
    "Board approves initiative to rename downtime as unscheduled maintenance theatre.",
    "Enterprise client signs three-year contract after meeting no alternative vendors.",
    "Internal memo confirms synergies are now billable in select regions.",
    "Procurement department praises NimbusCore™ for premium invoice paper quality.",
    "Support queue reclassified as customer engagement funnel.",
    "Finance celebrates quarterly egress performance with a muted spreadsheet.",
    "Consultants recommend a cloud transformation roadmap with seventeen workstreams.",
    "A pilot program for proactive escalation is itself escalated.",
    "Infrastructure team reports all alarms functioning exactly as designed.",
    "Sales introduces strategic urgency to accounts that appeared calm.",
    "Observability dashboard now tracks the health of other observability dashboards.",
    "Pricing committee approves a simpler billing model containing only twelve variables."
  ];

  const INCIDENT_DEFINITIONS = {
    ddos: {
      id: "ddos",
      name: "DDoS Attack",
      description: "Traffic profile degraded. Provisioned output temporarily discounted by 50%.",
      duration: 30000,
      starts(state, _now, severity) {
        state.productionPenalty = Math.min(state.productionPenalty, getDdosPenalty(severity));
      },
      ends(state) {
        state.productionPenalty = 1;
      },
      resolveCost(state) {
        const severity = state.activeIncident?.severity || 1;
        return Math.max(600, Math.floor(getProductionRate(state) * (14 + severity * 6)));
      },
      resolveLabel: "ENABLE FIREWALL",
      ignorePenalty: 0
    },
    devops: {
      id: "devops",
      name: "Disgruntled DevOps Engineer",
      description: "A production tier has entered a performance review cycle.",
      duration: 35000,
      starts(state) {
        const owned = GENERATORS.filter((generator) => getGeneratorOwned(state, generator.id) > 0);
        state.haltedGeneratorId = owned.length ? owned[Math.floor(Math.random() * owned.length)].id : "shared";
      },
      ends(state) {
        state.haltedGeneratorId = null;
      },
      resolveCost(state) {
        const severity = state.activeIncident?.severity || 1;
        const index = Math.max(0, GENERATORS.findIndex((generator) => generator.id === state.haltedGeneratorId));
        return Math.floor(900 * (index + 1) * severity);
      },
      resolveLabel: "PERFORMANCE REVIEW",
      ignorePenalty: 0
    },
    "public-bucket": {
      id: "public-bucket",
      name: "Accidental Public S3 Bucket",
      description: "Exposure has been quantified and reclassified as an unplanned disclosure expense.",
      duration: 18000,
      starts(state, _now, severity) {
        const exposureCharge = Math.floor(240 * severity);
        state.cu = Math.max(0, state.cu - exposureCharge);
      },
      ends() {},
      resolveCost(state) {
        const severity = state.activeIncident?.severity || 1;
        return Math.floor(180 * severity);
      },
      resolveLabel: "CONTAIN BREACH",
      ignorePenalty: 0
    },
    tweet: {
      id: "tweet",
      name: "CEO Tweet",
      description: "Brand momentum increased 3× for 10s, followed by a 20s correction.",
      duration: 30000,
      starts(state, now, severity) {
        const boostSeconds = Math.floor(10 * (1 + Math.max(0, severity - 1) * 0.15));
        const crashSeconds = Math.floor(20 * (1 + Math.max(0, severity - 1) * 0.65));
        state.ceoBoostUntil = now + boostSeconds * 1000;
        state.ceoCrashUntil = state.ceoBoostUntil + crashSeconds * 1000;
        state.ceoCrashMultiplier = getTweetCrashMultiplier(severity);
      },
      ends(state) {
        state.ceoBoostUntil = 0;
        state.ceoCrashUntil = 0;
        state.ceoCrashMultiplier = 0.5;
      },
      resolveCost(state) {
        const severity = state.activeIncident?.severity || 1;
        return Math.max(180, Math.floor(getProductionRate(state) * (1 + severity * 0.9)));
      },
      resolveLabel: "DELETE POST",
      ignorePenalty: 0
    },
    zoom: {
      id: "zoom",
      name: "Zoom Outage",
      description: "No material service impact detected. Productivity revised upward 40%.",
      duration: 12000,
      starts() {},
      ends() {},
      resolveCost() {
        return 0;
      },
      resolveLabel: "ACKNOWLEDGE",
      ignorePenalty: 0
    }
  };

  const unlockEtaCache = new Map();

  function createPolicyLevels() {
    return Object.fromEntries(POLICIES.map((policy) => [policy.id, 0]));
  }

  function getPolicyById(policyId) {
    return POLICIES.find((policy) => policy.id === policyId) || null;
  }

  function getPolicyCost(policy, level) {
    const safeLevel = Math.max(1, level);
    return Math.max(1, Math.ceil(policy.baseCost * Math.pow(policy.costGrowth, safeLevel - 1)));
  }

  function getIncidentSeverity(state) {
    const progress = Math.max(0, state.lifetimeCU / Math.max(1, getIpoTarget(state)));
    const progressFactor = Math.min(2.4, progress);
    const prestigeFactor = Math.max(0, state.prestigeCount || 0) * 0.22;
    return 1.1 + progressFactor * 1.1 + prestigeFactor;
  }

  function getIncidentDurationMultiplier(severity) {
    return Math.min(2.8, 1 + Math.max(0, severity - 1) * 0.7);
  }

  function getDdosPenalty(severity) {
    return Math.max(0.12, 0.45 - Math.max(0, severity - 1) * 0.16);
  }

  function getTweetCrashMultiplier(severity) {
    return Math.max(0.12, 0.45 - Math.max(0, severity - 1) * 0.14);
  }

  function createInitialState() {
    return {
      cu: 20,
      lifetimeCU: 20,
      totalManualClicks: 0,
      clickPower: 1,
      buyMode: "x1",
      generators: Object.fromEntries(GENERATORS.map((generator) => [generator.id, { owned: 0 }])),
      purchasedUpgrades: [],
      policyLevels: createPolicyLevels(),
      boardVotes: 0,
      lifetimeBoardVotes: 0,
      boardVoteBandStart: 0,
      nextBoardVoteStep: BOARD_VOTE_BASE_STEP,
      nextBoardVoteAt: BOARD_VOTE_BASE_STEP,
      productionMultiplier: 1,
      serverProductionMultiplier: 1,
      costMultiplier: 1,
      clientMultiplier: 1,
      legacyMultiplier: 1,
      ipoTargetPenaltyMultiplier: 1,
      formerEmployees: 0,
      prestigeCount: 0,
      productionPenalty: 1,
      haltedGeneratorId: null,
      ceoBoostUntil: 0,
      ceoCrashUntil: 0,
      ceoCrashMultiplier: 0.5,
      incidentsDisabled: false,
      activeIncident: null,
      nextIncidentAt: Date.now() + getNextIncidentDelay(),
      lastSave: Date.now(),
      lastProductionSnapshot: 0,
      offlineEarnings: 0,
      tickerMessages: [...BASE_NEWS]
    };
  }

  function cloneState(state) {
    return {
      ...state,
      purchasedUpgrades: [...state.purchasedUpgrades],
      tickerMessages: [...state.tickerMessages],
      policyLevels: { ...createPolicyLevels(), ...(state.policyLevels || {}) },
      generators: Object.fromEntries(GENERATORS.map((generator) => [generator.id, { ...state.generators[generator.id] }])),
      activeIncident: state.activeIncident ? { ...state.activeIncident } : null
    };
  }

  function getPolicyLevel(state, policyId) {
    return Math.max(0, state.policyLevels?.[policyId] || 0);
  }

  function getPolicyEffects(state) {
    const procurement = getPolicyLevel(state, "procurement");
    const runbooks = getPolicyLevel(state, "runbooks");
    const enterprise = getPolicyLevel(state, "enterprise");
    return {
      costMultiplier: Math.pow(0.97, procurement),
      clickBonus: runbooks,
      clientMultiplier: Math.pow(1.08, enterprise)
    };
  }

  function getClickValue(state) {
    const policyEffects = getPolicyEffects(state);
    return (state.clickPower + policyEffects.clickBonus) * state.legacyMultiplier;
  }

  function randomBetween(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function quantize(value, step) {
    if (!Number.isFinite(value) || step <= 0) {
      return 0;
    }
    return Math.floor(value / step);
  }

  function getNextIncidentDelay() {
    return randomBetween(INCIDENT_INTERVAL_MIN, INCIDENT_INTERVAL_MAX);
  }

  function getGeneratorOwned(state, id) {
    return state.generators[id]?.owned || 0;
  }

  function getGeneratorCost(state, generator, owned = getGeneratorOwned(state, generator.id)) {
    const policyEffects = getPolicyEffects(state);
    return generator.baseCost * Math.pow(1.15, owned) * state.costMultiplier * policyEffects.costMultiplier;
  }

  function getBulkCost(state, generator, quantity) {
    if (quantity <= 0) {
      return 0;
    }
    const owned = getGeneratorOwned(state, generator.id);
    const policyEffects = getPolicyEffects(state);
    const base = generator.baseCost * state.costMultiplier * policyEffects.costMultiplier;
    return base * Math.pow(1.15, owned) * ((Math.pow(1.15, quantity) - 1) / 0.15);
  }

  function getAffordableMax(state, generator) {
    let count = 0;
    let totalCost = 0;
    while (count < 999) {
      const nextCost = getBulkCost(state, generator, count + 1);
      if (nextCost > state.cu + 0.0001) {
        break;
      }
      count += 1;
      totalCost = nextCost;
    }
    return { count, cost: totalCost };
  }

  function getPurchaseQuantity(state, generator) {
    if (state.buyMode === "x1") {
      return { count: 1, cost: getBulkCost(state, generator, 1) };
    }
    if (state.buyMode === "x10") {
      return { count: 10, cost: getBulkCost(state, generator, 10) };
    }
    return getAffordableMax(state, generator);
  }

  function getServerRate(state, generator) {
    const halted = state.haltedGeneratorId === generator.id ? 0 : 1;
    const raw = generator.baseRate * getGeneratorOwned(state, generator.id);
    return raw * state.serverProductionMultiplier * state.productionMultiplier * state.legacyMultiplier * halted;
  }

  function getProductionRate(state) {
    let total = GENERATORS.reduce((sum, generator) => sum + getServerRate(state, generator), 0);
    total *= state.productionPenalty;
    const now = Date.now();
    if (state.ceoBoostUntil > now) {
      total *= 3;
    } else if (state.ceoCrashUntil > now) {
      total *= state.ceoCrashMultiplier || 0.5;
    }
    return total;
  }

  function getClients(state) {
    const policyEffects = getPolicyEffects(state);
    const infra = GENERATORS.reduce((sum, generator) => sum + getGeneratorOwned(state, generator.id), 0);
    const demand = Math.pow(Math.max(1, state.lifetimeCU / 10), 0.62) * state.clientMultiplier * policyEffects.clientMultiplier;
    return Math.max(1, Math.floor(demand + infra * 1.4));
  }

  function getEgressFees(state) {
    return getProductionRate(state) * (0.35 + getClients(state) / 140);
  }

  function getCompanyName(prestigeCount) {
    if (prestigeCount >= 3) {
      return "[REDACTED]";
    }
    if (prestigeCount === 2) {
      return "A subsidiary of a subsidiary";
    }
    if (prestigeCount === 1) {
      return "NimbusCore™ (Acquired by Oracle)";
    }
    return "NimbusCore™";
  }

  function getIpoTarget(input) {
    const prestigeCount = typeof input === "number" ? input : (input?.prestigeCount || 0);
    const runPenaltyMultiplier = typeof input === "number" ? 1 : Math.max(1, input?.ipoTargetPenaltyMultiplier || 1);
    return Math.floor(IPO_TARGET * Math.pow(IPO_TARGET_PRESTIGE_SCALE, Math.max(0, prestigeCount)) * runPenaltyMultiplier);
  }

  function formatNumber(value) {
    if (!Number.isFinite(value)) {
      return "0";
    }
    const abs = Math.abs(value);
    if (abs >= 1e12) {
      return cleanDecimal(value / 1e12) + "T";
    }
    if (abs >= 1e9) {
      return cleanDecimal(value / 1e9) + "B";
    }
    if (abs >= 1e6) {
      return cleanDecimal(value / 1e6) + "M";
    }
    if (abs >= 1000) {
      return Math.round(value).toLocaleString("en-GB");
    }
    if (abs >= 100) {
      return value.toFixed(1).replace(/\.0$/, "");
    }
    if (abs >= 10) {
      return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
    }
    return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "");
  }

  function cleanDecimal(value) {
    return value.toFixed(Math.abs(value) >= 10 ? 1 : 2).replace(/\.0+$/, "").replace(/(\.\d*[1-9])0+$/, "$1");
  }

  function formatCU(value) {
    return formatNumber(value) + " CU";
  }

  function formatRate(value) {
    return "▲ " + formatNumber(value) + " CU/s";
  }

  function formatMultiplier(value) {
    return value.toFixed(2).replace(/0$/, "").replace(/\.0$/, "") + "×";
  }

  function formatSigned(value, decimals = 1) {
    const abs = Math.abs(value);
    const rounded = abs >= 100 ? abs.toFixed(0) : abs.toFixed(decimals).replace(/0$/, "").replace(/\.0$/, "");
    return (value >= 0 ? "+" : "-") + rounded;
  }

  function formatEta(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "manual only";
    }
    if (seconds < 120) {
      return Math.ceil(seconds) + "s";
    }
    if (seconds < 7200) {
      return Math.ceil(seconds / 60) + "m";
    }
    return Math.ceil(seconds / 3600) + "h";
  }

  function formatLongEta(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) {
      return "manual only";
    }
    if (seconds < 120) {
      return "~" + Math.ceil(seconds) + "s";
    }
    if (seconds < 7200) {
      return "~" + Math.ceil(seconds / 60) + " min";
    }
    return "~" + Math.ceil(seconds / 3600) + "h";
  }

  function enqueueTicker(state, message) {
    const next = [...state.tickerMessages, message];
    state.tickerMessages = next.slice(-32);
  }

  function applyUpgradeEffect(state, upgradeId) {
    if (upgradeId === "agile") {
      state.clickPower *= 2;
    } else if (upgradeId === "dashboard") {
      state.productionMultiplier *= 1.5;
    } else if (upgradeId === "sales-enablement") {
      state.clientMultiplier *= 1.4;
    } else if (upgradeId === "kubernetes") {
      state.serverProductionMultiplier *= 3;
    } else if (upgradeId === "reserved") {
      state.costMultiplier *= 0.9;
    } else if (upgradeId === "offshore") {
      state.productionMultiplier *= 5;
      enqueueTicker(state, "Cross-border processing footprint expanded for strategic reasons.");
    } else if (upgradeId === "oncall") {
      state.incidentsDisabled = true;
      if (state.activeIncident) {
        const activeDefinition = INCIDENT_DEFINITIONS[state.activeIncident.id];
        if (activeDefinition) {
          activeDefinition.ends(state);
        }
        state.activeIncident = null;
      }
      state.nextIncidentAt = Date.now() + getNextIncidentDelay();
      enqueueTicker(state, "On-call engineering activated. Incident queue moved to managed operations.");
    } else if (upgradeId === "ai") {
      state.productionMultiplier *= 2;
    } else if (upgradeId === "blockchain") {
      enqueueTicker(state, "Legacy distributed ledger initiative entered controlled maintenance.");
    }
  }

  function removeUpgradeEffect(state, upgradeId) {
    if (upgradeId === "agile") {
      state.clickPower /= 2;
    } else if (upgradeId === "dashboard") {
      state.productionMultiplier /= 1.5;
    } else if (upgradeId === "sales-enablement") {
      state.clientMultiplier /= 1.4;
    } else if (upgradeId === "kubernetes") {
      state.serverProductionMultiplier /= 3;
    } else if (upgradeId === "reserved") {
      state.costMultiplier /= 0.9;
    } else if (upgradeId === "offshore") {
      state.productionMultiplier /= 5;
    } else if (upgradeId === "oncall") {
      state.incidentsDisabled = false;
    } else if (upgradeId === "ai") {
      state.productionMultiplier /= 2;
    }
  }

  function getPrimaryUnlockedGenerator(state) {
    const unlocked = GENERATORS.filter((generator) => generator.unlock(state));
    return unlocked[unlocked.length - 1] || GENERATORS[0];
  }

  function getUpgradeMetricValue(state, upgradeId) {
    const focusGenerator = getPrimaryUnlockedGenerator(state);
    if (upgradeId === "agile") {
      const value = getClickValue(state);
      return { kind: "click", value, text: "+" + formatNumber(value) + " CU/click" };
    }
    if (upgradeId === "sales-enablement") {
      const value = getClients(state);
      return { kind: "clients", value, text: formatNumber(value) + " clients" };
    }
    if (upgradeId === "reserved") {
      const value = getGeneratorCost(state, focusGenerator);
      return { kind: "cost", value, text: formatCU(value) + " next " + focusGenerator.name };
    }
    if (upgradeId === "oncall") {
      return { kind: "incidents", value: state.incidentsDisabled ? 0 : 1, text: state.incidentsDisabled ? "disabled" : "enabled" };
    }
    return { kind: "rate", value: getProductionRate(state), text: formatNumber(getProductionRate(state)) + " CU/s" };
  }

  function getUpgradePreview(state, upgrade) {
    const purchased = state.purchasedUpgrades.includes(upgrade.id);
    const beforeState = cloneState(state);
    const afterState = cloneState(state);
    const baseState = cloneState(state);
    if (!purchased) {
      applyUpgradeEffect(afterState, upgrade.id);
    } else {
      removeUpgradeEffect(baseState, upgrade.id);
    }
    const beforeMetric = getUpgradeMetricValue(purchased ? baseState : beforeState, upgrade.id);
    const afterMetric = getUpgradeMetricValue(purchased ? state : afterState, upgrade.id);
    const meta = UPGRADE_META[upgrade.id] || { type: "Legacy", appliesTo: "None", label: "no production change" };
    let contributionValue = 0;
    if (beforeMetric.kind === "rate" || beforeMetric.kind === "risk" || beforeMetric.kind === "click" || beforeMetric.kind === "clients" || beforeMetric.kind === "cost") {
      contributionValue = afterMetric.value - beforeMetric.value;
    }
    const payback = beforeMetric.kind === "rate" && contributionValue > 0 ? upgrade.cost / contributionValue : Infinity;
    return {
      purchased,
      meta,
      beforeMetric,
      afterMetric,
      contributionValue,
      contributionText: beforeMetric.kind === "rate"
        ? formatSigned(contributionValue, 1) + " CU/s"
        : beforeMetric.kind === "click"
          ? formatSigned(contributionValue, 1) + " CU/click"
          : beforeMetric.kind === "clients"
            ? formatSigned(contributionValue, 0) + " clients"
            : beforeMetric.kind === "risk"
              ? formatSigned(contributionValue, 2) + "%/s"
              : beforeMetric.kind === "cost"
                ? formatSigned(contributionValue, 1) + " CU next buy"
                : beforeMetric.kind === "incidents"
                  ? (afterMetric.value === 0 ? "no new incidents" : "incidents enabled")
                : "no active effect",
      payback,
      effectText: "EFFECT    " + meta.label + "  ·  " + beforeMetric.text + " → " + afterMetric.text,
      paybackText: "PAYBACK   " + (Number.isFinite(payback) ? formatEta(payback) : "n/a")
    };
  }

  function buildUpgradeTooltip(state, upgrade) {
    const preview = getUpgradePreview(state, upgrade);
    const separator = "──────────────────────────────";
    const labelPad = (label) => label.padEnd(18, " ");
    return [
      upgrade.name.toUpperCase(),
      upgrade.flavour,
      separator,
      preview.effectText,
      preview.purchased ? "CONTRIBUTING  " + preview.contributionText : preview.paybackText,
      separator,
      labelPad("Type") + preview.meta.type,
      labelPad("Applies to") + preview.meta.appliesTo,
      labelPad("Current rate") + preview.beforeMetric.text,
      labelPad("Rate after buy") + preview.afterMetric.text,
      labelPad("Net gain") + preview.contributionText,
      separator,
      labelPad("Payback") + (Number.isFinite(preview.payback) ? formatEta(preview.payback) : "n/a")
    ].join("\n");
  }

  function getGeneratorPreview(state, generator) {
    const purchase = getPurchaseQuantity(state, generator);
    const beforeOwned = getGeneratorOwned(state, generator.id);
    const beforeRate = getServerRate(state, generator);
    const afterState = cloneState(state);
    const quantity = Math.max(1, purchase.count);
    const cost = purchase.count > 0 ? purchase.cost : getBulkCost(state, generator, 1);

    afterState.generators[generator.id].owned += quantity;

    const afterRate = getServerRate(afterState, generator);
    const gain = Math.max(0, afterRate - beforeRate);
    const payback = gain > 0 && cost > 0 ? cost / gain : Infinity;

    return {
      quantity,
      cost,
      beforeOwned,
      beforeRate,
      afterRate,
      gain,
      payback
    };
  }

  function buildGeneratorTooltip(state, generator) {
    const preview = getGeneratorPreview(state, generator);
    const separator = "──────────────────────────────";
    const labelPad = (label) => label.padEnd(18, " ");
    const unlocked = generator.unlock(state);

    if (!unlocked) {
      const unlock = getUnlockProgress(generator, state);
      return [
        generator.name.toUpperCase(),
        separator,
        labelPad("Status") + "Locked",
        unlock ? labelPad("Progress") + `${formatNumber(unlock.current)} / ${formatNumber(unlock.target)} ${unlock.unit}` : labelPad("Progress") + "Unavailable",
        unlock ? labelPad("ETA") + formatLongEta(unlock.eta) : labelPad("ETA") + "manual only"
      ].join("\n");
    }

    return [
      generator.name.toUpperCase(),
      separator,
      labelPad("Purchase") + `${formatNumber(preview.quantity)} unit${preview.quantity === 1 ? "" : "s"}`,
      labelPad("Current owned") + formatNumber(preview.beforeOwned),
      labelPad("Current rate") + `${formatNumber(preview.beforeRate)} CU/s`,
      labelPad("Rate after buy") + `${formatNumber(preview.afterRate)} CU/s`,
      labelPad("Net gain") + `${formatSigned(preview.gain, 1)} CU/s`,
      labelPad("Total cost") + formatCU(preview.cost),
      separator,
      labelPad("Payback") + (Number.isFinite(preview.payback) ? formatEta(preview.payback) : "n/a")
    ].join("\n");
  }

  function getUnlockPriorityGenerator(generator) {
    if (generator.id === "pod") return "rack";
    if (generator.id === "region") return "pod";
    if (generator.id === "cable") return "region";
    return null;
  }

  function buyOneGenerator(simState, generator) {
    const cost = getBulkCost(simState, generator, 1);
    if (cost > simState.cu + 0.0001) {
      return false;
    }
    simState.cu -= cost;
    simState.generators[generator.id].owned += 1;
    return true;
  }

  function simulatePassiveTime(simState, seconds) {
    const rate = getProductionRate(simState);
    simState.cu += rate * seconds;
    simState.lifetimeCU += rate * seconds;
  }

  function estimateUnlockEta(generator, state, metrics = null) {
    if (generator.unlock(state)) {
      return 0;
    }
    const currentRate = metrics?.rate ?? getProductionRate(state);
    const currentClients = metrics?.clients ?? getClients(state);
    const cacheKey = [
      generator.id,
      quantize(state.cu, 500),
      quantize(state.lifetimeCU, 2000),
      quantize(currentRate, 5),
      quantize(currentClients, 2),
      ...GENERATORS.map((item) => getGeneratorOwned(state, item.id))
    ].join("|");
    const cached = unlockEtaCache.get(cacheKey);
    if (cached && Date.now() - cached.at < UNLOCK_ETA_CACHE_TTL_MS) {
      return cached.value;
    }
    if (unlockEtaCache.size > 2000) {
      const cutoff = Date.now() - UNLOCK_ETA_CACHE_TTL_MS * 2;
      for (const [key, entry] of unlockEtaCache.entries()) {
        if (entry.at < cutoff) {
          unlockEtaCache.delete(key);
        }
      }
      if (unlockEtaCache.size > 2000) {
        unlockEtaCache.clear();
      }
    }
    const simState = cloneState(state);
    let elapsed = 0;
    for (let step = 0; step < 300 && elapsed < 86400; step += 1) {
      if (generator.unlock(simState)) {
        unlockEtaCache.set(cacheKey, { value: elapsed, at: Date.now() });
        return elapsed;
      }
      const unlocked = GENERATORS.filter((item) => item.unlock(simState));
      if (!unlocked.length) {
        unlockEtaCache.set(cacheKey, { value: Infinity, at: Date.now() });
        return Infinity;
      }
      const priority = getUnlockPriorityGenerator(generator);
      let chosen = priority ? unlocked.find((item) => item.id === priority) : null;
      if (!chosen) {
        chosen = unlocked.reduce((best, item) => {
          const bestRoi = best ? getBulkCost(simState, best, 1) / Math.max(best.baseRate, 0.0001) : Infinity;
          const itemRoi = getBulkCost(simState, item, 1) / Math.max(item.baseRate, 0.0001);
          return itemRoi < bestRoi ? item : best;
        }, null);
      }
      const cost = getBulkCost(simState, chosen, 1);
      if (cost <= simState.cu + 0.0001) {
        buyOneGenerator(simState, chosen);
        continue;
      }
      const rate = getProductionRate(simState);
      if (rate <= 0) {
        unlockEtaCache.set(cacheKey, { value: Infinity, at: Date.now() });
        return Infinity;
      }
      const wait = (cost - simState.cu) / rate;
      if (!Number.isFinite(wait) || wait <= 0) {
        unlockEtaCache.set(cacheKey, { value: Infinity, at: Date.now() });
        return Infinity;
      }
      simulatePassiveTime(simState, wait);
      elapsed += wait;
    }
    unlockEtaCache.set(cacheKey, { value: Infinity, at: Date.now() });
    return Infinity;
  }

  function getUnlockProgress(generator, state) {
    const rate = getProductionRate(state);
    const clients = getClients(state);
    if (generator.id === "dedicated") {
      const current = clients;
      return { current, target: 50, unit: "clients", progress: Math.min(1, current / 50), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    if (generator.id === "rack") {
      return { current: rate, target: 200, unit: "CU/s", progress: Math.min(1, rate / 200), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    if (generator.id === "pod") {
      const current = getGeneratorOwned(state, "rack");
      return { current, target: 10, unit: "racks", progress: Math.min(1, current / 10), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    if (generator.id === "region") {
      const current = getGeneratorOwned(state, "pod");
      return { current, target: 5, unit: "pods", progress: Math.min(1, current / 5), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    if (generator.id === "cable") {
      const current = getGeneratorOwned(state, "region");
      return { current, target: 3, unit: "regions", progress: Math.min(1, current / 3), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    if (generator.id === "orbital") {
      const current = state.lifetimeCU;
      return { current, target: 500000, unit: "lifetime CU", progress: Math.min(1, current / 500000), eta: estimateUnlockEta(generator, state, { rate, clients }) };
    }
    return null;
  }

  function getRackUnits(state) {
    const units = [];
    GENERATORS.forEach((generator) => {
      for (let index = 0; index < getGeneratorOwned(state, generator.id); index += 1) {
        units.push({ id: generator.id, short: generator.short, icon: generator.icon });
      }
    });
    return units;
  }

  function chooseIncidentIgnoreConsequence(state) {
    const options = [
      { type: "ipo", multiplier: 1.08 },
      { type: "cost", multiplier: 1.08 }
    ];
    const revokable = state.purchasedUpgrades.filter((upgradeId) => upgradeId !== "blockchain");
    if (revokable.length) {
      const removeId = revokable[Math.floor(Math.random() * revokable.length)];
      options.push({ type: "revoke-upgrade", upgradeId: removeId });
    }
    return options[Math.floor(Math.random() * options.length)];
  }

  function getIncidentIgnoreText(consequence) {
    if (!consequence) {
      return "IGNORE  +8% IPO target";
    }
    if (consequence.type === "ipo") {
      const percent = Math.round((consequence.multiplier - 1) * 100);
      return "IGNORE  +" + percent + "% IPO target";
    }
    if (consequence.type === "cost") {
      const percent = Math.round((consequence.multiplier - 1) * 100);
      return "IGNORE  +" + percent + "% infrastructure costs";
    }
    if (consequence.type === "revoke-upgrade") {
      const upgrade = UPGRADES.find((item) => item.id === consequence.upgradeId);
      return "IGNORE  remove " + (upgrade ? upgrade.name : "one optimisation");
    }
    return "IGNORE  +8% IPO target";
  }

  function getIncidentUi(state) {
    if (!state.activeIncident) {
      return null;
    }
    const definition = INCIDENT_DEFINITIONS[state.activeIncident.id];
    const remaining = Math.max(0, Math.ceil((state.activeIncident.endsAt - Date.now()) / 1000));
    const severity = state.activeIncident.severity || 1;
    const resolveCost = definition.resolveCost(state);
    const impact = definition.id === "ddos"
      ? "IMPACT  −" + Math.round((1 - getDdosPenalty(severity)) * 100) + "% production while active  ·  DURATION  " + remaining + "s remaining"
      : definition.id === "devops"
        ? "IMPACT  " + (state.haltedGeneratorId ? state.haltedGeneratorId.toUpperCase() + " output halted" : "one generator halted") + "  ·  DURATION  " + remaining + "s remaining"
        : definition.id === "public-bucket"
          ? "IMPACT  " + formatCU(Math.floor(240 * severity)) + " exposure fee charged  ·  DURATION  " + remaining + "s remaining"
          : definition.id === "tweet"
            ? "IMPACT  volatile multiplier active (crash to " + formatNumber((state.ceoCrashMultiplier || 0.5) * 100) + "%)  ·  DURATION  " + remaining + "s remaining"
            : "IMPACT  no service effect  ·  DURATION  " + remaining + "s remaining";
    return {
      title: "⚠ INCIDENT  ·  " + definition.name,
      description: definition.description,
      impact,
      resolveText: definition.resolveCost(state) > 0
        ? definition.resolveLabel + "  " + formatNumber(resolveCost) + " CU  →  end incident now"
        : definition.resolveLabel + "  →  end incident now",
      resolveCost,
      ignoreText: getIncidentIgnoreText(state.activeIncident.ignoreConsequence),
      ignorePenalty: definition.ignorePenalty
    };
  }

  function getNextTierText(state) {
    for (const generator of GENERATORS.slice(1)) {
      const unlocked = generator.unlock(state);
      const cost = getGeneratorCost(state, generator);
      if (getGeneratorOwned(state, generator.id) === 0 || !unlocked) {
        return "⬆ NEXT TIER: " + generator.name + " — " + formatCU(cost) + (unlocked ? "" : " · locked");
      }
    }
    const last = GENERATORS[GENERATORS.length - 1];
    return "⬆ NEXT TIER: " + last.name + " — " + formatCU(getGeneratorCost(state, last));
  }

  function getClientThresholdText(state) {
    const clients = getClients(state);
    if (clients < 50) {
      return "+" + (50 - clients) + " unlocks Dedicated Server";
    }
    return "All client thresholds cleared";
  }

  function getCapacityPercent(state) {
    const units = getRackUnits(state).length;
    const rackCount = Math.max(4, Math.ceil(units / 12));
    return rackCount * 12 ? Math.min(100, (units / (rackCount * 12)) * 100) : 0;
  }

  function activateIncident(state, incidentId, now = Date.now()) {
    const definition = INCIDENT_DEFINITIONS[incidentId];
    if (!definition) {
      return state;
    }
    const next = cloneState(state);
    const severity = getIncidentSeverity(next);
    const duration = Math.max(5000, Math.floor(definition.duration * getIncidentDurationMultiplier(severity)));
    definition.starts(next, now, severity);
    next.activeIncident = {
      id: incidentId,
      startsAt: now,
      endsAt: now + duration,
      ignored: false,
      severity,
      ignoreConsequence: chooseIncidentIgnoreConsequence(next)
    };
    if (incidentId === "public-bucket") {
      enqueueTicker(next, "Public object storage exposure recorded in a third-party blog post.");
    } else if (incidentId === "zoom") {
      enqueueTicker(next, "Zoom outage recorded. Productivity revised upward 40%.");
    }
    enqueueTicker(next, definition.name + " entered executive awareness.");
    return next;
  }

  function clearIncident(state, resolved) {
    if (!state.activeIncident) {
      return state;
    }
    const next = cloneState(state);
    const definition = INCIDENT_DEFINITIONS[next.activeIncident.id];
    if (definition) {
      definition.ends(next);
      if (resolved) {
        enqueueTicker(next, definition.name + " resolved through approved process.");
      }
    }
    next.activeIncident = null;
    next.nextIncidentAt = Date.now() + getNextIncidentDelay();
    return next;
  }

  function buyGenerator(state, id) {
    const generator = GENERATORS.find((item) => item.id === id);
    if (!generator || !generator.unlock(state)) {
      return state;
    }
    const purchase = getPurchaseQuantity(state, generator);
    if (purchase.count <= 0 || purchase.cost > state.cu + 0.0001) {
      return state;
    }
    const next = cloneState(state);
    next.cu -= purchase.cost;
    next.generators[id].owned += purchase.count;
    if (id === "region") {
      enqueueTicker(next, "Regional expansion approved after extensive slide work.");
    }
    return next;
  }

  function buyUpgrade(state, id) {
    if (state.purchasedUpgrades.includes(id)) {
      return state;
    }
    const upgrade = UPGRADES.find((item) => item.id === id);
    if (!upgrade || !upgrade.available(state) || upgrade.cost > state.cu + 0.0001) {
      return state;
    }
    const next = cloneState(state);
    next.cu -= upgrade.cost;
    next.purchasedUpgrades.push(id);
    applyUpgradeEffect(next, id);
    return next;
  }

  function provisionClick(state) {
    const next = cloneState(state);
    const gain = getClickValue(next);
    next.cu += gain;
    next.lifetimeCU += gain;
    next.totalManualClicks += 1;
    return { state: next, gain };
  }

  function maybeAwardBoardVotes(state) {
    if (state.lifetimeCU < state.nextBoardVoteAt) {
      return;
    }
    let votesAwarded = 0;
    while (state.lifetimeCU >= state.nextBoardVoteAt) {
      votesAwarded += 1;
      state.boardVoteBandStart = state.nextBoardVoteAt;
      state.nextBoardVoteStep = Math.floor(state.nextBoardVoteStep * BOARD_VOTE_STEP_GROWTH);
      state.nextBoardVoteAt += state.nextBoardVoteStep;
    }
    if (votesAwarded > 0) {
      state.boardVotes += votesAwarded;
      state.lifetimeBoardVotes += votesAwarded;
      enqueueTicker(state, "Board committee approved " + votesAwarded + " additional vote" + (votesAwarded === 1 ? "." : "s."));
    }
  }

  function resolveIncident(state) {
    if (!state.activeIncident) {
      return state;
    }
    const definition = INCIDENT_DEFINITIONS[state.activeIncident.id];
    const cost = definition.resolveCost(state);
    if (cost > state.cu + 0.0001) {
      return state;
    }
    const next = cloneState(state);
    next.cu -= cost;
    return clearIncident(next, true);
  }

  function applyIncidentIgnoreConsequence(state, consequence) {
    if (!consequence || consequence.type === "ipo") {
      const multiplier = consequence?.multiplier || 1.08;
      const percent = Math.round((multiplier - 1) * 100);
      state.ipoTargetPenaltyMultiplier *= multiplier;
      enqueueTicker(state, "Ignoring incident increased IPO target requirements by " + percent + "% this run.");
      return;
    }
    if (consequence.type === "cost") {
      const multiplier = consequence.multiplier || 1.08;
      const percent = Math.round((multiplier - 1) * 100);
      state.costMultiplier *= multiplier;
      enqueueTicker(state, "Ignoring incident triggered emergency procurement pricing. Infrastructure costs rose " + percent + "%.");
      return;
    }
    if (consequence.type === "revoke-upgrade") {
      const removeId = consequence.upgradeId;
      if (!removeId || !state.purchasedUpgrades.includes(removeId)) {
        state.ipoTargetPenaltyMultiplier *= 1.05;
        enqueueTicker(state, "Selected rollback target was unavailable. IPO target requirements increased by 5%.");
        return;
      }
      const upgrade = UPGRADES.find((item) => item.id === removeId);
      removeUpgradeEffect(state, removeId);
      state.purchasedUpgrades = state.purchasedUpgrades.filter((upgradeId) => upgradeId !== removeId);
      enqueueTicker(state, (upgrade ? upgrade.name : "An optimisation") + " was rolled back after incident review.");
    }
  }

  function ignoreIncident(state) {
    if (!state.activeIncident || state.activeIncident.ignored) {
      return state;
    }
    const next = cloneState(state);
    const definition = INCIDENT_DEFINITIONS[next.activeIncident.id];
    const consequence = next.activeIncident.ignoreConsequence;
    next.activeIncident.ignored = true;
    enqueueTicker(next, definition.name + " entered accepted-risk status.");
    applyIncidentIgnoreConsequence(next, consequence);
    return next;
  }

  function tickState(state, deltaSeconds, now = Date.now()) {
    const next = cloneState(state);
    const rate = getProductionRate(next);
    const gain = rate * deltaSeconds;
    next.cu += gain;
    next.lifetimeCU += gain;
    maybeAwardBoardVotes(next);
    if (next.incidentsDisabled) {
      if (next.activeIncident) {
        const activeDefinition = INCIDENT_DEFINITIONS[next.activeIncident.id];
        if (activeDefinition) {
          activeDefinition.ends(next);
        }
        next.activeIncident = null;
      }
      return next;
    }
    if (next.activeIncident && now >= next.activeIncident.endsAt) {
      return clearIncident(next, false);
    }
    if (!next.activeIncident && rate < INCIDENT_UNLOCK_RATE) {
      if (next.nextIncidentAt <= now) {
        next.nextIncidentAt = now + getNextIncidentDelay();
      }
      return next;
    }
    if (!next.activeIncident && now >= next.nextIncidentAt) {
      const incidentIds = Object.keys(INCIDENT_DEFINITIONS);
      return activateIncident(next, incidentIds[Math.floor(Math.random() * incidentIds.length)], now);
    }
    return next;
  }

  function maybeOpenPrestige(state) {
    return state.lifetimeCU >= getIpoTarget(state);
  }

  function getNextBoardVoteProgress(state) {
    const currentBandStart = Math.max(0, state.boardVoteBandStart || 0);
    const target = Math.max(1, state.nextBoardVoteAt - currentBandStart);
    const inBand = Math.max(0, state.lifetimeCU - currentBandStart);
    return {
      current: Math.min(target, inBand),
      target,
      progress: Math.max(0, Math.min(1, inBand / target)),
      threshold: state.nextBoardVoteAt
    };
  }

  function buyPolicy(state, policyId) {
    const policy = getPolicyById(policyId);
    if (!policy) {
      return state;
    }
    const level = getPolicyLevel(state, policyId);
    const nextLevel = level + 1;
    const cost = getPolicyCost(policy, nextLevel);
    if (level >= policy.maxLevel || state.boardVotes < cost) {
      return state;
    }
    const next = cloneState(state);
    next.boardVotes -= cost;
    next.policyLevels[policyId] = nextLevel;
    enqueueTicker(next, policy.name + " advanced to level " + nextLevel + ".");
    return next;
  }

  function getPolicyPreview(state, policy, targetLevel = null) {
    const level = getPolicyLevel(state, policy.id);
    const resolvedTargetLevel = targetLevel === null ? Math.min(policy.maxLevel, level + 1) : Math.max(1, Math.min(policy.maxLevel, targetLevel));
    const beforeEffects = getPolicyEffects(state);
    const previewState = cloneState(state);
    previewState.policyLevels[policy.id] = resolvedTargetLevel;
    const afterEffects = getPolicyEffects(previewState);
    const beforeClick = getClickValue(state);
    const afterClick = getClickValue(previewState);
    const beforeClients = getClients(state);
    const afterClients = getClients(previewState);
    const nextCost = getPolicyCost(policy, Math.min(policy.maxLevel, level + 1));
    return {
      level,
      nextLevel: resolvedTargetLevel,
      maxed: level >= policy.maxLevel,
      affordable: state.boardVotes >= nextCost,
      nextCost,
      effectText: policy.effectType === "cost"
        ? "EFFECT    generator costs  ·  " + formatNumber(beforeEffects.costMultiplier * 100) + "% → " + formatNumber(afterEffects.costMultiplier * 100) + "%"
        : policy.effectType === "click"
          ? "EFFECT    click output  ·  +" + formatNumber(beforeClick) + " → +" + formatNumber(afterClick) + " CU"
          : "EFFECT    client growth  ·  " + formatNumber(beforeClients) + " → " + formatNumber(afterClients) + " clients",
      contributionText: policy.effectType === "cost"
        ? formatSigned((afterEffects.costMultiplier - beforeEffects.costMultiplier) * 100, 2) + "% cost modifier"
        : policy.effectType === "click"
          ? formatSigned(afterClick - beforeClick, 1) + " CU per click"
          : formatSigned(afterClients - beforeClients, 0) + " projected clients"
    };
  }

  function buildPolicyTooltip(state, policy) {
    const preview = getPolicyPreview(state, policy);
    const separator = "──────────────────────────────";
    const labelPad = (label) => label.padEnd(18, " ");
    return [
      policy.name.toUpperCase(),
      policy.flavour,
      separator,
      preview.effectText,
      "CONTRIBUTION  " + preview.contributionText,
      separator,
      labelPad("Applies to") + policy.appliesTo,
      labelPad("Current level") + preview.level + " / " + policy.maxLevel,
      labelPad("Upgrade cost") + preview.nextCost + " vote" + (preview.nextCost === 1 ? "" : "s"),
      labelPad("Available votes") + formatNumber(state.boardVotes)
    ].join("\n");
  }

  function buildPolicyLevelTooltip(state, policy, targetLevel) {
    const currentLevel = getPolicyLevel(state, policy.id);
    const preview = getPolicyPreview(state, policy, targetLevel);
    const separator = "──────────────────────────────";
    const labelPad = (label) => label.padEnd(18, " ");
    const locked = currentLevel + 1 < targetLevel;
    return [
      policy.name.toUpperCase(),
      policy.flavour,
      separator,
      "TIER " + targetLevel + "  " + (locked ? "LOCKED" : currentLevel >= targetLevel ? "ACTIVE" : "AVAILABLE"),
      preview.effectText,
      "CONTRIBUTION  " + preview.contributionText,
      separator,
      labelPad("Current level") + currentLevel + " / " + policy.maxLevel,
      labelPad("Tier cost") + getPolicyCost(policy, targetLevel) + " vote" + (getPolicyCost(policy, targetLevel) === 1 ? "" : "s"),
      labelPad("Available votes") + formatNumber(state.boardVotes)
    ].join("\n");
  }

  function applyPrestige(state) {
    const next = createInitialState();
    next.prestigeCount = state.prestigeCount + 1;
    next.formerEmployees = state.formerEmployees + 1;
    next.legacyMultiplier = state.legacyMultiplier * 1.15;
    next.policyLevels = { ...createPolicyLevels(), ...(state.policyLevels || {}) };
    next.boardVotes = 0;
    next.lifetimeBoardVotes = 0;
    enqueueTicker(next, "Board vote balances reset for post-IPO governance.");
    return next;
  }

  function prepareSaveState(state) {
    const next = cloneState(state);
    next.lastSave = Date.now();
    next.lastProductionSnapshot = getProductionRate(next);
    return next;
  }

  function loadState() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createInitialState();
    }
    try {
      const parsed = JSON.parse(raw);
      const legacyOncallUnlocked = Number(parsed?.policyLevels?.oncall || 0) > 0;
      const parsedUpgrades = Array.isArray(parsed.purchasedUpgrades) ? [...parsed.purchasedUpgrades] : [];
      if (legacyOncallUnlocked && !parsedUpgrades.includes("oncall")) {
        parsedUpgrades.push("oncall");
      }
      const next = {
        ...createInitialState(),
        ...parsed,
        generators: {
          ...createInitialState().generators,
          ...parsed.generators
        },
        policyLevels: {
          ...createPolicyLevels(),
          ...(parsed.policyLevels || {})
        },
        boardVotes: Math.max(0, parsed.boardVotes || 0),
        lifetimeBoardVotes: Math.max(0, parsed.lifetimeBoardVotes || 0),
        boardVoteBandStart: Math.max(0, parsed.boardVoteBandStart || 0),
        nextBoardVoteStep: Math.max(1, Math.floor(parsed.nextBoardVoteStep || BOARD_VOTE_BASE_STEP)),
        nextBoardVoteAt: Math.max(BOARD_VOTE_BASE_STEP, parsed.nextBoardVoteAt || BOARD_VOTE_BASE_STEP),
        purchasedUpgrades: parsedUpgrades,
        incidentsDisabled: typeof parsed.incidentsDisabled === "boolean"
          ? parsed.incidentsDisabled
          : parsedUpgrades.includes("oncall"),
        ceoCrashMultiplier: Math.max(0.2, parsed.ceoCrashMultiplier || 0.5),
        ipoTargetPenaltyMultiplier: Math.max(1, parsed.ipoTargetPenaltyMultiplier || 1),
        tickerMessages: Array.isArray(parsed.tickerMessages) && parsed.tickerMessages.length ? parsed.tickerMessages : [...BASE_NEWS]
      };
      if (next.nextBoardVoteAt <= next.boardVoteBandStart) {
        next.boardVoteBandStart = Math.max(0, next.nextBoardVoteAt - next.nextBoardVoteStep);
      }
      if (next.activeIncident && !next.activeIncident.severity) {
        next.activeIncident.severity = getIncidentSeverity(next);
      }
      const elapsedSeconds = Math.min(3600, Math.max(0, Date.now() - (parsed.lastSave || Date.now())) / 1000);
      const offlineGain = (parsed.lastProductionSnapshot || 0) * elapsedSeconds;
      next.offlineEarnings = offlineGain;
      next.cu += offlineGain;
      next.lifetimeCU += offlineGain;
      return next;
    } catch (error) {
      console.warn("NimbusCore save unavailable", error);
      return createInitialState();
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prepareSaveState(state)));
  }

  function getTelemetrySnapshot(state, now = Date.now()) {
    return {
      t: now,
      egress: getEgressFees(state),
      clients: getClients(state),
      clicks: state.totalManualClicks
    };
  }

  function getTelemetryWindow(telemetry, windowMs) {
    const now = Date.now();
    const latest = telemetry[telemetry.length - 1];
    if (!latest) {
      return null;
    }
    const earliest = telemetry.find((entry) => entry.t >= now - windowMs) || telemetry[0];
    if (!earliest || earliest === latest) {
      return null;
    }
    return { earliest, latest, seconds: Math.max(1, (latest.t - earliest.t) / 1000) };
  }

  function getTelemetryDeltas(telemetry) {
    const egressWindow = getTelemetryWindow(telemetry, 60000);
    return {
      egressMinuteDelta: egressWindow ? egressWindow.latest.egress - egressWindow.earliest.egress : 0
    };
  }

  return {
    STORAGE_KEY,
    IPO_TARGET,
    SAVE_INTERVAL,
    TICK_INTERVAL,
    GENERATORS,
    UPGRADES,
    POLICIES,
    REGIONS,
    BASE_NEWS,
    createInitialState,
    cloneState,
    loadState,
    saveState,
    prepareSaveState,
    buyGenerator,
    buyUpgrade,
    buyPolicy,
    provisionClick,
    resolveIncident,
    ignoreIncident,
    tickState,
    maybeOpenPrestige,
    applyPrestige,
    getGeneratorOwned,
    getGeneratorCost,
    getBulkCost,
    getAffordableMax,
    getPurchaseQuantity,
    getServerRate,
    getProductionRate,
    getClients,
    getEgressFees,
    getCompanyName,
    getIpoTarget,
    getClickValue,
    getPolicyPreview,
    buildPolicyTooltip,
    buildPolicyLevelTooltip,
    getPolicyById,
    getPolicyCost,
    getPolicyLevel,
    getNextBoardVoteProgress,
    formatNumber,
    formatCU,
    formatRate,
    formatMultiplier,
    formatSigned,
    formatEta,
    formatLongEta,
    getNextTierText,
    getGeneratorPreview,
    buildGeneratorTooltip,
    getUpgradePreview,
    buildUpgradeTooltip,
    getIncidentUi,
    getUnlockProgress,
    getRackUnits,
    getCapacityPercent,
    getClientThresholdText,
    getTelemetrySnapshot,
    getTelemetryDeltas
  };
})();

export default NimbusCoreGame;
