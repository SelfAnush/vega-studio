import type { Element } from "./model";

/** Transient palette-drag state (HTML5 DnD cannot expose payload data on
 * dragover, so the type travels here; cleared on drop/cancel). */
export let paletteDrag: { type: Element["type"]; preset?: Partial<Element> } | null =
  null;

export function startPaletteDrag(
  type: Element["type"],
  preset?: Partial<Element>,
) {
  paletteDrag = { type, preset };
}

export function endPaletteDrag() {
  paletteDrag = null;
}
