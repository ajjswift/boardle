import gameEngine from "../game";

export default function TopBar({ game, derived }) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-title">{gameEngine.getCompanyName(game.prestigeCount)}</div>
        <div className="brand-subtitle">Enterprise Cloud Solutions</div>
      </div>

      <div className="kpi-strip">
        <div className="kpi">
          <div className="kpi-value">{gameEngine.formatCU(game.cu)}</div>
          <div className="kpi-label">Compute Units</div>
          <div className="kpi-delta">▲ {gameEngine.formatNumber(derived.productionRate)}/s</div>
        </div>

        <div className="kpi">
          <div className="kpi-value">{gameEngine.formatNumber(derived.egressFees)}</div>
          <div className="kpi-label">Egress Fees/s</div>
          <div className="kpi-delta">{derived.egressDeltaText}</div>
        </div>

        <div className="kpi">
          <div className="kpi-value">{gameEngine.formatNumber(derived.clients)}</div>
          <div className="kpi-label">Clients</div>
          <div className="kpi-delta">{gameEngine.getClientThresholdText(game)}</div>
        </div>
      </div>

      <div className={`status-block${game.activeIncident ? " incident" : ""}`}>
        <div className={`status-dot${game.activeIncident ? " incident" : ""}`}></div>
        <div style={game.activeIncident ? { color: "var(--danger)" } : undefined}>
          {game.activeIncident ? "INCIDENT ACTIVE" : "SYSTEMS OPERATIONAL"}
        </div>
        <div className="status-divider"></div>
        <div>BOARD VOTES {gameEngine.formatNumber(game.boardVotes || 0)}</div>
      </div>
    </header>
  );
}
