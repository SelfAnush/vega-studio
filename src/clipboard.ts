import {
  parseClipboardText,
  validateClipboard,
  type StudioClipboard,
} from "./model";

/** Session-local fallback when the system clipboard is unavailable. */
let sessionClipboard: StudioClipboard | null = null;

const systemClipboard = () =>
  typeof navigator !== "undefined" ? navigator.clipboard : undefined;

export async function writeClipboard(
  payload: StudioClipboard,
): Promise<"system" | "session"> {
  sessionClipboard = payload;
  try {
    const cb = systemClipboard();
    if (!cb) return "session";
    await cb.writeText(JSON.stringify(payload));
    return "system";
  } catch {
    return "session";
  }
}

/** Read Studio layers: system clipboard first, session fallback second.
 * Returns null (with a reason) when neither holds a valid payload. */
export async function readClipboard(): Promise<{
  payload: StudioClipboard | null;
  via: "system" | "session" | "none";
}> {
  try {
    const cb = systemClipboard();
    if (!cb) throw new Error("unavailable");
    const text = await cb.readText();
    return { payload: parseClipboardText(text), via: "system" };
  } catch {
    if (sessionClipboard) {
      try {
        return { payload: validateClipboard(sessionClipboard), via: "session" };
      } catch {
        sessionClipboard = null;
      }
    }
    return { payload: null, via: "none" };
  }
}
