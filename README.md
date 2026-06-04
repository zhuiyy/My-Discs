### [关于音乐的记录](https://zhuiyy.github.io/My-Discs/web/index.html)

## 添加 CD

在 `CDs/专辑名/` 中放入：

- `cover.jpg` / `cover.png` / `cover.webp`
- `disc.yml`

`disc.yml` 示例：

```yaml
title: "Kapustin Piano Works 2"
tracks:
  - "Ten Bagatelles Op. 59"
artists:
  - "Masahiro Kawakami-川上 昌裕"
composers:
  - "Kapustin"
genres:
  - "classic"
  - "jazz"
count: "1"
source: "Tower Records 涩谷 东京"
notes: |
  中古品.
```

## 添加音乐会

在 `concerts/YYYY-MM-DD/` 中放入：

- `cover.jpg`
- `concert.yml`

如果同一天有多场，可以使用 `YYYY-MM-DD-2`。

`concert.yml` 示例：

```yaml
title: "\"俄乐史诗\"——尼尔森斯与莱比锡布商大厦管弦乐团音乐会"
date: "2026-05-29"
venue: "国家大剧院"
hall: "音乐厅"
performers:
  - "Andris Nelsons"
program:
  - "Rachmaninoff: Piano Concerto No. 2 in C minor, Op. 18"
image: "cover.jpg"
```

修改数据后，运行 `python3 web/generate_data.py` 重新生成 `web/data.js`，再部署或提交。
