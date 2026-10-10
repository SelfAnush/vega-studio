import { useContext, useRef, useState, type PointerEvent } from "react";
import { LiveEditing } from "./liveEditing";
import * as Popover from "@radix-ui/react-popover";
import { Check, ChevronDown } from "lucide-react";
import { validHex, hexToHsv, hsvToHex } from "./color";

export function ColorPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (color: string) => void;
}) {
  const live = useContext(LiveEditing);
  const original = useRef(value);
  const historyGroup = useRef(Symbol("color edit"));
  const preview = (color: string) => live?.run(historyGroup.current, () => onChange(color));
  const cancel = () => {
    if (live) preview(original.current);
    setOpen(false);
  };
  const [open, setOpen] = useState(false),
    [hex, setHex] = useState(value),
    [hsv, setHsv] = useState(hexToHsv(value));
  const update = (next: [number, number, number]) => {
    setHsv(next);
    setHex(hsvToHex(...next));
    preview(hsvToHex(...next));
  };
  const pick = (event: PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    update([
      hsv[0],
      Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      Math.max(0, Math.min(1, 1 - (event.clientY - rect.top) / rect.height)),
    ]);
  };
  return (
    <div className="field color-field">
      <span>{label}</span>
      <Popover.Root
        open={open}
        onOpenChange={(next) => {
          if (next) {
            original.current = value;
            historyGroup.current = Symbol("color edit");
            setHex(value);
            setHsv(hexToHsv(value));
          }
          setOpen(next);
        }}
        modal
      >
        <Popover.Trigger asChild>
          <button type="button" aria-label={label} className="color-trigger">
            <span className="swatch" style={{ background: value }} />
            <code>{value.toUpperCase()}</code>
            <ChevronDown size={12} />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            data-color-open="true"
            aria-label={`${label} color picker`}
            className="color-popover"
            side="left"
            sideOffset={12}
            collisionPadding={16}
            onKeyDown={(e) => e.stopPropagation()}
            onEscapeKeyDown={() => { if (live) cancel(); }}
          >
            <div className="popover-title">
              {label}
              <span className="muted">Color</span>
            </div>
            <div
              className="color-plane"
              role="slider"
              tabIndex={0}
              aria-label="Saturation and brightness"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(hsv[1] * 100)}
              aria-valuetext={`${Math.round(hsv[1] * 100)}% saturation, ${Math.round(hsv[2] * 100)}% brightness. Arrow keys adjust.`}
              style={{ backgroundColor: `hsl(${hsv[0]} 100% 50%)` }}
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                pick(e);
              }}
              onPointerMove={(e) => {
                if (e.currentTarget.hasPointerCapture(e.pointerId)) pick(e);
              }}
              onKeyDown={(e) => {
                if (
                  ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
                    e.key,
                  )
                ) {
                  e.preventDefault();
                  update([
                    hsv[0],
                    Math.max(
                      0,
                      Math.min(
                        1,
                        hsv[1] +
                          (e.key === "ArrowRight"
                            ? 0.01
                            : e.key === "ArrowLeft"
                              ? -0.01
                              : 0),
                      ),
                    ),
                    Math.max(
                      0,
                      Math.min(
                        1,
                        hsv[2] +
                          (e.key === "ArrowUp"
                            ? 0.01
                            : e.key === "ArrowDown"
                              ? -0.01
                              : 0),
                      ),
                    ),
                  ]);
                }
              }}
            >
              <span
                className="color-cursor"
                style={{
                  left: `${hsv[1] * 100}%`,
                  top: `${(1 - hsv[2]) * 100}%`,
                }}
              />
            </div>
            <label className="hue-field">
              <span>Hue</span>
              <input
                aria-label="Hue"
                className="hue-slider"
                type="range"
                min="0"
                max="359"
                value={hsv[0]}
                onChange={(e) =>
                  update([Number(e.target.value), hsv[1], hsv[2]])
                }
              />
            </label>
            <div className="color-preview">
              <span
                className="swatch"
                title="Original color"
                style={{ background: original.current }}
              />
              <span
                className="swatch"
                title="New color"
                style={{ background: validHex(hex) ? hex : value }}
              />
              <label className="field">
                <span>Hex</span>
                <input
                  aria-label="Hex color"
                  value={hex}
                  aria-invalid={!validHex(hex)}
                  spellCheck={false}
                  onChange={(e) => {
                    const text = e.target.value;
                    setHex(text);
                    if (validHex(text)) {
                      setHsv(hexToHsv(text));
                      preview(text.toLowerCase());
                    }
                  }}
                />
              </label>
            </div>
            {!validHex(hex) && (
              <p role="alert" className="color-error">
                Enter a six-digit hex color, such as #7885F5.
              </p>
            )}
            <div className="color-presets">
              {[
                "#ffffff",
                "#171c27",
                "#7885f5",
                "#67b9a0",
                "#e8b65c",
                "#ee7686",
              ].map((color) => (
                <button
                  type="button"
                  key={color}
                  aria-label={`Use ${color}`}
                  style={{ background: color }}
                  onClick={() => {
                    setHex(color);
                    setHsv(hexToHsv(color));
                    preview(color);
                  }}
                />
              ))}
            </div>
            <div className="color-actions">
              <button type="button" onClick={cancel}>
                Cancel
              </button>
              <button
                type="button"
                className="primary"
                disabled={!validHex(hex)}
                onClick={() => {
                  if (!live) onChange(hex.toLowerCase());
                  setOpen(false);
                }}
              >
                <Check size={14} />
                {live ? "Done" : "Apply color"}
              </button>
            </div>
            <Popover.Arrow className="popover-arrow" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
