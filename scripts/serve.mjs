// A plain static server for previewing this page as GitHub Pages serves it: no COOP/COEP headers (the demo must get
// its cross-origin isolation from coi-serviceworker), byte ranges for video.
//
//   node scripts/serve.mjs [--port 8090] [--host 127.0.0.1]
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const argv = process.argv.slice(2);
const opt = (name, dflt) => (argv.includes(`--${name}`) ? argv[argv.indexOf(`--${name}`) + 1] : dflt);
const PORT = Number(opt("port", "8090"));
const HOST = opt("host", "127.0.0.1");

const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".mjs": "text/javascript", ".css": "text/css",
  ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp",
  ".ico": "image/x-icon", ".webmanifest": "application/manifest+json", ".wasm": "application/wasm",
  ".mp4": "video/mp4", ".webm": "video/webm", ".glb": "model/gltf-binary", ".task": "application/octet-stream",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8",
};

createServer((req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = normalize(join(ROOT, path));
  if (file !== ROOT && !file.startsWith(ROOT + sep)) return void res.writeHead(403).end();
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!path.endsWith("/")) return void res.writeHead(301, { Location: `${path}/` }).end();
    file = join(file, "index.html");
  }
  if (!existsSync(file) || !statSync(file).isFile()) return void res.writeHead(404, { "Content-Type": "text/plain" }).end("not found");
  const size = statSync(file).size;
  const headers = { "Content-Type": TYPES[extname(file).toLowerCase()] ?? "application/octet-stream", "Accept-Ranges": "bytes", "Cache-Control": "no-cache" };
  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range ?? "");
  if (range && (range[1] || range[2])) {
    const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]));
    const end = range[1] && range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) return void res.writeHead(416, { "Content-Range": `bytes */${size}` }).end();
    res.writeHead(206, { ...headers, "Content-Range": `bytes ${start}-${end}/${size}`, "Content-Length": end - start + 1 });
    return void (req.method === "HEAD" ? res.end() : createReadStream(file, { start, end }).pipe(res));
  }
  res.writeHead(200, { ...headers, "Content-Length": size });
  if (req.method === "HEAD") res.end();
  else createReadStream(file).pipe(res);
}).listen(PORT, HOST, () => console.log(`[serve] http://${HOST}:${PORT}/ (no COOP/COEP headers) from ${ROOT}`));
