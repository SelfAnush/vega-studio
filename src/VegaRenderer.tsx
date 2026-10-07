import { memo, useEffect, useRef } from "react";
import { View, parse } from "vega";
import { compile } from "./compiler";
import type { Project } from "./model";

export const VegaRenderer = memo(function VegaRenderer({
  project,
  onError,
  preview = false,
}: {
  project: Project;
  onError: (message: string) => void;
  preview?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = host.current!;
    let active = true;
    let view: View | undefined;
    try {
      view = new View(parse(compile(project, undefined, true)), {
        renderer: "svg",
      }).initialize(node);
      view.runAsync().catch((error) => {
        if (active) onError(String(error));
      });
    } catch (error) {
      onError(String(error));
    }
    return () => {
      active = false;
      view?.finalize();
      node.replaceChildren();
    };
  }, [project, onError]);
  return <div ref={host} className={`vega-render${preview ? " drag-preview" : ""}`} data-testid="vega-render" />;
});
