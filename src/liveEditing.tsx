import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type InputHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";

export const LiveEditing = createContext<{
  run: (group: symbol, change: () => void) => void;
} | null>(null);

function equivalent(a: string, b: string) {
  return (
    a === b ||
    (a.trim() !== "" &&
      b.trim() !== "" &&
      Number.isFinite(Number(a)) &&
      Number(a) === Number(b))
  );
}

function useDraft(value: string | number, numeric = false) {
  const live = useContext(LiveEditing);
  const [draft, setDraft] = useState(String(value));
  const lastSent = useRef(String(value));
  const group = useRef(Symbol("property edit"));
  useEffect(() => {
    const unchanged = numeric
      ? equivalent(String(value), lastSent.current)
      : String(value) === lastSent.current;
    if (!unchanged) setDraft(String(value));
    lastSent.current = String(value);
  }, [value, numeric]);
  return {
    draft,
    setDraft,
    focus: () => {
      group.current = Symbol("property edit");
    },
    send: (text: string, change: () => void) => {
      lastSent.current = text;
      if (live) live.run(group.current, change);
      else change();
    },
  };
}

export function LiveInput({
  value,
  onChange,
  onFocus,
  onBlur,
  onKeyDown,
  ...props
}: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "defaultValue"> & {
  value: string | number;
}) {
  const { draft, setDraft, focus, send } = useDraft(
    value,
    props.type === "number",
  );
  const valid =
    props.type !== "number" ||
    (draft.trim() !== "" &&
      Number.isFinite(Number(draft)) &&
      (props.min === undefined || Number(draft) >= Number(props.min)) &&
      (props.max === undefined || Number(draft) <= Number(props.max)));
  return (
    <input
      {...props}
      value={draft}
      aria-invalid={!valid || undefined}
      onFocus={(event) => {
        focus();
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        if (
          props.type === "number" &&
          (text.trim() === "" ||
            !Number.isFinite(Number(text)) ||
            event.currentTarget.validity.rangeOverflow ||
            event.currentTarget.validity.rangeUnderflow)
        )
          return;
        send(text, () => onChange?.(event));
      }}
      onBlur={(event) => {
        setDraft(String(value));
        onBlur?.(event);
      }}
      onKeyDown={(event) => {
        onKeyDown?.(event);
        if (
          !event.defaultPrevented &&
          (event.key === "Enter" || event.key === "Escape")
        ) {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    />
  );
}

export function LiveTextarea({
  value,
  onChange,
  onFocus,
  onBlur,
  ...props
}: Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  "value" | "defaultValue"
> & { value: string }) {
  const { draft, setDraft, focus, send } = useDraft(value);
  return (
    <textarea
      {...props}
      value={draft}
      onFocus={(event) => {
        focus();
        onFocus?.(event);
      }}
      onChange={(event) => {
        const text = event.currentTarget.value;
        setDraft(text);
        send(text, () => onChange?.(event));
      }}
      onBlur={(event) => {
        setDraft(value);
        onBlur?.(event);
      }}
    />
  );
}
