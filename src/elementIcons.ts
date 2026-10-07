import {
  Type,
  Square,
  Circle,
  Minus,
  Folder,
  ChartColumn,
  type LucideIcon,
} from "lucide-react";
import type { ElementKind } from "./registry";

/** Shared by the picker, Layers, and Properties. */
export const ELEMENT_ICONS: Record<ElementKind, LucideIcon> = {
  text: Type,
  rectangle: Square,
  ellipse: Circle,
  line: Minus,
  group: Folder,
  bar: ChartColumn,
};
