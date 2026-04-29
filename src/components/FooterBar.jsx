import React from "react";
import gameEngine from "../game";

export default function FooterBar({ game, derived, onOpenIpo }) {
  const renderTickerText = (message, keyPrefix) => {
    const parts = message.split("NimbusCore™");
    return (
      <span className="ticker-item" key={keyPrefix + message}>
        {parts.map((part, index) => (
          <React.Fragment key={keyPrefix + index}>
            {index > 0 ? <span className="ticker-highlight">NimbusCore™</span> : null}
            {part}
          </React.Fragment>
        ))}
      </span>
    );
  };

  return (
    <footer className="bottom-bar">
      <div className="ipo-wrap">
        <div className="ipo-meta">
          IPO TARGET {gameEngine.formatNumber(game.lifetimeCU)} / {gameEngine.formatNumber(derived.ipoTarget)} CU · {derived.ipoPercent}% · ETA <span className="eta" style={{ color: derived.etaColor }}>{gameEngine.formatEta(derived.ipoEtaSeconds)}</span> at current rate
        </div>
        <div className="ipo-track">
          <div
            className={`ipo-fill${derived.ipoProgress > 0.5 ? " shimmer" : ""}`}
            style={{ width: `${Math.min(100, derived.ipoProgress * 100)}%` }}
          ></div>
        </div>
        {derived.ipoReady ? (
          <button type="button" className="ipo-action-button" onClick={onOpenIpo}>
            IPO READY
          </button>
        ) : null}
      </div>

      <div className="ticker-shell">
        <div className="ticker-track">
          {game.tickerMessages.map((message, index) => renderTickerText(message, `a-${index}`))}
          {game.tickerMessages.map((message, index) => renderTickerText(message, `b-${index}`))}
        </div>
      </div>
    </footer>
  );
}
