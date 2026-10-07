import { mkdir, writeFile } from "node:fs/promises";
import { sample, validateProject } from "../src/model";
import { compile } from "../src/compiler";
import { shapesExample, barsExample, dashboardExample, reactiveExample } from "../src/examples";

const pairs: [string, ReturnType<typeof shapesExample>][] = [
  ["logstash", sample],
  ["shapes", shapesExample()],
  ["bars", barsExample()],
  ["dashboard", dashboardExample()],
  ["reactive", reactiveExample()],
];
await mkdir("samples", { recursive: true });
for (const [name, project] of pairs) {
  const valid = validateProject(structuredClone(project));
  await writeFile(
    `samples/${name}.project.json`,
    JSON.stringify(valid, null, 2) + "\n",
  );
  await writeFile(
    `samples/${name}.vega.json`,
    JSON.stringify(compile(valid), null, 2) + "\n",
  );
}
