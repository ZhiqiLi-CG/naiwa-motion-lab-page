// The showcase clips: copy them from the app repo's video pipeline into clips/ (committed), or check clips/.
//
//   node scripts/sync-clips.mjs [--app ../naiwa-motion-lab]   copy <app>/.cache/videos/demo/web/{index.json, <id>.mp4,
//                                                             <id>.jpg} into clips/, drop clips no longer listed
//   node scripts/sync-clips.mjs --check                       only check clips/index.json against the files (CI)
//
// The manifest (written by the app's tools/video/make.mjs) is an array of
//   { id, title {zh,en}, caption {zh,en}, duration, files: { mp4, poster }, credit? }
// clips/index.json keeps that shape; the page builds its hero and gallery from it.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const PAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLIPS = join(PAGE, "clips");
const argv = process.argv.slice(2);
const at = argv.indexOf("--app");
const APP = resolve(at >= 0 ? argv[at + 1] : process.env.NAIWA_APP ?? join(PAGE, "..", "naiwa-motion-lab"));
const SRC = join(APP, ".cache", "videos", "demo", "web");
const MB = (n) => `${(n / 1e6).toFixed(1)} MB`;
const SAFE = /^[a-z0-9][a-z0-9._-]*$/i;

function validate(list, dir) {
  if (!Array.isArray(list)) throw new Error("the manifest is not an array");
  const problems = [];
  for (const c of list) {
    if (!c || !SAFE.test(c.id ?? "")) { problems.push(`bad id ${JSON.stringify(c?.id)}`); continue; }
    for (const key of ["mp4", "poster"]) {
      const f = c.files?.[key];
      if (!f || !SAFE.test(f)) problems.push(`${c.id}: files.${key} missing or not a plain file name`);
      else if (!existsSync(join(dir, f))) problems.push(`${c.id}: ${f} not found in ${dir}`);
    }
    for (const key of ["title", "caption"]) if (!c[key]?.zh || !c[key]?.en) problems.push(`${c.id}: ${key} needs zh and en`);
  }
  return problems;
}

function report(list) {
  let total = 0;
  for (const c of list) {
    const size = ["mp4", "poster"].reduce((s, k) => s + statSync(join(CLIPS, c.files[k])).size, 0);
    total += size;
    console.log(`  ${c.id.padEnd(22)} ${MB(size).padStart(8)}  ${c.duration ?? "?"} s${c.credit ? "  (credit)" : ""}`);
  }
  console.log(`[sync-clips] ${list.length} clip(s), ${MB(total)} in clips/`);
}

if (argv.includes("--check")) {
  const list = JSON.parse(readFileSync(join(CLIPS, "index.json"), "utf8"));
  const problems = validate(list, CLIPS);
  if (problems.length) {
    console.error(`[sync-clips] clips/ is inconsistent:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  report(list);
  process.exit(0);
}

if (!existsSync(join(SRC, "index.json"))) {
  console.error(`[sync-clips] no manifest at ${join(SRC, "index.json")}: make the clips in the app first (node tools/video/make.mjs all)`);
  process.exit(1);
}
const list = JSON.parse(readFileSync(join(SRC, "index.json"), "utf8"));
const problems = validate(list, SRC);
if (problems.length) {
  console.error(`[sync-clips] the app's manifest is inconsistent, nothing copied:\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(CLIPS, { recursive: true });
const keep = new Set(["index.json"]);
for (const c of list) {
  for (const f of [c.files.mp4, c.files.poster]) {
    copyFileSync(join(SRC, f), join(CLIPS, f));
    keep.add(f);
  }
}
for (const f of readdirSync(CLIPS)) if (!keep.has(f)) rmSync(join(CLIPS, f));
writeFileSync(join(CLIPS, "index.json"), JSON.stringify(list, null, 2) + "\n");
report(list);
