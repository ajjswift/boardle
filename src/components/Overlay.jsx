import { useLayoutEffect, useRef, useState } from "react";

export default function Overlay({ overlay, onProceed, onContinue, onCloseOffer, tooltip }) {
  const ref = useRef(null);
  const [style, setStyle] = useState({ visibility: "hidden", opacity: 0 });

  useLayoutEffect(() => {
    if (!tooltip || !ref.current) {
      setStyle({ visibility: "hidden", opacity: 0 });
      return;
    }
    const bubble = ref.current;
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const gap = 10;
    const pad = 12;
    let left = tooltip.side === "left" ? tooltip.rect.left - width - gap : tooltip.rect.right + gap;
    if (left + width > window.innerWidth - pad) {
      left = tooltip.rect.left - width - gap;
    }
    if (left < pad) {
      left = pad;
    }
    let top = tooltip.rect.top + tooltip.rect.height / 2 - height / 2;
    if (top + height > window.innerHeight - pad) {
      top = window.innerHeight - height - pad;
    }
    if (top < pad) {
      top = pad;
    }
    setStyle({ left, top, visibility: "visible", opacity: 1 });
  }, [tooltip]);

  return (
    <>
      <div className={`overlay${overlay.visible ? " visible" : ""}`}>
        <div className="overlay-panel">
          <div className="overlay-title">{overlay.title}</div>
          <div className="overlay-subtitle">{overlay.subtitle}</div>
          {overlay.phase === "offer" ? (
            <>
              <button className="overlay-action" type="button" onClick={onProceed}>PROCEED TO IPO</button>
              <button className="overlay-action secondary" type="button" onClick={onCloseOffer}>CONTINUE OPERATIONS</button>
            </>
          ) : null}
          {overlay.phase === "legacy" ? (
            <>
              <div className="overlay-legacy">{overlay.legacyText}</div>
              <button className="overlay-action" type="button" onClick={onContinue}>RETURN TO OPERATIONS</button>
            </>
          ) : null}
        </div>
      </div>

      <div ref={ref} className="global-tooltip" aria-hidden={tooltip ? "false" : "true"} style={style}>
        {tooltip ? tooltip.text : ""}
      </div>
    </>
  );
}
