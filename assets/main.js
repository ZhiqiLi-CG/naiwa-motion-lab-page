// Language and theme toggles; the hero and gallery from clips/index.json; tutorial clips from demo/help/clips.json.
// Videos load lazily and play only while on screen.
(() => {
  const root = document.documentElement;
  const store = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: not remembered */ } };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.getElementById("lang-btn").addEventListener("click", () => {
    const lang = root.dataset.lang === "en" ? "zh" : "en";
    root.dataset.lang = lang;
    root.lang = lang === "en" ? "en" : "zh-CN";
    store("nml-lang", lang);
  });
  document.getElementById("theme-btn").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    store("nml-theme", root.dataset.theme);
  });

  /** Both languages as sibling spans; CSS shows one. */
  const bilingual = (el, text) => {
    el.replaceChildren();
    if (!text) return;
    if (typeof text === "string") { el.textContent = text; return; }
    for (const [lang, key] of [["zh-CN", "zh"], ["en", "en"]]) {
      const s = document.createElement("span");
      s.lang = lang;
      s.textContent = text[key] ?? text.en ?? text.zh ?? "";
      el.append(s);
    }
  };

  // Play what is on screen, pause what is not; the first time a video is seen its file starts loading.
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload === "none") v.preload = "auto";
        if (!reduced) v.play().catch(() => {});
      } else v.pause();
    }
  }, { threshold: 0.35 });

  function video(src, poster, { eager = false } = {}) {
    const v = document.createElement("video");
    v.muted = true; v.loop = true; v.playsInline = true;
    v.setAttribute("muted", ""); v.setAttribute("playsinline", "");
    v.preload = eager ? "auto" : "none";
    if (poster) v.poster = poster;
    if (reduced) v.controls = true;
    const s = document.createElement("source");
    s.src = src; s.type = "video/mp4";
    v.append(s);
    seen.observe(v);
    return v;
  }

  function clipFigure(c, base) {
    const fig = document.getElementById("clip-tpl").content.firstElementChild.cloneNode(true);
    fig.querySelector("video").replaceWith(video(base + c.files.mp4, c.files.poster ? base + c.files.poster : null));
    bilingual(fig.querySelector(".t"), c.title);
    bilingual(fig.querySelector(".c"), c.caption);
    bilingual(fig.querySelector(".credit"), c.credit);
    if (c.duration) fig.querySelector("video").title = `${c.duration.toFixed(1)} s`;
    return fig;
  }

  function placeholders(grid, n) {
    for (let i = 0; i < n; i++) {
      const fig = document.createElement("figure");
      fig.className = "clip placeholder-clip";
      fig.innerHTML = `<div class="frame"><div class="placeholder"><span lang="zh-CN">示例片段待生成</span><span lang="en">Clip pending</span></div></div>
        <figcaption><b><span lang="zh-CN">占位</span><span lang="en">Placeholder</span></b> <span lang="zh-CN">运行 scripts/sync-clips.mjs 后这里显示真实片段。</span><span lang="en">Real clips appear here after scripts/sync-clips.mjs.</span></figcaption>`;
      grid.append(fig);
    }
  }

  const HERO_PREFERENCE = ["person-vs-frog", "materials", "poke-slowmo"];

  fetch("clips/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const clips = Array.isArray(list) ? list.filter((c) => c?.files?.mp4) : [];
      const grid = document.getElementById("gallery-grid");
      if (!clips.length) return placeholders(grid, 6);
      const hero = clips.find((c) => c.hero) ?? HERO_PREFERENCE.map((id) => clips.find((c) => c.id === id)).find(Boolean) ?? clips[0];
      const heroFig = document.getElementById("hero");
      const hv = video("clips/" + hero.files.mp4, hero.files.poster ? "clips/" + hero.files.poster : null, { eager: true });
      hv.autoplay = !reduced;
      const cap = document.createElement("figcaption");
      bilingual(cap, hero.caption);
      if (hero.credit) { const s = document.createElement("small"); s.textContent = ` · ${hero.credit}`; cap.append(s); }
      heroFig.replaceChildren(hv, cap);
      for (const c of clips) if (c !== hero) grid.append(clipFigure(c, "clips/"));
      if (clips.length === 1) placeholders(grid, 1);
    });

  // Tutorial clips ship with the app (public/help/); the demo build lists them.
  fetch("demo/help/clips.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const grid = document.getElementById("help-grid");
      const clips = (Array.isArray(list) ? list : []).filter((c) => c.mp4).slice(0, 4);
      for (const c of clips) {
        const fig = document.createElement("figure");
        fig.className = "clip";
        const frame = document.createElement("div");
        frame.className = "frame";
        frame.append(video("demo/help/" + c.mp4, c.poster ? "demo/help/" + c.poster : null));
        fig.append(frame);
        grid.append(fig);
      }
      grid.hidden = clips.length === 0;
    });
})();
