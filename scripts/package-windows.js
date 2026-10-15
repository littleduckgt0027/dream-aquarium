import { ZipFile } from "yazl";
import { mkdirSync, createWriteStream, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { resolve, join } from "node:path";
const root = resolve(".");
mkdirSync("artifacts", { recursive: true });
const zip = new ZipFile();
const out = createWriteStream("artifacts/dream-aquarium-windows.zip");
zip.outputStream.pipe(out);
const files = new Set(
  execFileSync("git", [
    "ls-files",
    "--cached",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .toString()
    .split("\0")
    .filter(Boolean),
);
function walk(p) {
  for (const e of readdirSync(p, { withFileTypes: true })) {
    const f = join(p, e.name);
    if (e.isDirectory()) walk(f);
    else files.add(f.replaceAll("\\", "/"));
  }
}
walk("dist");
for (const f of [...files].sort()) {
  if (
    /(^|\/)(node_modules|data|\.git|artifacts|test-results|playwright-report)(\/|$)/.test(
      f,
    ) ||
    /(^|\/)\.env(?:\.(?!example$)[^/]*)?$|\.sqlite(?:-wal|-shm)?$|\.dump$|\.pem$|\.key$/i.test(
      f,
    )
  )
    throw Error("Refusing to package private/generated path: " + f);
  zip.addFile(join(root, f), "dream-aquarium/" + f);
}
zip.end();
await new Promise((r, j) => {
  out.on("close", r);
  out.on("error", j);
  zip.outputStream.on("error", j);
});
console.log(
  "Created artifacts/dream-aquarium-windows.zip (source + production assets; no player database or credentials).",
);
