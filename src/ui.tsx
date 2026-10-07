import { type ReactNode } from "react";
import {
  SlidersHorizontal,
  Database,
  Palette,
  Type,
  Eye,
  LayoutTemplate,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { ColorPicker } from "./ColorPicker";

export function FormField({
  label,
  children,
}: {
  label: ReactNode;
  children: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}
export function PanelHeader({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children?: ReactNode;
}) {
  return (
    <div className="sidebar-title">
      <span className="inspector-title">
        <Icon size={16} aria-hidden="true" />
        {title}
      </span>
      {children}
    </div>
  );
}

export function Field({
  label,
  value,
  onChange,
  type = "text",
  min,
  max,
  step,
}: {
  label: string;
  value: string | number;
  onChange: (value: string) => void;
  type?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  if (type === "color")
    return (
      <ColorPicker label={label} value={String(value)} onChange={onChange} />
    );
  return (
    <label className={`field ${type === "color" ? "color-field" : ""}`}>
      <span>{label}</span>
      <input
        aria-label={label}
        key={String(value)}
        type={type}
        defaultValue={value}
        min={min}
        max={max}
        step={step}
        onBlur={(e) => {
          if (e.target.value !== String(value)) onChange(e.target.value);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.currentTarget.blur();
          }
        }}
      />
    </label>
  );
}

export function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <select
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="check-field">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}

export function SettingsSection({
  title,
  children,
  initialOpen = true,
  variant = "inspector",
}: {
  title: string;
  children: ReactNode;
  initialOpen?: boolean;
  variant?: "inspector" | "form";
}) {
  const Icon = title.includes("Data")
    ? Database
    : title.toLowerCase().includes("color") || title === "Appearance"
      ? Palette
      : title === "Typography" || title === "Content"
        ? Type
        : title === "Visibility"
          ? Eye
          : title === "Layout" || title === "Canvas" || title === "Endpoints"
            ? LayoutTemplate
            : SlidersHorizontal;
  return (
    <details className={`${variant}-section`} open={initialOpen}>
      <summary>
        <Icon size={15} aria-hidden="true" />
        <span>{title}</span>
        <ChevronDown size={14} className="section-chevron" aria-hidden="true" />
      </summary>
      <div className={`${variant}-section-body`}>{children}</div>
    </details>
  );
}

export function TabBar<T extends string>({
  label,
  value,
  onChange,
  items,
  panelId,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  items: { value: T; label: string }[];
  panelId: string;
}) {
  return (
    <div className="dialog-tabs" role="tablist" aria-label={label}>
      {items.map((item, index) => (
        <button
          key={item.value}
          role="tab"
          id={`${panelId}-${item.value}`}
          aria-controls={panelId}
          aria-selected={value === item.value}
          tabIndex={value === item.value ? 0 : -1}
          onClick={() => onChange(item.value)}
          onKeyDown={(event) => {
            const next =
              event.key === "ArrowRight"
                ? (index + 1) % items.length
                : event.key === "ArrowLeft"
                  ? (index + items.length - 1) % items.length
                  : event.key === "Home"
                    ? 0
                    : event.key === "End"
                      ? items.length - 1
                      : -1;
            if (next < 0) return;
            event.preventDefault();
            onChange(items[next].value);
            document.getElementById(`${panelId}-${items[next].value}`)?.focus();
          }}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}
