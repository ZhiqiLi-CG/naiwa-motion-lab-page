// Check the built demo the way GitHub Pages will serve it: a static server without COOP/COEP (scripts/serve.mjs).
//
//   node scripts/check-demo.mjs [--app ../naiwa-motion-lab] [--url http://127.0.0.1:8090/demo/]
//
// In headless Chrome (puppeteer-core and the Chrome finder from the app repo), twice: with WebGPU, and with WebGPU
// turned off (a machine without a usable GPU). Each run: the page reloads once under coi-serviceworker and comes back
// crossOriginIsolated with SharedArrayBuffer; the GPU simulator (gpu-mpm) reports its backend (WebGPU, else CPU
// parallel) and steps finitely; the camera (Chrome's fake webcam playing the app's CC BY test clip, if cached) goes
// through MediaPipe to "tracking". Exit code 1 if anything fails. Screenshots go to .cache/shots/.
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
const APP = resolve(opt("app", process.env.NAIWA_APP ?? join(PAGE, "..", "naiwa-motion-lab")));
const URL_ = opt("url", "http://127.0.0.1:8090/demo/");
const SHOTS = join(PAGE, ".cache", "shots");
mkdirSync(SHOTS, { recursive: true });

const { default: puppeteer } = await import(pathToFileURL(join(APP, "node_modules", "puppeteer-core", "lib", "esm", "puppeteer", "puppeteer-core.js")).href);
const { chromePath, gpuArgs } = await import(pathToFileURL(join(APP, "tests", "tools", "chrome.mjs")).href);
const y4m = join(APP, ".cache", "e2e", "dance-naenae.y4m");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let failed = 0;
const check = (name, ok, detail) => {
  if (!ok) failed++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}: ${detail}`);
};

async function run(label, webgpu) {
  const args = ["--no-sandbox", "--autoplay-policy=no-user-gesture-required", "--mute-audio", "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream", "--window-size=1280,800"];
  if (existsSync(y4m)) args.push(`--use-file-for-fake-video-capture=${y4m}`);
  args.push(...(webgpu ? gpuArgs() : [...gpuArgs().filter((a) => a !== "--enable-unsafe-webgpu"), "--disable-features=WebGPU,WebGPUService", "--disable-blink-features=WebGPU"]));
  const browser = await puppeteer.launch({ executablePath: chromePath(), headless: "new", args });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(`request failed ${r.url()} ${r.failure()?.errorText}`));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  try {
    await page.goto(URL_, { waitUntil: "load", timeout: 60000 });
    // coi-serviceworker registers, then reloads the page once; wait for the app on the isolated page.
    await page.waitForFunction(() => window.crossOriginIsolated && window.__naiwa?.store, { timeout: 60000 }).catch(() => {});
    const iso = await page.evaluate(() => ({ coi: window.crossOriginIsolated, sab: typeof SharedArrayBuffer, sw: !!navigator.serviceWorker?.controller, gpu: "gpu" in navigator }));
    check(`${label}: cross-origin isolated`, iso.coi === true && iso.sab === "function" && iso.sw, `crossOriginIsolated ${iso.coi}, SharedArrayBuffer ${iso.sab}, controlled by the service worker ${iso.sw}, navigator.gpu ${iso.gpu}`);

    await sleep(3000);
    const mpm = await page.evaluate(() => {
      const info = window.__naiwa.store.get().simulators.find((s) => s.id === "gpu-mpm");
      const t = (x) => (x == null ? null : typeof x === "string" ? x : x.en);
      return info ? { backend: t(info.backend), unavailable: t(info.unavailable) } : null;
    });
    const want = webgpu ? /webgpu/i : /cpu/i;
    check(`${label}: gpu-mpm backend`, !!mpm && !mpm.unavailable && want.test(mpm.backend ?? ""), mpm ? `backend "${mpm.backend}", unavailable ${mpm.unavailable}` : "gpu-mpm not registered");
    await page.evaluate(() => window.__naiwa.store.set({ simulator: { id: "gpu-mpm", settings: {} } }));
    await sleep(6000);
    const st = await page.evaluate(() => window.__naiwa.store.get().stats);
    check(`${label}: gpu-mpm steps`, Number.isFinite(st.stepMs) && st.stepMs > 0 && st.particles > 0, `${st.stepMs} ms/step, ${st.particles} particles, ${st.fps} fps, volume ${st.volumeRatio}`);
    await page.screenshot({ path: join(SHOTS, `demo-${label}-mpm.png`) });

    await page.evaluate(() => window.__naiwa.store.set({ simulator: { id: "cpu-constraints", settings: {} } }));
    await page.evaluate(() => window.__naiwa.commands.startCamera?.());
    const t0 = Date.now();
    let m = null;
    while (Date.now() - t0 < 60000) {
      m = await page.evaluate(() => window.__naiwa.store.get().motion);
      if (m.state === "tracking" || m.state === "error") break;
      await sleep(500);
    }
    check(`${label}: MediaPipe camera tracking`, m?.state === "tracking", `motion state "${m?.state}"${m?.message ? ` (${JSON.stringify(m.message)})` : ""} after ${((Date.now() - t0) / 1000).toFixed(1)} s${existsSync(y4m) ? "" : " (no cached test clip: Chrome's default fake camera has no person)"}`);
    await sleep(2000);
    await page.screenshot({ path: join(SHOTS, `demo-${label}-camera.png`) });
    check(`${label}: no page errors`, errors.length === 0, errors.length ? errors.slice(0, 5).join(" | ") : "none");
  } finally {
    await browser.close();
  }
}

await run("webgpu", true);
await run("no-webgpu", false);
console.log(failed ? `${failed} check(s) failed` : "all checks passed");
process.exit(failed ? 1 : 0);
