# My-Discs AI Project Guide

本文件面向后续 AI / Coding Agent。进入仓库后优先读这里，再读 `README.md`。

## 项目定位

这是一个个人音乐记录静态站，公开页为 `web/index.html`，根目录 `index.html` 只负责跳转。站点展示三类内容：

- CD 收藏：来源数据在 `CDs/<专辑名>/disc.yml`，封面在同目录 `cover.{jpg,jpeg,png,webp}`。
- 黑胶收藏：来源数据在 `Vinyls/<专辑名>/disc.yml`，封面在同目录 `cover.{jpg,jpeg,png,webp}`。
- 音乐会记录：来源数据在 `concerts/<日期>/concert.yml`，封面通常为同目录 `cover.jpg`。

生成脚本 `web/generate_data.py` 会把以上数据汇总成 `web/data.js`。前端只读取 `web/data.js` 和静态资源。

## 目录地图

| 路径 | 作用 |
| --- | --- |
| `README.md` | 面向人的简短添加说明与线上链接 |
| `AGENTS.md` | 面向 AI 的项目上下文与协作约定 |
| `index.html` | GitHub Pages 根入口，自动跳到 `web/index.html` |
| `CDs/<专辑名>/` | CD 条目目录，包含 `disc.yml` 和封面图 |
| `Vinyls/<专辑名>/` | 黑胶条目目录，包含 `disc.yml` 和封面图 |
| `concerts/<YYYY-MM-DD>/` | 音乐会条目目录，包含 `concert.yml` 和封面图 |
| `web/index.html` | 主站页面 |
| `web/style.css` | 主站样式 |
| `web/script.js` | 主站交互：画廊、筛选、弹窗 |
| `web/generate_data.py` | 数据生成器，无第三方依赖 |
| `web/data.js` | 生成产物，提交前必须与数据源同步 |
| `tools/admin_server.py` | 本地录入表单工具，不接入公开网站 |
| `.github/workflows/verify-data.yml` | CI：重新生成 `web/data.js` 并检查 drift |

## 数据生成流程

改动 `CDs/`、`Vinyls/` 或 `concerts/` 后，在仓库根目录运行：

```bash
python3 web/generate_data.py
```

这个命令会重写 `web/data.js`，其中包含 `const siteData = [...]`：CD、黑胶与音乐会条目。

CI 会执行同一个命令，然后运行：

```bash
git diff --exit-code web/data.js
```

所以提交数据源时通常也要提交重新生成后的 `web/data.js`。不要手工编辑 `web/data.js`，除非是在调试生成器输出。

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

## CD / 黑胶条目格式

目录形态：

```text
CDs/专辑名/
  cover.jpg
  disc.yml

Vinyls/专辑名/
  cover.jpg
  disc.yml
```

常用字段：

```yaml
title: "Kapustin Piano Works 2"
tracks:
  - "Ten Bagatelles, Op. 59 - Kapustin"
artists:
  - "Masahiro Kawakami (川上 昌裕, piano)"
composers:
  - "Kapustin"
genres:
  - "classic"
  - "jazz"
count: "1"
source: "Tower Records 涩谷 东京"
notes: |
  可选备注。支持 Markdown。
```

CD 与黑胶共用同一套字段。前端筛选主要来自 `genres`。`genres` 会按逗号、斜杠、括号拆分后做标题化展示，因此尽量保持简短、稳定，例如 `classic`、`jazz`、`rock`、`game ost`。

历史条目中可能还存在 `vocalists`、`original_artists`、`producers` 等字段；生成器仍会把它们拼入弹窗描述。新增条目默认不要再使用这些字段，除非明确需要保留特殊信息。

## 字段书写规范

人名与团体名：

- 中国/华人音乐家用中文优先；英文名很常见时写在括号里，例如 `刘晓禹 (Bruce Liu)`、`阿布 (A Bu)`。
- 外国人名只写常用原文名，不附中文译名，例如 `Martha Argerich`、`Renaud Capuçon`。
- 日韩等非拉丁文字姓名，罗马字在前，原文可写在括号里，例如 `Masahiro Kawakami (川上 昌裕)`。
- 外国乐团/团体只写官方英文或原文，不附中文译名，例如 `Berliner Philharmoniker`、`Vienna Philharmonic Orchestra`。
- 中国团体直接写中文名，例如 `中国爱乐乐团`、`北京交响乐团`。
- CD / 黑胶的 `artists` 可保留乐器/身份，格式为英文小写括号，例如 `Martha Argerich (piano)`、`Frank Strobel (conductor)`；音乐会 `performers` 通常不写身份。

作曲家与曲目：

- `composers` 一人一行，不要把多位作曲家写成一个逗号分隔字符串。
- 古典曲目统一用作品在前、作者在后的格式：

```text
Title No. n in Key, Op. x "Nickname": Movement (optional note) - Composer
```

示例：

```text
Piano Concerto No. 2 in C minor, Op. 18 - Rachmaninoff
Symphony No. 9 in D minor, Op. 125 "Choral" - Beethoven
Violin Sonata No. 9 in A major, Op. 47 "Kreutzer": I. Adagio sostenuto - Beethoven
Violin Concerto No. 3 in G major, K. 216 (with Renaud Capuçon) - Mozart
```

- `No.`、`Op.`、`K.`、`BWV` 等目录号保留标准缩写和空格；没有目录号时不要硬填。
- 别名用英文直引号，例如 `"Kreutzer"`；乐章用冒号接在作品后。
- 中文作品中文优先，可附英文，例如 `Piano Sonata No. 1 "Pinus" - 阿布` 或 `雪花 - 张帅`。
- 流行、电子、个人精选等不适合作品号体系的曲目，可退化为 `Title - Artist/Composer`；作者不确定时不要强行补。
- 中场休息固定写作 `*—INTERMISSION—*`。

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
  - "Piano Concerto No. 2 in C minor, Op. 18 (with Yulianna Avdeeva) - Rachmaninoff"
  - "*—INTERMISSION—*"
  - "Symphony No. 10 in E minor, Op. 93 - Shostakovich"
image: "cover.jpg"
```

音乐会在 `web/data.js` 中按 `date` 字符串倒序排列。保持 `YYYY-MM-DD` 格式，排序才稳定。

## 前端行为

- 主页面用 CDN 加载 `marked` 和 `DOMPurify`，把生成器拼出的 Markdown 描述渲染到弹窗里。
- CD 与黑胶卡片每次页面加载会随机打乱；音乐会保持按日期倒序。
- 弹窗有基本的键盘可访问性：`Enter/Space` 打开，`Escape` 关闭，`Tab` 限制在弹窗内。
- `tools/admin_server.py` 是本地维护工具，只负责方便录入数据；不要在公开网站中链接或展示它。录入工具里的结构化曲目生成器应与上面的曲目格式保持一致。

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
```

因为页面依赖 CDN，离线环境下 Markdown 渲染库可能无法加载；数据生成本身不需要网络。

## 协作约定

- 用户主要使用中文；回复和文档改动优先使用中文，代码标识符保持英文。
- 数据改动要尽量小，不要重命名已有目录或图片，除非用户明确要求。
- 不要引入前端构建系统或包管理器；当前项目是无构建静态站。
- 不要为了完整 YAML 功能随意加依赖。只有当需求确实超出现有格式时，再考虑改生成器。
- 修改 `web/style.css` 或 `web/script.js` 后，留意 `web/index.html` 中的缓存参数是否需要更新。
- 新增图片优先使用 `cover.jpg`，已有条目保持原扩展名即可。
- 遇到 `.DS_Store` 等本地系统文件，不要把它们作为项目逻辑处理。
