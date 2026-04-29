import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gameEngine from "./game";
import TopBar from "./components/TopBar";
import Workspace from "./components/Workspace";
import FooterBar from "./components/FooterBar";
import Overlay from "./components/Overlay";

export default function App() {
  const [game, setGame] = useState(() => gameEngine.loadState());
  const [tooltip, setTooltip] = useState(null);
  const [overlay, setOverlay] = useState({ visible: false, phase: "offer", title: "NimbusCore™", subtitle: "Series D — $2.4B Valuation", legacyText: "" });
  const [ipoOfferDismissedAtPrestige, setIpoOfferDismissedAtPrestige] = useState(null);
  const [provisionHover, setProvisionHover] = useState(false);
  const [boardViewOpen, setBoardViewOpen] = useState(false);
  const [floatingTexts, setFloatingTexts] = useState([]);
  const [flashRackIndex, setFlashRackIndex] = useState(null);
  const [purchaseFlashId, setPurchaseFlashId] = useState(null);
  const [newUnlockId, setNewUnlockId] = useState(null);
  const [provisionFlashUntil, setProvisionFlashUntil] = useState(0);
  const [provisionMessage, setProvisionMessage] = useState("");
  const telemetryRef = useRef([gameEngine.getTelemetrySnapshot(game)]);
  const gameRef = useRef(game);
  const unlockedRef = useRef(new Set(gameEngine.GENERATORS.filter((generator) => generator.unlock(game)).map((generator) => generator.id)));
  const generatorRefs = useRef({});

  useEffect(() => {
    gameRef.current = game;
  }, [game]);

  const pushTelemetry = useCallback((state) => {
    const snapshot = gameEngine.getTelemetrySnapshot(state);
    telemetryRef.current = [...telemetryRef.current.filter((entry) => entry.t >= Date.now() - 70000), snapshot];
  }, []);

  useEffect(() => {
    pushTelemetry(game);
  }, [game, pushTelemetry]);

  useEffect(() => {
    if (overlay.visible) {
      return undefined;
    }
    let last = performance.now();
    const intervalId = window.setInterval(() => {
      const nowPerf = performance.now();
      const delta = Math.min(0.5, (nowPerf - last) / 1000);
      last = nowPerf;
      setGame((prev) => {
        const next = gameEngine.tickState(prev, delta, Date.now());
        gameRef.current = next;
        pushTelemetry(next);
        return next;
      });
    }, gameEngine.TICK_INTERVAL);
    return () => window.clearInterval(intervalId);
  }, [overlay.visible, pushTelemetry]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      gameEngine.saveState(gameRef.current);
    }, gameEngine.SAVE_INTERVAL);
    const saveNow = () => gameEngine.saveState(gameRef.current);
    window.addEventListener("beforeunload", saveNow);
    document.addEventListener("visibilitychange", saveNow);
    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("beforeunload", saveNow);
      document.removeEventListener("visibilitychange", saveNow);
    };
  }, []);

  useEffect(() => {
    const currentlyUnlocked = new Set(gameEngine.GENERATORS.filter((generator) => generator.unlock(game)).map((generator) => generator.id));
    let newest = null;
    currentlyUnlocked.forEach((id) => {
      if (!unlockedRef.current.has(id)) {
        newest = id;
      }
    });
    if (newest) {
      setNewUnlockId(newest);
      const target = generatorRefs.current[newest];
      if (target && typeof target.scrollIntoView === "function") {
        window.requestAnimationFrame(() => target.scrollIntoView({ block: "nearest", behavior: "smooth" }));
      }
      window.setTimeout(() => setNewUnlockId(null), 420);
    }
    unlockedRef.current = currentlyUnlocked;
  }, [game]);

  useEffect(() => {
    if (flashRackIndex === null) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => setFlashRackIndex(null), 400);
    return () => window.clearTimeout(timeoutId);
  }, [flashRackIndex]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setFloatingTexts((items) => items.filter((item) => item.until > Date.now()));
    }, 120);
    return () => window.clearInterval(intervalId);
  }, []);

  const resolveTooltipText = useCallback((source, state) => {
    if (!source) {
      return "";
    }
    if (typeof source === "string") {
      return source;
    }
    if (source.kind === "generator") {
      const generator = gameEngine.GENERATORS.find((item) => item.id === source.id);
      return generator ? gameEngine.buildGeneratorTooltip(state, generator) : "";
    }
    if (source.kind === "upgrade") {
      const upgrade = gameEngine.UPGRADES.find((item) => item.id === source.id);
      return upgrade ? gameEngine.buildUpgradeTooltip(state, upgrade) : "";
    }
    if (source.kind === "policy") {
      const policy = gameEngine.POLICIES.find((item) => item.id === source.id);
      return policy ? gameEngine.buildPolicyTooltip(state, policy) : "";
    }
    if (source.kind === "policy-level") {
      const policy = gameEngine.getPolicyById(source.id);
      return policy ? gameEngine.buildPolicyLevelTooltip(state, policy, source.level) : "";
    }
    return source.text || "";
  }, []);

  useEffect(() => {
    if (!tooltip || typeof tooltip.source === "string" || !tooltip.anchor) {
      return;
    }
    if (!tooltip.anchor.isConnected) {
      setTooltip(null);
      return;
    }
    const rect = tooltip.anchor.getBoundingClientRect();
    const text = resolveTooltipText(tooltip.source, game);
    const sameRect =
      tooltip.rect &&
      tooltip.rect.left === rect.left &&
      tooltip.rect.top === rect.top &&
      tooltip.rect.width === rect.width &&
      tooltip.rect.height === rect.height;

    if (tooltip.text === text && sameRect) {
      return;
    }

    setTooltip((current) => (current ? { ...current, text, rect } : current));
  }, [game, tooltip, resolveTooltipText]);

  const showTooltip = useCallback((source, side = "right") => (event) => {
    setTooltip({
      source,
      side,
      anchor: event.currentTarget,
      rect: event.currentTarget.getBoundingClientRect(),
      text: resolveTooltipText(source, gameRef.current)
    });
  }, [resolveTooltipText]);

  const hideTooltip = useCallback(() => {
    setTooltip(null);
  }, []);

  const handleSetBuyMode = useCallback((mode) => {
    setGame((prev) => ({ ...prev, buyMode: mode }));
  }, []);

  const handleBuyGenerator = useCallback((id) => {
    const next = gameEngine.buyGenerator(gameRef.current, id);
    if (next !== gameRef.current) {
      setPurchaseFlashId(id);
      window.setTimeout(() => setPurchaseFlashId((current) => current === id ? null : current), 460);
      setGame(next);
      gameRef.current = next;
    }
  }, []);

  const handleBuyUpgrade = useCallback((id) => {
    const next = gameEngine.buyUpgrade(gameRef.current, id);
    if (next !== gameRef.current) {
      setGame(next);
      gameRef.current = next;
    }
  }, []);

  const handleBuyPolicy = useCallback((id) => {
    const next = gameEngine.buyPolicy(gameRef.current, id);
    if (next !== gameRef.current) {
      setGame(next);
      gameRef.current = next;
    }
  }, []);

  const handleToggleBoardView = useCallback(() => {
    setBoardViewOpen((current) => !current);
  }, []);

  const handleResetSave = useCallback(() => {
    const approved = window.confirm(
      "Reset NimbusCore operations to a fresh state?\n\nThis will delete current progress, board votes, upgrades, and prestige history."
    );
    if (!approved) {
      return;
    }
    localStorage.removeItem(gameEngine.STORAGE_KEY);
    const fresh = gameEngine.createInitialState();
    setGame(fresh);
    gameRef.current = fresh;
    telemetryRef.current = [gameEngine.getTelemetrySnapshot(fresh)];
    unlockedRef.current = new Set(gameEngine.GENERATORS.filter((generator) => generator.unlock(fresh)).map((generator) => generator.id));
    setTooltip(null);
    setOverlay({ visible: false, phase: "offer", title: "NimbusCore™", subtitle: "Series D — $2.4B Valuation", legacyText: "" });
    setIpoOfferDismissedAtPrestige(null);
    setProvisionHover(false);
    setFloatingTexts([]);
    setFlashRackIndex(null);
    setPurchaseFlashId(null);
    setNewUnlockId(null);
    setProvisionFlashUntil(0);
    setProvisionMessage("");
    setBoardViewOpen(false);
  }, []);

  const handleDownloadSave = useCallback(() => {
    const snapshot = gameEngine.prepareSaveState(gameRef.current);
    const payload = JSON.stringify(snapshot, null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "nimbuscore-save.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, []);

  const handleImportSave = useCallback(async (file) => {
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      localStorage.setItem(gameEngine.STORAGE_KEY, JSON.stringify(parsed));
      const loaded = gameEngine.loadState();
      setGame(loaded);
      gameRef.current = loaded;
      telemetryRef.current = [gameEngine.getTelemetrySnapshot(loaded)];
      unlockedRef.current = new Set(gameEngine.GENERATORS.filter((generator) => generator.unlock(loaded)).map((generator) => generator.id));
      setTooltip(null);
      setOverlay({ visible: false, phase: "offer", title: "NimbusCore™", subtitle: "Series D — $2.4B Valuation", legacyText: "" });
      setIpoOfferDismissedAtPrestige(null);
      setProvisionHover(false);
      setFloatingTexts([]);
      setFlashRackIndex(null);
      setPurchaseFlashId(null);
      setNewUnlockId(null);
      setProvisionFlashUntil(0);
      setProvisionMessage("");
      setBoardViewOpen(false);
    } catch (error) {
      console.warn("NimbusCore import failed", error);
      window.alert("Import failed. Please select a valid NimbusCore save JSON file.");
    }
  }, []);

  const handleProvision = useCallback(() => {
    const result = gameEngine.provisionClick(gameRef.current);
    setGame(result.state);
    gameRef.current = result.state;
    setProvisionFlashUntil(Date.now() + 120);
    setProvisionMessage(`✓ +${gameEngine.formatNumber(result.gain)} CU provisioned  ·  total ${gameEngine.formatCU(result.state.cu)}`);
    const units = gameEngine.getRackUnits(result.state);
    if (units.length) {
      setFlashRackIndex(Math.floor(Math.random() * units.length));
    }
    setFloatingTexts((items) => [
      ...items,
      {
        id: `${Date.now()}-${Math.random()}`,
        text: `+${gameEngine.formatNumber(result.gain)} CU`,
        left: 48 + Math.random() * 42,
        top: 52 + Math.random() * 16,
        until: Date.now() + 900
      }
    ]);
    window.setTimeout(() => setProvisionMessage(""), 1500);
  }, []);

  const handleResolveIncident = useCallback(() => {
    const next = gameEngine.resolveIncident(gameRef.current);
    if (next !== gameRef.current) {
      setGame(next);
      gameRef.current = next;
    }
  }, []);

  const handleProceedToIPO = useCallback(() => {
    setOverlay((current) => ({ ...current, phase: "processing", subtitle: "" }));
    window.setTimeout(() => {
      setOverlay((current) => ({ ...current, phase: "decision", subtitle: "The board has made a decision." }));
    }, 2000);
    window.setTimeout(() => {
      const next = gameEngine.applyPrestige(gameRef.current);
      setGame(next);
      gameRef.current = next;
      telemetryRef.current = [gameEngine.getTelemetrySnapshot(next)];
      setOverlay({
        visible: true,
        phase: "legacy",
        title: `${gameEngine.getCompanyName(Math.max(0, next.prestigeCount - 1))} v${next.prestigeCount + 1}.0`,
        subtitle: "",
        legacyText: `Former employees: ${gameEngine.formatNumber(next.formerEmployees)}\nSeverance package: [LEGACY BONUS] ${gameEngine.formatMultiplier(next.legacyMultiplier)} permanent CU multiplier`
      });
    }, 5000);
  }, []);

  const handleContinueAfterPrestige = useCallback(() => {
    setOverlay((current) => ({ ...current, visible: false, phase: "offer" }));
  }, []);

  const handleDismissIpoOffer = useCallback(() => {
    setIpoOfferDismissedAtPrestige(gameRef.current.prestigeCount);
    setOverlay((current) => ({ ...current, visible: false, phase: "offer" }));
  }, []);

  const handleOpenIpoOverlay = useCallback(() => {
    if (!gameEngine.maybeOpenPrestige(gameRef.current)) {
      return;
    }
    setIpoOfferDismissedAtPrestige(null);
    setOverlay({
      visible: true,
      phase: "offer",
      title: gameEngine.getCompanyName(gameRef.current.prestigeCount),
      subtitle: "Series D — $2.4B Valuation",
      legacyText: ""
    });
  }, []);

  const telemetryDeltas = useMemo(() => gameEngine.getTelemetryDeltas(telemetryRef.current), [game]);

  const derived = useMemo(() => {
    const productionRate = gameEngine.getProductionRate(game);
    const egressFees = gameEngine.getEgressFees(game);
    const clients = gameEngine.getClients(game);
    const ipoTarget = gameEngine.getIpoTarget(game);
    const ipoProgress = Math.min(1, game.lifetimeCU / ipoTarget);
    const ipoEtaSeconds = productionRate > 0 ? Math.max(0, (ipoTarget - game.lifetimeCU) / productionRate) : Infinity;
    return {
      productionRate,
      egressFees,
      clients,
      egressDeltaText: `${telemetryDeltas.egressMinuteDelta >= 0 ? "▲" : "▼"} ${gameEngine.formatSigned(telemetryDeltas.egressMinuteDelta, 2)} this minute`,
      clickValue: gameEngine.getClickValue(game),
      clickCore: game.legacyMultiplier > 0 ? gameEngine.getClickValue(game) / game.legacyMultiplier : game.clickPower,
      provisionMessage,
      provisionFlashVisible: provisionFlashUntil > Date.now(),
      ipoTarget,
      ipoReady: game.lifetimeCU >= ipoTarget,
      ipoProgress,
      ipoPercent: (ipoProgress * 100).toFixed(2).replace(/0$/, "").replace(/\.0$/, ""),
      ipoEtaSeconds,
      etaColor: ipoEtaSeconds > 43200 ? "var(--danger)" : ipoEtaSeconds > 7200 ? "var(--warning)" : "var(--text-primary)"
    };
  }, [game, telemetryDeltas, provisionMessage, provisionFlashUntil]);

  useEffect(() => {
    if (!derived.ipoReady) {
      setIpoOfferDismissedAtPrestige(null);
      return;
    }
    if (overlay.visible || overlay.phase !== "offer") {
      return;
    }
    if (ipoOfferDismissedAtPrestige === game.prestigeCount) {
      return;
    }
    setOverlay({
      visible: true,
      phase: "offer",
      title: gameEngine.getCompanyName(game.prestigeCount),
      subtitle: "Series D — $2.4B Valuation",
      legacyText: ""
    });
  }, [derived.ipoReady, game.prestigeCount, overlay.visible, overlay.phase, ipoOfferDismissedAtPrestige]);

  const generatorsUi = useMemo(() => (
    Object.fromEntries(gameEngine.GENERATORS.map((generator) => {
      const unlocked = generator.unlock(game);
      const purchase = gameEngine.getPurchaseQuantity(game, generator);
      const canAfford = unlocked && purchase.count > 0 && purchase.cost <= game.cu + 0.0001;
      const unlockProgress = !unlocked ? gameEngine.getUnlockProgress(generator, game) : null;
      return [generator.id, {
        unlocked,
        countText: gameEngine.formatNumber(gameEngine.getGeneratorOwned(game, generator.id)),
        rateText: gameEngine.formatRate(gameEngine.getServerRate(game, generator)),
        costText: unlocked ? `Next: ${gameEngine.formatCU(purchase.cost || gameEngine.getBulkCost(game, generator, 1))}` : (
          generator.id === "dedicated" ? "Unlock at 50 clients" :
          generator.id === "rack" ? "Unlock at 200 CU/s" :
          generator.id === "pod" ? "Unlock at 10 racks" :
          generator.id === "region" ? "Unlock at 5 pods" :
          generator.id === "cable" ? "Unlock at 3 regions" :
          "Unlock at 500K lifetime CU"
        ),
        unlockCopy: unlockProgress ? `${gameEngine.formatNumber(unlockProgress.current)} / ${gameEngine.formatNumber(unlockProgress.target)} ${unlockProgress.unit}  (${Math.round(unlockProgress.progress * 100)}%)` : "",
        unlockPercent: unlockProgress ? Math.max(0, Math.min(100, unlockProgress.progress * 100)) : 0,
        unlockEta: unlockProgress ? `ETA  ${gameEngine.formatLongEta(unlockProgress.eta)} at current rate` : "",
        buttonText: unlocked ? `BUY ${game.buyMode === "MAX" ? Math.max(1, purchase.count) : game.buyMode.slice(1)}` : "LOCKED",
        canAfford,
        buttonTooltipSource: { kind: "generator", id: generator.id },
        purchaseFlash: purchaseFlashId === generator.id,
        newlyUnlocked: newUnlockId === generator.id
      }];
    }))
  ), [game, purchaseFlashId, newUnlockId]);

  const upgradesUi = useMemo(() => (
    Object.fromEntries(gameEngine.UPGRADES.map((upgrade) => {
      const preview = gameEngine.getUpgradePreview(game, upgrade);
      const purchased = game.purchasedUpgrades.includes(upgrade.id);
      const available = upgrade.available(game);
      const disabled = purchased || !available || upgrade.cost > game.cu + 0.0001;
      return [upgrade.id, {
        purchased,
        available,
        disabled,
        effectText: preview.effectText,
        paybackText: purchased ? `CONTRIBUTING  ${preview.contributionText}` : preview.paybackText,
        costText: purchased ? "ACTIVE" : (available ? gameEngine.formatCU(upgrade.cost) : "LOCKED"),
        tooltipSource: { kind: "upgrade", id: upgrade.id }
      }];
    }))
  ), [game]);

  const boardVoteProgress = useMemo(() => gameEngine.getNextBoardVoteProgress(game), [game]);

  const incidentUi = useMemo(() => gameEngine.getIncidentUi(game), [game]);

  const registerGeneratorRef = useCallback((id) => (node) => {
    generatorRefs.current[id] = node;
  }, []);

  return (
    <>
      <div className="app-shell">
        <TopBar game={game} derived={derived} />
        <Workspace
          game={game}
          derived={derived}
          buyModeButtons={["x1", "x10", "MAX"]}
          generatorsUi={generatorsUi}
          upgradesUi={upgradesUi}
          boardVoteProgress={boardVoteProgress}
          boardViewOpen={boardViewOpen}
          incidentUi={incidentUi}
          provisionHover={provisionHover}
          floatingTexts={floatingTexts}
          flashRackIndex={flashRackIndex}
          onSetBuyMode={handleSetBuyMode}
          onBuyGenerator={handleBuyGenerator}
          onBuyUpgrade={handleBuyUpgrade}
          onBuyPolicy={handleBuyPolicy}
          onProvision={handleProvision}
          onToggleBoardView={handleToggleBoardView}
          onDownloadSave={handleDownloadSave}
          onImportSave={handleImportSave}
          onResetSave={handleResetSave}
          onProvisionHover={setProvisionHover}
          onResolveIncident={handleResolveIncident}
          onShowTooltip={showTooltip}
          onHideTooltip={hideTooltip}
          registerGeneratorRef={registerGeneratorRef}
        />
        <FooterBar game={game} derived={derived} onOpenIpo={handleOpenIpoOverlay} />
      </div>

      <Overlay overlay={overlay} onProceed={handleProceedToIPO} onContinue={handleContinueAfterPrestige} onCloseOffer={handleDismissIpoOffer} tooltip={tooltip} />
    </>
  );
}
