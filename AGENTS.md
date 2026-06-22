# My-Discs AI Project Guide

本文件面向后续 AI / Coding Agent。进入仓库后优先读这里，再读 `README.md`。

## 项目定位

这是一个个人音乐记录静态站，公开页为 `web/index.html`，根目录 `index.html` 只负责跳转。站点展示两类内容：

- CD 收藏：来源数据在 `CDs/<专辑名>/disc.yml`，封面在同目录 `cover.{jpg,jpeg,png,webp}`。
- 音乐会记录：来源数据在 `concerts/<日期>/concert.yml`，封面通常为同目录 `cover.jpg`。

生成脚本 `web/generate_data.py` 会把以上数据和 `web/music/` 中的本地音频文件汇总成 `web/data.js`。前端只读取 `web/data.js`、`web/wishlist/wishlist-data.js` 和静态资源。

## 目录地图

| 路径 | 作用 |
| --- | --- |
| `README.md` | 面向人的简短添加说明与线上链接 |
| `AGENTS.md` | 面向 AI 的项目上下文与协作约定 |
| `index.html` | GitHub Pages 根入口，自动跳到 `web/index.html` |
| `CDs/<专辑名>/` | CD 条目目录，包含 `disc.yml` 和封面图 |
| `concerts/<YYYY-MM-DD>/` | 音乐会条目目录，包含 `concert.yml` 和封面图 |
| `web/index.html` | 主站页面 |
| `web/style.css` | 主站与 wishlist 共用样式 |
| `web/script.js` | 主站交互：画廊、筛选、弹窗、音乐播放器 |
| `web/generate_data.py` | 数据生成器，无第三方依赖 |
| `web/data.js` | 生成产物，提交前必须与数据源同步 |
| `web/music/` | 本地播放器音频目录；`.gitignore` 默认忽略新增音频，只保留 `.gitkeep` |
| `web/wishlist/` | Wishlist 独立页面，数据手写在 `wishlist-data.js` |
| `.github/workflows/verify-data.yml` | CI：重新生成 `web/data.js` 并检查 drift |

## 数据生成流程

改动 `CDs/`、`concerts/` 或准备发布的 `web/music/` 音频后，在仓库根目录运行：

```bash
python3 web/generate_data.py
```

这个命令会重写 `web/data.js`，其中包含：

- `const siteData = [...]`：CD 与音乐会条目。
- `const musicData = [...]`：`web/music/` 中扩展名为 `.mp3/.flac/.wav/.ogg/.m4a` 的音频。

CI 会执行同一个命令，然后运行：

```bash
git diff --exit-code web/data.js
```

所以提交数据源时通常也要提交重新生成后的 `web/data.js`。不要手工编辑 `web/data.js`，除非是在调试生成器输出。

注意：`.gitignore` 默认忽略 `web/music/*`，但生成器仍会读取本地存在的音频。如果本地放了不准备发布的音频，运行生成器前先移出该目录；否则 `web/data.js` 可能引用线上不存在的文件。

## YAML 子集限制

`web/generate_data.py` 没有使用 PyYAML，而是内置了一个很小的 YAML 子集解析器。请只使用这些形式：

```yaml
key: "value"
key:
  - "list item"
notes: |
  多行文本，可以写 Markdown。
```

注意事项：

- 支持顶层 `key: value`、顶层列表、顶层 `|` 多行文本。
- 不支持嵌套对象、复杂数组、锚点、日期类型推断等完整 YAML 功能。
- 字符串里有冒号、引号或特殊符号时，优先加双引号。
- 多行文本内容缩进两个空格即可。
- 生成器会忽略缺少 `disc.yml/concert.yml` 或缺少封面的条目。

## CD 条目格式

目录形态：

```text
CDs/专辑名/
  cover.jpg
  disc.yml
```

常用字段：

```yaml
title: "Kapustin Piano Works 2"
tracks:
  - "Ten Bagatelles Op. 59"
artists:
  - "Masahiro Kawakami-川上 昌裕"
vocalists:
  - "可选：歌手"
original_artists:
  - "可选：原唱"
composers:
  - "Kapustin"
producers:
  - "可选：制作人"
genres:
  - "classic"
  - "jazz"
count: "1"
source: "Tower Records 涩谷 东京"
tags:
  - "可选标签"
notes: |
  可选备注。支持 Markdown。
```

前端筛选主要来自 `genres`。`genres` 会按逗号、斜杠、括号拆分后做标题化展示，因此尽量保持简短、稳定，例如 `classic`、`jazz`、`rock`、`game ost`。

## 音乐会条目格式

目录形态：

```text
concerts/2026-05-29/
  cover.jpg
  concert.yml
```

同一天多场可用 `YYYY-MM-DD-2` 作为目录名，但 `concert.yml` 里的 `date` 仍应写真实日期。

常用字段：

```yaml
title: "\"俄乐史诗\"——尼尔森斯与莱比锡布商大厦管弦乐团音乐会"
date: "2026-05-29"
venue: "国家大剧院"
hall: "音乐厅"
performers:
  - "Andris Nelsons"
program:
  - "Rachmaninoff: Piano Concerto No. 2 in C minor, Op. 18"
encores:
  - "可选：返场曲"
notes: |
  可选备注。支持 Markdown。
image: "cover.jpg"
```

音乐会在 `web/data.js` 中按 `date` 字符串倒序排列。保持 `YYYY-MM-DD` 格式，排序才稳定。

## 前端行为

- 主页面用 CDN 加载 `marked` 和 `DOMPurify`，把生成器拼出的 Markdown 描述渲染到弹窗里。
- CD 卡片每次页面加载会随机打乱；音乐会保持按日期倒序。
- 弹窗有基本的键盘可访问性：`Enter/Space` 打开，`Escape` 关闭，`Tab` 限制在弹窗内。
- 音乐播放器随机选择 `musicData` 中一首曲目；若没有音乐数据会隐藏播放器。
- `web/wishlist/` 是独立页面，不走 `generate_data.py`，直接改 `wishlist-data.js`。

## 本地查看与验证

最小验证：

```bash
python3 web/generate_data.py
git diff -- web/data.js
```

浏览器预览可在仓库根目录启动静态服务：

```bash
python3 -m http.server 8000
```

然后打开：

```text
http://localhost:8000/web/index.html
http://localhost:8000/web/wishlist/index.html
```

因为页面依赖 CDN，离线环境下 Markdown 渲染库可能无法加载；数据生成本身不需要网络。

## 协作约定

- 用户主要使用中文；回复和文档改动优先使用中文，代码标识符保持英文。
- 数据改动要尽量小，不要重命名已有目录或图片，除非用户明确要求。
- 不要引入前端构建系统或包管理器；当前项目是无构建静态站。
- 不要为了完整 YAML 功能随意加依赖。只有当需求确实超出现有格式时，再考虑改生成器。
- 修改 `web/style.css` 或 `web/script.js` 后，留意 `web/index.html` 和 `web/wishlist/index.html` 中的缓存参数是否需要更新。
- 新增图片优先使用 `cover.jpg`，已有条目保持原扩展名即可。
- 遇到 `.DS_Store` 等本地系统文件，不要把它们作为项目逻辑处理。
