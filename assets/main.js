// Language and theme toggles, install tabs, and the clips: every [data-slot] box takes a clip from clips/index.json by
// its preferred ids (data-prefer, first unused wins); clips no slot took go to "More clips". Tutorial clips come from
// demo/help/clips.json. Videos load lazily and play only while on screen.
(() => {
  const root = document.documentElement;
  const remember = (k, v) => { try { localStorage.setItem(k, v); } catch { /* private mode: not remembered */ } };
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

  document.getElementById("lang-btn").addEventListener("click", () => {
    const lang = root.dataset.lang === "en" ? "zh" : "en";
    root.dataset.lang = lang;
    root.lang = lang === "en" ? "en" : "zh-CN";
    remember("nml-lang", lang);
  });
  document.getElementById("theme-btn").addEventListener("click", () => {
    const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    root.dataset.theme = dark ? "light" : "dark";
    remember("nml-theme", root.dataset.theme);
  });

  // Install tabs; Linux/macOS first for visitors not on Windows.
  const tabs = [...document.querySelectorAll('[role="tab"]')];
  const select = (tab) => {
    for (const t of tabs) {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
      document.getElementById(t.getAttribute("aria-controls")).hidden = !on;
    }
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => select(t));
    t.addEventListener("keydown", (e) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (d) { const n = tabs[(i + d + tabs.length) % tabs.length]; select(n); n.focus(); }
    });
  });
  if (!/win/i.test(navigator.userAgentData?.platform ?? navigator.platform ?? "")) select(document.getElementById("tab-nix"));

  /** Both languages as sibling spans; CSS shows one. */
  const bilingual = (el, text) => {
    if (!text) return el;
    if (typeof text === "string") { el.textContent = text; return el; }
    for (const [lang, key] of [["zh-CN", "zh"], ["en", "en"]]) {
      const s = document.createElement("span");
      s.lang = lang;
      s.textContent = text[key] ?? text.en ?? text.zh ?? "";
      el.append(s);
    }
    return el;
  };

  // Play what is on screen, pause what is not; a video's file starts loading the first time it comes near.
  const seen = new IntersectionObserver((entries) => {
    for (const e of entries) {
      const v = e.target;
      if (e.isIntersecting) {
        if (v.preload === "none") v.preload = "auto";
        if (!reduced) v.play().catch(() => {});
      } else v.pause();
    }
  }, { threshold: 0.3 });

  function video(src, poster, eager) {
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

  function fill(box, clip, base, eager) {
    box.replaceChildren(video(base + clip.files.mp4, clip.files.poster ? base + clip.files.poster : null, eager));
    if (clip.credit) box.append(bilingual(Object.assign(document.createElement("small"), { className: "credit" }), clip.credit));
  }

  function placeholder(box) {
    const p = document.createElement("div");
    p.className = "placeholder";
    p.innerHTML = '<span lang="zh-CN">视频待生成</span><span lang="en">Clip pending</span>';
    box.replaceChildren(p);
  }

  fetch("clips/index.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const clips = Array.isArray(list) ? list.filter((c) => c?.id && c.files?.mp4) : [];
      const byId = new Map(clips.map((c) => [c.id, c]));
      const used = new Set();
      let hero = null;
      for (const box of document.querySelectorAll("[data-slot]")) {
        const prefer = box.dataset.prefer.split(",");
        const flagged = box.dataset.slot === "hero" ? clips.find((c) => c.hero) : null;
        // first unused preferred clip; else a preferred one again (never the teaser); else a placeholder
        const clip = flagged ?? prefer.map((id) => byId.get(id)).find((c) => c && !used.has(c.id))
          ?? prefer.map((id) => byId.get(id)).find((c) => c && c !== hero)
          ?? (box.dataset.slot === "hero" ? clips[0] : null);
        if (!clip) { placeholder(box); continue; }
        if (box.dataset.slot === "hero") hero = clip;
        used.add(clip.id);
        fill(box, clip, "clips/", box.dataset.slot === "hero");
      }
      const rest = clips.filter((c) => !used.has(c.id));
      const grid = document.getElementById("gallery-grid");
      for (const c of rest) {
        const fig = document.createElement("figure");
        const box = document.createElement("div");
        box.className = "media";
        fill(box, c, "clips/", false);
        const cap = document.createElement("figcaption");
        cap.append(bilingual(document.createElement("b"), c.title), bilingual(document.createElement("span"), c.caption));
        fig.append(box, cap);
        grid.append(fig);
      }
      document.getElementById("more").hidden = rest.length === 0;
    });

  // Tutorial clips ship with the app (public/help/); scripts/build-demo.mjs lists them.
  fetch("demo/help/clips.json", { cache: "no-cache" })
    .then((r) => (r.ok ? r.json() : []))
    .catch(() => [])
    .then((list) => {
      const clips = (Array.isArray(list) ? list : []).filter((c) => c.mp4).slice(0, 4);
      const grid = document.getElementById("help-grid");
      for (const c of clips) {
        const box = document.createElement("div");
        box.className = "media";
        box.append(video("demo/help/" + c.mp4, c.poster ? "demo/help/" + c.poster : null, false));
        grid.append(box);
      }
      document.getElementById("help").hidden = clips.length === 0;
    });
})();
