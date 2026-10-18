// Build the app (Naiwa Motion Lab) into demo/ of this page, ready for a static host without COOP/COEP headers.
//
//   node scripts/build-demo.mjs [--app <path to the app repo>]      (default: ../naiwa-motion-lab, or $NAIWA_APP)
//
// 1. Vite builds the app with base "./" straight into demo/ (Vite's API from the app's own node_modules, so the app's
//    vite.config.ts applies; Vite's cache goes to .cache/vite here, nothing is written into the app's node_modules).
// 2. coi-serviceworker (vendor/coi-serviceworker, MIT) is copied next to it and loaded first in demo/index.html: GitHub
//    Pages cannot send COOP/COEP, the service worker adds them, so the page is crossOriginIsolated and the GPU
//    simulator's CPU-parallel fallback gets SharedArrayBuffer. Its scope is demo/ only.
// 3. demo/help/clips.json lists the tutorial clips the app ships in public/help/ (if any), for the page's "how to use".
import { cpSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const at = argv.indexOf("--app");
const APP = resolve(at >= 0 ? argv[at + 1] : process.env.NAIWA_APP ?? join(PAGE, "..", "naiwa-motion-lab"));
const OUT = join(PAGE, "demo");

const vitePkg = join(APP, "node_modules", "vite", "package.json");
if (!existsSync(join(APP, "package.json")) || !existsSync(vitePkg)) {
  console.error(`[build-demo] no app with installed dependencies at ${APP} (run npm ci there, or pass --app <path>)`);
  process.exit(1);
}
const viteEntry = join(APP, "node_modules", "vite", JSON.parse(readFileSync(vitePkg, "utf8")).exports["."].import.default);
const { build } = await import(pathToFileURL(viteEntry).href);

console.log(`[build-demo] building ${APP} -> ${OUT}`);
rmSync(OUT, { recursive: true, force: true });
await build({
  root: APP,
  configFile: join(APP, "vite.config.ts"),
  base: "./",
  cacheDir: join(PAGE, ".cache", "vite"),
  logLevel: "warn",
  build: { outDir: OUT, emptyOutDir: true },
});

// Headers files of other hosts mean nothing on GitHub Pages.
for (const f of ["_headers", "vercel.json"]) rmSync(join(OUT, f), { force: true });

const COI = join(PAGE, "vendor", "coi-serviceworker", "coi-serviceworker.js");
cpSync(COI, join(OUT, "coi-serviceworker.js"));
const indexPath = join(OUT, "index.html");
const html = readFileSync(indexPath, "utf8");
const tag = `<script src="./coi-serviceworker.js"></script>`;
if (!html.includes(tag)) {
  // A classic script, before any module: it registers the worker and reloads once so the page comes back isolated.
  const charset = html.match(/<meta charset[^>]*>/i);
  if (!charset) throw new Error("demo/index.html has no <meta charset>: cannot place the coi-serviceworker tag");
  writeFileSync(indexPath, html.replace(charset[0], `${charset[0]}\n    ${tag}`));
}

const help = join(OUT, "help");
const clips = existsSync(help)
  ? readdirSync(help)
      .filter((f) => /\.mp4$/i.test(f))
      .map((f) => f.slice(0, -4))
      .sort()
      .map((id) => ({
        id,
        mp4: `${id}.mp4`,
        poster: ["jpg", "png", "webp"].map((x) => `${id}.${x}`).find((f) => existsSync(join(help, f))) ?? null,
      }))
  : [];
if (clips.length) writeFileSync(join(help, "clips.json"), JSON.stringify(clips, null, 2) + "\n");

console.log(`[build-demo] done: demo/ with coi-serviceworker; ${clips.length} tutorial clip(s) in demo/help/`);
