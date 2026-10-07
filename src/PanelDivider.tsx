import { useCallback, useRef } from "react";
import {
  PANEL_DEFAULT,
  PANEL_MAX,
  PANEL_MIN,
  clampPanelWidth,
  storePanelWidth,
  useEditor,
} from "./store";

const STEP = 8;

/**
 * Photoshop-style panel divider: drag to resize the Properties panel,
 * arrow keys when focused, double-click to reset. Width is editor-only and
 * persisted separately from the document, so it can never dirty the project
 * or reach the Vega export.
 */
export function PanelDivider() {
  const width = useEditor((s) => s.propertiesWidth);
  const setWidth = useEditor((s) => s.setPropertiesWidth);
  const drag = useRef<{ startX: number; startW: number } | null>(null);
  const bodyRef = useRef<HTMLDivElement | null>(null);

  const commit = useCallback(
    (next: number) => {
      const clamped = clampPanelWidth(next);
      setWidth(clamped);
      storePanelWidth(clamped);
    },
    [setWidth],
  );

  const maxForViewport = () => {
    const body = bodyRef.current?.parentElement;
    if (!body) return PANEL_MAX;
    // Never let the panel eat the canvas: cap at 40% of the editor body.
    return Math.min(PANEL_MAX, Math.floor(body.clientWidth * 0.4));
  };

  return (
    <div
      ref={bodyRef}
      className="panel-divider"
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize Properties panel"
      aria-valuenow={width}
      aria-valuemin={PANEL_MIN}
      aria-valuemax={maxForViewport()}
      tabIndex={0}
      onDoubleClick={() => commit(PANEL_DEFAULT)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        drag.current = { startX: event.clientX, startW: width };
        event.currentTarget.setPointerCapture(event.pointerId);
        document.body.classList.add("resizing-panel");
      }}
      onPointerMove={(event) => {
        const d = drag.current;
        if (!d) return;
        // The panel is on the right, so dragging left widens it.
        commit(d.startW + (d.startX - event.clientX));
      }}
      onPointerUp={(event) => {
        drag.current = null;
        document.body.classList.remove("resizing-panel");
        try {
          event.currentTarget.releasePointerCapture(event.pointerId);
        } catch {
          /* already released */
        }
      }}
      onPointerCancel={() => {
        drag.current = null;
        document.body.classList.remove("resizing-panel");
      }}
      onKeyDown={(event) => {
        const step = event.shiftKey ? STEP * 4 : STEP;
        if (event.key === "ArrowLeft") commit(width + step);
        else if (event.key === "ArrowRight") commit(width - step);
        else if (event.key === "Home") commit(PANEL_MIN);
        else if (event.key === "End") commit(maxForViewport());
        else if (event.key === "Enter") commit(PANEL_DEFAULT);
        else return;
        event.preventDefault();
      }}
    />
  );
}
