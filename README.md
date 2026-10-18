# Naiwa Motion Lab · project page

[中文](#中文) · [English](#english)

## 中文

这是 [Naiwa Motion Lab](https://github.com/ZhiqiLi-CG/naiwa-motion-lab) 的项目主页：一个静态页面，加上展示视频片段，以及从代码仓库构建出来的在线体验（`/demo/`）。

单独放一个仓库，是为了让代码仓库克隆起来保持小巧：视频片段只提交在这里。

### 目录

| 路径 | 内容 | 是否提交 |
|---|---|---|
| `index.html`, `assets/` | 页面本身：首屏、玩法、更多片段、实验室、本地运行（中英切换、亮暗主题，不依赖框架） | 是 |
| `clips/` | 展示片段：`index.json` 加上每个片段的 `<id>.mp4`（H.264 720p）和 `<id>.jpg`（封面） | **是**（这个仓库就是为它们存在的） |
| `demo/` | 构建好的应用 | 否（本地或 CI 构建） |
| `vendor/coi-serviceworker/` | coi-serviceworker 0.1.7（MIT），给 demo 提供跨源隔离 | 是 |
| `scripts/` | 构建、同步、预览、检查脚本 | 是 |

### 更新视频片段

片段由代码仓库的 `tools/video/make.mjs` 生成，输出到 `<app>/.cache/videos/demo/web/`。

```bash
node scripts/sync-clips.mjs                 # 从 ../naiwa-motion-lab 复制；也可以加 --app <路径>
node scripts/sync-clips.mjs --check         # 只检查 clips/index.json 和文件是否一致，并打印总大小
git add clips && git commit -m "clips: ..."
```

同步会删除 `clips/` 里清单上已经没有的文件。页面按 id 把片段放进各个位置（`index.html` 里每个视频框的 `data-prefer`，例如首屏 `teaser,gouxiong,kemusan,…`，“戳一戳”是 `poke-slowmo,slap,throw,…`；清单里加 `"hero": true` 可以指定首屏），没被用到的片段进“更多片段”。没有片段时显示标明“待生成”的占位块。

### 本地构建和预览

需要先在代码仓库里装好依赖（`npm ci`）。

```bash
node scripts/build-demo.mjs                 # 构建 ../naiwa-motion-lab 到 demo/（或 --app <路径>，或环境变量 NAIWA_APP）
node scripts/serve.mjs                      # http://127.0.0.1:8090/ ，故意不发 COOP/COEP 头，和 GitHub Pages 一样
node scripts/check-demo.mjs                 # 无头 Chrome：demo 跨源隔离、GPU MPM（WebGPU 和关掉 WebGPU 的 CPU 并行）、MediaPipe 摄像头跟踪
node scripts/shots.mjs                      # 截图（桌面、手机、暗色、英文）到 .cache/shots/，并检查片段按可见性播放/暂停
```

`build-demo.mjs` 构建的是代码仓库**当前的工作区**。想要干净的构建，先给某个提交建一个 worktree，再用 `--app` 指过去。

构建时还会做三件事：

- 把 `coi-serviceworker.js` 放进 `demo/`，并在 `demo/index.html` 的最前面加载它。GitHub Pages 不能设置响应头，这个 service worker 给页面加上 COOP/COEP；首次打开时页面会自动刷新一次，之后就是 `crossOriginIsolated`。没有 GPU 时，GPU 模拟器的 CPU 并行后端需要 SharedArrayBuffer，所以必须这样。它的作用范围只限于 `demo/`。
- 如果代码仓库的 `public/help/` 里有教程片段，就生成 `demo/help/clips.json`，主页的“使用说明”会显示其中前 4 个。教程片段不在这里重复保存。
- 去掉只对其他托管平台有意义的 `_headers`、`vercel.json`。

### 部署

`.github/workflows/pages.yml` 在推送到 `main` 时运行，也可以手动运行（手动时可以指定代码仓库的分支、标签或提交）。步骤：

1. 检出本仓库和 `ZhiqiLi-CG/naiwa-motion-lab`；
2. Node 20，在代码仓库里 `npm ci`；
3. 构建 demo，检查已提交的 `clips/`；
4. 上传并部署到 GitHub Pages。

仓库设置：Settings → Pages → Source 选 “GitHub Actions”。

**代码仓库还是私有的时候**：在本仓库加一个 secret `APP_REPO_TOKEN`，值是对 `naiwa-motion-lab` 有 Contents 读权限的 fine-grained token。代码仓库公开以后就不需要了，工作流会自动改用默认 token。

### 协议

- 页面代码：Apache-2.0（`LICENSE`）。
- `vendor/coi-serviceworker`：MIT。
- **奶蛙角色不在协议之内**：`clips/` 里的片段和 `demo/` 里的模型表现的是奶蛙，这个形象来自第三方的知识产权，不授予任何权利。见 `NOTICE`。

## English

The project page of [Naiwa Motion Lab](https://github.com/ZhiqiLi-CG/naiwa-motion-lab): a static page, the showcase
video clips, and the live demo (`/demo/`) built from the code repository. It is a separate repository so that cloning
the code stays small: the clips are committed only here.

### Layout

| Path | What | Committed |
|---|---|---|
| `index.html`, `assets/` | the page (zh/en, light/dark, no framework) | yes |
| `clips/` | showcase clips: `index.json`, plus `<id>.mp4` (H.264 720p) and `<id>.jpg` (poster) for each clip | **yes** (the reason this repository exists) |
| `demo/` | the built app | no (built locally or in CI) |
| `vendor/coi-serviceworker/` | coi-serviceworker 0.1.7 (MIT): cross-origin isolation for the demo | yes |
| `scripts/` | build, sync, preview and check scripts | yes |

### Updating the clips

The app's `tools/video/make.mjs` renders them into `<app>/.cache/videos/demo/web/`.

```bash
node scripts/sync-clips.mjs                 # copy from ../naiwa-motion-lab (or --app <path>)
node scripts/sync-clips.mjs --check         # only check clips/index.json against the files; prints the total size
git add clips && git commit -m "clips: ..."
```

Syncing removes files the manifest no longer lists. The page places clips by id (each video box in `index.html` has a `data-prefer` list, e.g. the teaser `teaser,gouxiong,kemusan,…`, "Poke it" `poke-slowmo,slap,throw,…`; `"hero": true` in the manifest picks the teaser); clips no box takes go to "More clips". Missing clips show clearly marked placeholders.

### Building and previewing locally

Install the app's dependencies first (`npm ci` in the app repo).

```bash
node scripts/build-demo.mjs                 # build ../naiwa-motion-lab into demo/ (or --app <path>, or NAIWA_APP)
node scripts/serve.mjs                      # http://127.0.0.1:8090/, deliberately without COOP/COEP, like GitHub Pages
node scripts/check-demo.mjs                 # headless Chrome: demo isolated, GPU MPM (WebGPU, and CPU-parallel with WebGPU off), MediaPipe camera tracking
node scripts/shots.mjs                      # screenshots (desktop, phone, dark, English) in .cache/shots/; clips play/pause by visibility
```

`build-demo.mjs` builds the app's **working tree**. For a clean build, make a worktree of a commit and pass it with `--app`.

The build also does three things:

- It copies `coi-serviceworker.js` into `demo/` and loads it first in `demo/index.html`. GitHub Pages cannot set headers, so the service worker adds COOP/COEP; on the first visit the page reloads once and is then `crossOriginIsolated`. The GPU simulator's CPU-parallel backend needs SharedArrayBuffer on machines without a GPU, which is why this is required. Its scope is `demo/` only.
- If the app ships tutorial clips in `public/help/`, it writes `demo/help/clips.json`, and the page's "How to use" section shows the first four. The clips are not duplicated in this repository.
- It drops `_headers` and `vercel.json`, which only matter to other hosts.

### Deployment

`.github/workflows/pages.yml` runs on every push to `main`, or by hand (a manual run can pick the app's branch, tag or commit). Steps:

1. Check out this repo and `ZhiqiLi-CG/naiwa-motion-lab`.
2. Set up Node 20 and run `npm ci` in the app.
3. Build the demo and check the committed `clips/`.
4. Upload and deploy to GitHub Pages.

Repository setting: Settings → Pages → Source: "GitHub Actions".

**While the app repository is private**, add a repository secret `APP_REPO_TOKEN`: a fine-grained token with read access to the contents of `naiwa-motion-lab`. Once that repository is public, the secret is no longer needed; the workflow falls back to the default token.

### License

- The page's code: Apache-2.0 (`LICENSE`).
- `vendor/coi-serviceworker`: MIT.
- **The 奶蛙 character is not licensed.** The clips in `clips/` and the model in `demo/` depict 奶蛙, a character that derives from a third party's intellectual property; no rights to it are granted. See `NOTICE`.
