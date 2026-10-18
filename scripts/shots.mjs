// Full-page screenshots of the project page (desktop, phone, dark, English) into .cache/shots/, and a check that the
// gallery's videos load lazily and play when on screen. Uses puppeteer-core and the Chrome finder from the app repo.
//
//   node scripts/shots.mjs [--url http://127.0.0.1:8090/] [--app ../naiwa-motion-lab]
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PAGE = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
const APP = resolve(opt("app", process.env.NAIWA_APP ?? join(PAGE, "..", "naiwa-motion-lab")));
const BASE = opt("url", "http://127.0.0.1:8090/");
const OUT = join(PAGE, ".cache", "shots");
mkdirSync(OUT, { recursive: true });

const { default: puppeteer } = await import(pathToFileURL(join(APP, "node_modules", "puppeteer-core", "lib", "esm", "puppeteer", "puppeteer-core.js")).href);
const { chromePath, gpuArgs } = await import(pathToFileURL(join(APP, "tests", "tools", "chrome.mjs")).href);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const VARIANTS = [
  { name: "desktop-zh-light", w: 1440, h: 900, q: "?lang=zh&theme=light" },
  { name: "desktop-en-dark", w: 1440, h: 900, q: "?lang=en&theme=dark" },
  { name: "phone-zh-light", w: 390, h: 844, q: "?lang=zh&theme=light", mobile: true },
  { name: "phone-en-dark", w: 390, h: 844, q: "?lang=en&theme=dark", mobile: true },
];

const browser = await puppeteer.launch({ executablePath: chromePath(), headless: "new", args: ["--no-sandbox", ...gpuArgs(), "--autoplay-policy=no-user-gesture-required"] });
let failed = 0;
for (const v of VARIANTS) {
  const page = await browser.newPage();
  await page.setViewport({ width: v.w, height: v.h, deviceScaleFactor: v.mobile ? 2 : 1, isMobile: !!v.mobile, hasTouch: !!v.mobile });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("requestfailed", (r) => errors.push(`failed ${r.url()}`));
  page.on("response", (r) => r.status() >= 400 && !r.url().endsWith("/demo/help/clips.json") && errors.push(`${r.status()} ${r.url()}`));
  await page.goto(BASE + v.q, { waitUntil: "load" });
  await sleep(1500);
  const state = () => page.evaluate(() => [...document.querySelectorAll("video")].map((x) => ({ src: x.currentSrc.split("/").pop(), playing: !x.paused && x.readyState >= 2, ready: x.readyState })));
  const atTop = await state();
  // scroll to the first cards: their videos should start, the teaser should pause
  await page.evaluate(() => document.getElementById("play").scrollIntoView({ behavior: "instant" }));
  await sleep(2500);
  const atGallery = await state();
  const horizontal = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.evaluate(() => window.scrollTo(0, 0));
  await sleep(500);
  await page.screenshot({ path: join(OUT, `${v.name}.png`), fullPage: true });
  const heroTop = atTop[0]?.playing ?? null;
  const heroLater = atGallery[0]?.playing ?? null;
  const galleryPlaying = atGallery.slice(1).filter((x) => x.playing).length;
  const loadedOffscreen = atTop.slice(1).filter((x) => x.ready >= 1).length;
  console.log(`${v.name}: ${atTop.length} video(s); hero playing at top ${heroTop}, after scrolling ${heroLater}; gallery videos loaded before scrolling ${loadedOffscreen}, playing at the gallery ${galleryPlaying}; horizontal overflow ${horizontal}px; errors ${errors.length ? errors.join(" | ") : "none"}`);
  if (horizontal > 0 || errors.length) failed++;
  await page.close();
}
await browser.close();
process.exit(failed ? 1 : 0);
