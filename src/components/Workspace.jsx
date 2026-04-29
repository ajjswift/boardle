import { useRef } from "react";
import gameEngine from "../game";

function InfoTrigger({ label, text, side, onShowTooltip, onHideTooltip }) {
  return (
    <div className="info-tip">
      <button
        className="info-trigger"
        type="button"
        aria-label={label}
        onMouseEnter={onShowTooltip(text, side)}
        onFocus={onShowTooltip(text, side)}
        onMouseLeave={onHideTooltip}
        onBlur={onHideTooltip}
      >
        ?
      </button>
    </div>
  );
}

function PanelHeader({ title, tooltip, side, onShowTooltip, onHideTooltip }) {
  return (
    <div className="title-row">
      <div className="section-title">{title}</div>
      {tooltip ? <InfoTrigger label={`${title} help`} text={tooltip} side={side} onShowTooltip={onShowTooltip} onHideTooltip={onHideTooltip} /> : null}
    </div>
  );
}

function GeneratorRow({ generator, ui, onBuy, registerRef, onShowTooltip, onHideTooltip }) {
  return (
    <div className={`generator-card${ui.unlocked ? "" : " locked"}${ui.purchaseFlash ? " purchase-flash" : ""}${ui.newlyUnlocked ? " newly-unlocked" : ""}`} ref={registerRef(generator.id)}>
      <div className="generator-top">
        <div className="generator-name">
          <span>{generator.icon}</span>
          <span>{generator.name}</span>
        </div>
        <div className="generator-metrics">
          <span>{ui.countText}</span>
          <span className="rate-pill">{ui.rateText}</span>
        </div>
      </div>

      <div className="generator-meta">
        <div className="generator-bottom">
          <div className="cost-text">{ui.costText}</div>
          <div></div>
        </div>
        {!ui.unlocked ? (
          <div className="unlock-progress">
            <div className="unlock-copy">{ui.unlockCopy}</div>
            <div className="unlock-bar">
              <div className="unlock-fill" style={{ width: `${ui.unlockPercent}%` }}></div>
            </div>
            <div className="unlock-eta">{ui.unlockEta}</div>
          </div>
        ) : null}
      </div>

      <div
        className="buy-button-wrap"
        onMouseEnter={onShowTooltip(ui.buttonTooltipSource, "right")}
        onFocus={onShowTooltip(ui.buttonTooltipSource, "right")}
        onMouseLeave={onHideTooltip}
        onBlur={onHideTooltip}
      >
        <button className="buy-button" type="button" disabled={!ui.canAfford} onClick={() => onBuy(generator.id)}>
          {ui.buttonText}
        </button>
      </div>
    </div>
  );
}

function UpgradeRow({ upgrade, ui, onBuy, onShowTooltip, onHideTooltip }) {
  return (
    <button
      type="button"
      className={`upgrade-row${ui.purchased ? " purchased" : ""}${ui.available ? "" : " locked"}`}
      onClick={() => !ui.disabled && onBuy(upgrade.id)}
      onMouseEnter={onShowTooltip(ui.tooltipSource, "left")}
      onFocus={onShowTooltip(ui.tooltipSource, "left")}
      onMouseLeave={onHideTooltip}
      onBlur={onHideTooltip}
      aria-disabled={ui.disabled ? "true" : "false"}
    >
      <div className="upgrade-copy">
        <div className="upgrade-name">{upgrade.name}</div>
        <div className="upgrade-flavour">{upgrade.flavour}</div>
        <div className="upgrade-effect">{ui.effectText}</div>
        <div className="upgrade-payback">{ui.paybackText}</div>
      </div>
      <div className="upgrade-cost">{ui.costText}</div>
    </button>
  );
}

function BoardTree({ game, boardVoteProgress, onBuyPolicy, onShowTooltip, onHideTooltip }) {
  return (
    <div className="board-tree-shell">
      <div className="board-votes-summary">
        <div className="board-votes-label">Board Votes Available</div>
        <div className="board-votes-value">{gameEngine.formatNumber(game.boardVotes)}</div>
      </div>
      <div className="board-vote-progress">
        <div className="unlock-bar">
          <div className="unlock-fill" style={{ width: `${Math.round(boardVoteProgress.progress * 100)}%` }}></div>
        </div>
        <div className="unlock-copy">
          {gameEngine.formatCU(boardVoteProgress.current)} / {gameEngine.formatCU(boardVoteProgress.target)} toward next vote
        </div>
      </div>

      <div className="board-tree-grid">
        {gameEngine.POLICIES.map((policy) => {
          const owned = gameEngine.getPolicyLevel(game, policy.id);
          return (
            <div key={policy.id} className="board-track">
              <div className="board-track-title">{policy.name}</div>
              {Array.from({ length: policy.maxLevel }, (_, index) => {
                const level = index + 1;
                const isOwned = level <= owned;
                const isNext = level === owned + 1;
                const isHidden = level > owned + 1;
                const levelCost = gameEngine.getPolicyCost(policy, level);
                if (isHidden) {
                  return <div key={level} className="board-node hidden"></div>;
                }
                return (
                  <button
                    key={level}
                    type="button"
                    className={`board-node${isOwned ? " owned" : ""}${isNext ? " next" : ""}`}
                    onClick={() => {
                      if (isNext) {
                        onBuyPolicy(policy.id);
                      }
                    }}
                    onMouseEnter={onShowTooltip({ kind: "policy-level", id: policy.id, level }, "right")}
                    onFocus={onShowTooltip({ kind: "policy-level", id: policy.id, level }, "right")}
                    onMouseLeave={onHideTooltip}
                    onBlur={onHideTooltip}
                    aria-disabled={isNext ? "false" : "true"}
                  >
                    <span className="board-node-tier">T{level}</span>
                    <span className="board-node-state">{isOwned ? "ACTIVE" : "AVAILABLE"}</span>
                    <span className="board-node-cost">
                      {isOwned ? "locked in" : `${levelCost} vote${levelCost === 1 ? "" : "s"}`}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function RackUnit({ filled, short, overloaded, flash, index }) {
  return (
    <div className={`rack-unit${filled ? " filled" : ""}${filled && overloaded ? " overloaded" : ""}${flash ? " flash" : ""}`}>
      <div className="led"></div>
      <div className="activity">
        {Array.from({ length: 5 }, (_, light) => (
          <span key={light} style={{ animationDelay: `${(((index + light) * 0.11) % 1.4).toFixed(2)}s` }}></span>
        ))}
      </div>
      <div className="unit-tier">{short}</div>
    </div>
  );
}

function RackCompact({ short, overloaded, flash }) {
  return (
    <div className={`rack-compact${overloaded ? " overloaded" : ""}${flash ? " flash" : ""}`}>
      <div className="rack-compact-top">
        <span className="rack-compact-led"></span>
        <span className="rack-compact-title">{short || "MIX"}</span>
        <span className="rack-compact-capacity">12U</span>
      </div>
      <div className="rack-compact-bars">
        {Array.from({ length: 6 }, (_, index) => (
          <span key={index}></span>
        ))}
      </div>
      <div className="rack-compact-meta">Legacy row summarised</div>
    </div>
  );
}

function ServerRoom({ units, overloaded, flashRackIndex, floatingTexts, capacityPercent }) {
  const rackCount = Math.max(4, Math.ceil(units.length / 12));
  const rows = Math.ceil(rackCount / 4);
  const latestRowStart = Math.max(0, (rows - 1) * 4);

  return (
      <div
          className="rack-stage"
          style={{ "--capacity-fill": `${capacityPercent}%` }}
      >
          <div className="rack-enclosure">
              <div
                  className="rack-grid"
                  style={{
                      gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                  }}
              >
                  {Array.from({ length: rackCount }, (_, rackIndex) => {
                      const rackStart = rackIndex * 12;
                      const rackUnits = Array.from(
                          { length: 12 },
                          (_, unitIndex) => units[rackStart + unitIndex],
                      );
                      const filledCount = rackUnits.filter(Boolean).length;
                      const isFull = filledCount === 12;
                      const shouldCompact =
                          rows > 1 && rackIndex < latestRowStart && isFull;
                      const rackFlash =
                          flashRackIndex !== null &&
                          flashRackIndex >= rackStart &&
                          flashRackIndex < rackStart + 12;
                      const summaryShort = rackUnits[0]?.short || "MIX";

                      return (
                          <div
                              className={`rack${shouldCompact ? " compact" : ""}`}
                              key={rackIndex}
                          >
                              {shouldCompact ? (
                                  <RackCompact
                                      short={summaryShort}
                                      overloaded={overloaded}
                                      flash={rackFlash}
                                  />
                              ) : (
                                  Array.from({ length: 12 }, (_, unitIndex) => {
                                      const flatIndex = rackStart + unitIndex;
                                      const unit = units[flatIndex];
                                      return (
                                          <RackUnit
                                              key={flatIndex}
                                              filled={!!unit}
                                              short={unit ? unit.short : ""}
                                              overloaded={overloaded}
                                              flash={
                                                  flashRackIndex === flatIndex
                                              }
                                              index={flatIndex}
                                          />
                                      );
                                  })
                              )}
                          </div>
                      );
                  })}
              </div>
          </div>

          <div className="floating-layer">
              {floatingTexts.map((item) => (
                  <div
                      key={item.id}
                      className="floating-text"
                      style={{ left: `${item.left}%`, top: `${item.top}%` }}
                  >
                      {item.text}
                  </div>
              ))}
          </div>
      </div>
  );
}

export default function Workspace(props) {
  const {
    game,
    derived,
    buyModeButtons,
    generatorsUi,
    upgradesUi,
    boardVoteProgress,
    boardViewOpen,
    incidentUi,
    provisionHover,
    floatingTexts,
    flashRackIndex,
    onSetBuyMode,
    onBuyGenerator,
    onBuyUpgrade,
    onBuyPolicy,
    onProvision,
    onToggleBoardView,
    onDownloadSave,
    onImportSave,
    onResetSave,
    onProvisionHover,
    onResolveIncident,
    onShowTooltip,
    onHideTooltip,
    registerGeneratorRef
  } = props;
  const saveImportInputRef = useRef(null);

  const units = gameEngine.getRackUnits(game);

  return (
    <div className={`workspace${game.activeIncident ? " incident-active" : ""}`}>
      <div className="incident-banner">
        <div className="incident-copy">
          <span className="incident-title">{incidentUi ? incidentUi.title : ""}</span>
          <span className="incident-detail">{incidentUi ? incidentUi.impact : ""}</span>
          <span className="incident-meta">{incidentUi ? incidentUi.description : ""}</span>
        </div>
        <div className="incident-actions">
          <button className="incident-button" type="button" disabled={!incidentUi || incidentUi.resolveCost > game.cu} onClick={onResolveIncident}>
            {incidentUi ? incidentUi.resolveText : "Resolve"}
          </button>
        </div>
      </div>

      <div className="main-grid">
        <aside className="panel left-panel">
          <PanelHeader
            title="Infrastructure"
            tooltip="Purchase infrastructure to generate passive Compute Units. Each owned item also occupies visible rack space in the server room."
            side="right"
            onShowTooltip={onShowTooltip}
            onHideTooltip={onHideTooltip}
          />

          <div className="buy-modes">
            {buyModeButtons.map((mode) => (
              <button key={mode} className={`mode-button${game.buyMode === mode ? " active" : ""}`} type="button" onClick={() => onSetBuyMode(mode)}>
                {mode}
              </button>
            ))}
          </div>

          <div className="generator-list">
            {gameEngine.GENERATORS.map((generator) => (
              <GeneratorRow
                key={generator.id}
                generator={generator}
                ui={generatorsUi[generator.id]}
                onBuy={onBuyGenerator}
                registerRef={registerGeneratorRef}
                onShowTooltip={onShowTooltip}
                onHideTooltip={onHideTooltip}
              />
            ))}
          </div>
        </aside>

        <main className="panel center-panel">
          <div className="balance-bar">
            <div className="balance-readout">
              <PanelHeader
                title="Billable Compute"
                tooltip="This is your spendable currency. Provisioning adds it directly, infrastructure produces it automatically, and upgrades consume it."
                side="right"
                onShowTooltip={onShowTooltip}
                onHideTooltip={onHideTooltip}
              />
              <div className="balance-value">{gameEngine.formatCU(game.cu)}</div>
              <div className="balance-subline">
                <div className="balance-stat">Lifetime {gameEngine.formatCU(game.lifetimeCU)}</div>
                <div className="balance-stat">Legacy {gameEngine.formatMultiplier(game.legacyMultiplier)}</div>
                <div className="balance-stat">{game.offlineEarnings > 0 ? `Offline revenue booked: ${gameEngine.formatCU(game.offlineEarnings)}` : "No offline revenue booked"}</div>
              </div>
            </div>
            <div className="hero-hint">Provisioning theatre for executive review</div>
          </div>

          <div className="center-head-row">
            <PanelHeader
              title={boardViewOpen ? "Board Decisions" : "Server Room"}
              tooltip={boardViewOpen
                ? "Permanent directive tree. Higher tiers remain hidden until the prior tier is enacted."
                : "A live visual ledger of deployed hardware. Filled units represent owned infrastructure, and incidents tint affected systems red."}
              side="right"
              onShowTooltip={onShowTooltip}
              onHideTooltip={onHideTooltip}
            />
          </div>

          {boardViewOpen ? (
            <BoardTree
              game={game}
              boardVoteProgress={boardVoteProgress}
              onBuyPolicy={onBuyPolicy}
              onShowTooltip={onShowTooltip}
              onHideTooltip={onHideTooltip}
            />
          ) : (
            <ServerRoom
              units={units}
              overloaded={!!(game.activeIncident && ["ddos", "devops", "public-bucket", "tweet"].includes(game.activeIncident.id))}
              flashRackIndex={flashRackIndex}
              floatingTexts={floatingTexts}
              capacityPercent={gameEngine.getCapacityPercent(game)}
            />
          )}

          <button
            className={`primary-button${derived.provisionFlashVisible ? " flash" : ""}`}
            type="button"
            onClick={onProvision}
            onMouseEnter={() => onProvisionHover(true)}
            onMouseLeave={() => onProvisionHover(false)}
          >
            PROVISION INSTANCE
          </button>

          <div className={`provision-flash${derived.provisionMessage ? " visible" : ""}`}>{derived.provisionMessage || " "}</div>

          <div className="production-lines">
            <div className="production-line">
              <span className="lead">{gameEngine.formatRate(derived.productionRate)}</span>
              <span className="tail">Production Rate</span>
            </div>
            <div className="production-line">
              <span className="lead">CLICK VALUE  +{gameEngine.formatNumber(derived.clickValue)} CU</span>
              <span className="tail">(×{gameEngine.formatNumber(derived.clickCore)} multiplier)</span>
            </div>
            <div className="production-line">
              <span className="lead">{provisionHover ? `TOTAL AFTER CLICK  ${gameEngine.formatCU(game.cu + derived.clickValue)}` : gameEngine.getNextTierText(game)}</span>
              <span className="tail">{provisionHover ? "Manual Provisioning" : "Forward Capacity Planning"}</span>
            </div>
          </div>
        </main>

        <aside className="panel right-panel">
          <section className="right-section">
            <PanelHeader
              title="Optimisations"
              tooltip="These are permanent strategic upgrades. They can improve click output, overall production, cost efficiency, or client growth."
              side="left"
              onShowTooltip={onShowTooltip}
              onHideTooltip={onHideTooltip}
            />

            <div className="upgrade-list">
              {gameEngine.UPGRADES.map((upgrade) => (
                <UpgradeRow
                  key={upgrade.id}
                  upgrade={upgrade}
                  ui={upgradesUi[upgrade.id]}
                  onBuy={onBuyUpgrade}
                  onShowTooltip={onShowTooltip}
                  onHideTooltip={onHideTooltip}
                />
              ))}
            </div>
            <div className="right-panel-actions">
              <button type="button" className={`board-decisions-button panel-footer${boardViewOpen ? " active" : ""}`} onClick={onToggleBoardView}>
                {boardViewOpen ? "Return to Server Room" : "Board Decisions"}
              </button>
              <button type="button" className="save-transfer-button" onClick={onDownloadSave}>
                Download Save
              </button>
              <button
                type="button"
                className="save-transfer-button"
                onClick={() => {
                  if (saveImportInputRef.current) {
                    saveImportInputRef.current.click();
                  }
                }}
              >
                Import Save
              </button>
              <input
                ref={saveImportInputRef}
                className="save-import-input"
                type="file"
                accept="application/json,.json"
                onChange={(event) => {
                  const file = event.target.files && event.target.files[0];
                  if (file) {
                    onImportSave(file);
                  }
                  event.target.value = "";
                }}
              />
              <button type="button" className="reset-save-button" onClick={onResetSave}>
                Reset Save
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
