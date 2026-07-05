#!/usr/bin/env python3
"""Local entry form for adding CDs and concerts to this static site."""

import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
WEB_DIR = os.path.join(ROOT_DIR, 'web')
GENERATE_SCRIPT = os.path.join(WEB_DIR, 'generate_data.py')
COVER_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp'}
MAX_UPLOAD_BYTES = 30 * 1024 * 1024


PAGE_HTML = """<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My Discs 本地录入</title>
  <style>
    :root {
      color-scheme: light;
      --bg: #f6f4ef;
      --panel: #ffffff;
      --text: #1f2933;
      --muted: #667085;
      --line: #d8d2c7;
      --accent: #2f6f73;
      --accent-dark: #225155;
      --danger: #b42318;
      --ok: #067647;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      line-height: 1.5;
    }
    main {
      width: min(980px, calc(100% - 32px));
      margin: 0 auto;
      padding: 32px 0 48px;
    }
    h1 {
      margin: 0 0 6px;
      font-size: 28px;
      letter-spacing: 0;
    }
    .subhead {
      margin: 0 0 24px;
      color: var(--muted);
      font-size: 15px;
    }
    form {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 22px;
      box-shadow: 0 12px 30px rgba(31, 41, 51, 0.07);
    }
    fieldset {
      border: 0;
      margin: 0 0 22px;
      padding: 0;
    }
    legend {
      margin-bottom: 12px;
      font-weight: 700;
      font-size: 16px;
    }
    .type-row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .type-row label {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px 14px;
      cursor: pointer;
      background: #fbfaf8;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .field.full { grid-column: 1 / -1; }
    label span,
    .label {
      font-size: 13px;
      font-weight: 700;
      color: #344054;
    }
    input[type="text"],
    input[type="date"],
    input[type="file"],
    textarea {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 7px;
      padding: 10px 11px;
      color: var(--text);
      font: inherit;
      background: #fff;
    }
    textarea {
      min-height: 94px;
      resize: vertical;
    }
    textarea.tall { min-height: 150px; }
    .track-builder {
      border: 1px solid var(--line);
      border-radius: 8px;
      background: #fbfaf8;
      padding: 12px;
      margin-top: 8px;
    }
    .track-builder-title {
      margin: 0 0 10px;
      font-size: 13px;
      font-weight: 700;
      color: #344054;
    }
    .builder-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 10px;
    }
    .builder-grid .wide {
      grid-column: span 2;
    }
    .builder-grid input {
      min-height: 38px;
      padding: 8px 9px;
      font-size: 14px;
    }
    .secondary-button {
      border: 1px solid var(--line);
      background: #fff;
      color: var(--accent);
      padding: 9px 12px;
    }
    .secondary-button:hover {
      border-color: var(--accent);
      background: #eef7f7;
      color: var(--accent-dark);
    }
    .hint {
      color: var(--muted);
      font-size: 12px;
    }
    .cover-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) 160px;
      gap: 16px;
      align-items: start;
    }
    .preview {
      width: 160px;
      aspect-ratio: 1;
      border: 1px solid var(--line);
      border-radius: 8px;
      display: grid;
      place-items: center;
      overflow: hidden;
      background: #f0ede7;
      color: var(--muted);
      font-size: 13px;
      text-align: center;
    }
    .preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-top: 4px;
    }
    button {
      border: 0;
      border-radius: 7px;
      background: var(--accent);
      color: #fff;
      padding: 11px 18px;
      font: inherit;
      font-weight: 700;
      cursor: pointer;
    }
    button:hover { background: var(--accent-dark); }
    button:disabled {
      cursor: wait;
      opacity: 0.65;
    }
    .status {
      margin-top: 16px;
      border-radius: 8px;
      padding: 12px 14px;
      display: none;
      white-space: pre-wrap;
    }
    .status.ok {
      display: block;
      border: 1px solid rgba(6, 118, 71, 0.25);
      background: #ecfdf3;
      color: var(--ok);
    }
    .status.error {
      display: block;
      border: 1px solid rgba(180, 35, 24, 0.25);
      background: #fef3f2;
      color: var(--danger);
    }
    .hidden { display: none; }
    @media (max-width: 720px) {
      main { width: min(100% - 20px, 980px); padding-top: 20px; }
      form { padding: 16px; }
      .grid,
      .builder-grid,
      .cover-row { grid-template-columns: 1fr; }
      .builder-grid .wide { grid-column: auto; }
      .preview { width: 100%; max-width: 220px; }
    }
  </style>
</head>
<body>
  <main>
    <h1>My Discs 本地录入</h1>
    <p class="subhead">提交后会写入现有 YAML/封面目录，并重新生成 web/data.js。</p>

    <form id="entry-form">
      <fieldset>
        <legend>条目类型</legend>
        <div class="type-row">
          <label><input type="radio" name="entry_type" value="cd" checked> CD</label>
          <label><input type="radio" name="entry_type" value="vinyl"> 黑胶</label>
          <label><input type="radio" name="entry_type" value="concert"> 音乐会</label>
        </div>
      </fieldset>

      <fieldset>
        <legend>封面</legend>
        <div class="cover-row">
          <div class="field">
            <label for="cover"><span>封面图片 *</span></label>
            <input id="cover" name="cover" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp" required>
            <div class="hint">支持 jpg、jpeg、png、webp；文件会保存为 cover.&lt;ext&gt;。</div>
          </div>
          <div id="preview" class="preview">尚未选择图片</div>
        </div>
      </fieldset>

      <section id="cd-fields">
        <fieldset>
          <legend>唱片信息</legend>
          <div class="grid">
            <div class="field full">
              <label for="cd-title"><span>标题 *</span></label>
              <input id="cd-title" name="cd_title" type="text" autocomplete="off">
            </div>
            <div class="field full">
              <label for="tracks"><span>曲目</span></label>
              <textarea id="tracks" name="tracks" placeholder="一行一项；推荐格式：Piano Concerto No. 2 in C minor, Op. 18 - Rachmaninoff"></textarea>
              <div class="track-builder" data-target="tracks">
                <p class="track-builder-title">结构化追加曲目</p>
                <div class="builder-grid">
                  <input type="text" data-part="title" class="wide" placeholder="作品名，如 Piano Concerto">
                  <input type="text" data-part="number" placeholder="编号，如 2">
                  <input type="text" data-part="key" placeholder="调性，如 C minor">
                  <input type="text" data-part="catalog" placeholder="目录号，如 Op. 18">
                  <input type="text" data-part="nickname" placeholder="别名，如 Choral">
                  <input type="text" data-part="movement" placeholder="乐章，如 I. Allegro">
                  <input type="text" data-part="composer" placeholder="作者，如 Rachmaninoff">
                  <input type="text" data-part="note" placeholder="说明，如 with 独奏者">
                </div>
                <div class="actions">
                  <button type="button" class="secondary-button" data-action="append-track">追加曲目</button>
                  <button type="button" class="secondary-button" data-action="append-intermission">追加中场</button>
                </div>
                <div class="hint">生成格式：[Title] [No. n] [in Key], [Op./K./BWV] ["Nickname"][: Movement] [(说明)] - Composer。</div>
              </div>
            </div>
            <div class="field">
              <label for="artists"><span>演奏家</span></label>
              <textarea id="artists" name="artists" placeholder="一行一项，如：Martha Argerich (piano)&#10;刘晓禹 (Bruce Liu, piano)"></textarea>
              <div class="hint">外国人名不附中文译名；中国/华人音乐家中文优先；CD 内乐器身份可保留。</div>
            </div>
            <div class="field">
              <label for="composers"><span>作曲家</span></label>
              <textarea id="composers" name="composers" placeholder="一人一行，如：Beethoven&#10;Franck"></textarea>
            </div>
            <div class="field">
              <label for="genres"><span>风格</span></label>
              <textarea id="genres" name="genres" placeholder="classic&#10;jazz"></textarea>
            </div>
            <div class="field">
              <label for="count"><span>数量</span></label>
              <input id="count" name="count" type="text" autocomplete="off">
            </div>
            <div class="field">
              <label for="source"><span>来源</span></label>
              <input id="source" name="source" type="text" autocomplete="off">
            </div>
            <div class="field full">
              <label for="cd-notes"><span>备注</span></label>
              <textarea id="cd-notes" name="cd_notes" class="tall"></textarea>
            </div>
          </div>
        </fieldset>
      </section>

      <section id="concert-fields" class="hidden">
        <fieldset>
          <legend>音乐会信息</legend>
          <div class="grid">
            <div class="field full">
              <label for="concert-title"><span>标题 *</span></label>
              <input id="concert-title" name="concert_title" type="text" autocomplete="off">
            </div>
            <div class="field">
              <label for="date"><span>日期 *</span></label>
              <input id="date" name="date" type="date">
            </div>
            <div class="field">
              <label for="venue"><span>场馆</span></label>
              <input id="venue" name="venue" type="text" autocomplete="off">
            </div>
            <div class="field">
              <label for="hall"><span>厅</span></label>
              <input id="hall" name="hall" type="text" autocomplete="off">
            </div>
            <div class="field full">
              <label for="performers"><span>演出者</span></label>
              <textarea id="performers" name="performers" placeholder="一行一项，如：刘晓禹 (Bruce Liu)&#10;Vienna Philharmonic Orchestra"></textarea>
              <div class="hint">音乐会演出者通常不写乐器身份；外国团体不附中文译名。</div>
            </div>
            <div class="field full">
              <label for="program"><span>曲目单</span></label>
              <textarea id="program" name="program" class="tall" placeholder="一行一项；推荐格式：Violin Concerto No. 3 in G major, K. 216 (with Renaud Capuçon) - Mozart"></textarea>
              <div class="track-builder" data-target="program">
                <p class="track-builder-title">结构化追加曲目</p>
                <div class="builder-grid">
                  <input type="text" data-part="title" class="wide" placeholder="作品名，如 Violin Concerto">
                  <input type="text" data-part="number" placeholder="编号，如 3">
                  <input type="text" data-part="key" placeholder="调性，如 G major">
                  <input type="text" data-part="catalog" placeholder="目录号，如 K. 216">
                  <input type="text" data-part="nickname" placeholder="别名，如 Kreutzer">
                  <input type="text" data-part="movement" placeholder="乐章，如 I. Allegro">
                  <input type="text" data-part="composer" placeholder="作者，如 Mozart">
                  <input type="text" data-part="note" placeholder="说明，如 with Renaud Capuçon">
                </div>
                <div class="actions">
                  <button type="button" class="secondary-button" data-action="append-track">追加曲目</button>
                  <button type="button" class="secondary-button" data-action="append-intermission">追加中场</button>
                </div>
                <div class="hint">生成格式：[Title] [No. n] [in Key], [Op./K./BWV] ["Nickname"][: Movement] [(说明)] - Composer。</div>
              </div>
            </div>
          </div>
        </fieldset>
      </section>

      <div class="actions">
        <button id="submit-button" type="button">保存并生成 data.js</button>
        <span class="hint">保存后可打开 /web/index.html 查看。</span>
      </div>
      <div id="status" class="status" role="status" aria-live="polite"></div>
    </form>
  </main>

  <script>
    const form = document.getElementById('entry-form');
    const statusBox = document.getElementById('status');
    const submitButton = document.getElementById('submit-button');
    const cdFields = document.getElementById('cd-fields');
    const concertFields = document.getElementById('concert-fields');
    const preview = document.getElementById('preview');
    const coverInput = document.getElementById('cover');

    function entryType() {
      return form.elements.entry_type.value;
    }

    function syncType() {
      const isConcert = entryType() === 'concert';
      cdFields.classList.toggle('hidden', isConcert);
      concertFields.classList.toggle('hidden', !isConcert);
      document.getElementById('cd-title').required = !isConcert;
      document.getElementById('concert-title').required = isConcert;
      document.getElementById('date').required = isConcert;
    }

    function setStatus(kind, message) {
      statusBox.className = 'status ' + kind;
      statusBox.textContent = message;
    }

    form.querySelectorAll('input[name="entry_type"]').forEach((radio) => {
      radio.addEventListener('change', syncType);
    });

    coverInput.addEventListener('change', () => {
      const file = coverInput.files && coverInput.files[0];
      if (!file) {
        preview.textContent = '尚未选择图片';
        return;
      }
      const url = URL.createObjectURL(file);
      preview.innerHTML = '';
      const img = document.createElement('img');
      img.src = url;
      img.alt = file.name;
      img.onload = () => URL.revokeObjectURL(url);
      preview.appendChild(img);
    });

    function cleanValue(value) {
      return String(value || '').trim();
    }

    function normalizeNumber(value) {
      const number = cleanValue(value);
      if (!number) {
        return '';
      }
      return /^No\\./i.test(number) ? number : 'No. ' + number;
    }

    function quoteNickname(value) {
      const nickname = cleanValue(value).replace(/^["“”]+|["“”]+$/g, '');
      return nickname ? '"' + nickname + '"' : '';
    }

    function buildTrackLine(builder) {
      const value = (part) => cleanValue(builder.querySelector('[data-part="' + part + '"]').value);
      const title = value('title');
      const number = normalizeNumber(value('number'));
      const key = value('key');
      const catalog = value('catalog');
      const nickname = quoteNickname(value('nickname'));
      const movement = value('movement');
      const note = value('note');
      const composer = value('composer');

      let line = [title, number].filter(Boolean).join(' ');
      if (key) {
        line += (line ? ' in ' : 'in ') + key;
      }
      if (catalog) {
        line += (line ? ', ' : '') + catalog;
      }
      if (nickname) {
        line += (line ? ' ' : '') + nickname;
      }
      if (movement) {
        line += (line ? ': ' : '') + movement;
      }
      if (note) {
        line += (line ? ' ' : '') + '(' + note + ')';
      }
      if (composer) {
        line += (line ? ' - ' : '') + composer;
      }
      return line;
    }

    function appendLineToTextarea(textarea, line) {
      const value = textarea.value.trimEnd();
      textarea.value = value ? value + '\\n' + line : line;
      textarea.focus();
    }

    document.querySelectorAll('.track-builder').forEach((builder) => {
      const textarea = document.getElementById(builder.dataset.target);
      builder.querySelector('[data-action="append-track"]').addEventListener('click', () => {
        const line = buildTrackLine(builder);
        if (!line) {
          setStatus('error', '请至少填写作品名或作者。');
          return;
        }
        appendLineToTextarea(textarea, line);
        builder.querySelectorAll('input').forEach((input) => {
          input.value = '';
        });
        statusBox.className = 'status';
        statusBox.textContent = '';
      });
      builder.querySelector('[data-action="append-intermission"]').addEventListener('click', () => {
        appendLineToTextarea(textarea, '*—INTERMISSION—*');
      });
    });

    form.addEventListener('submit', (event) => {
      event.preventDefault();
    });

    async function saveEntry() {
      statusBox.className = 'status';
      statusBox.textContent = '';
      submitButton.disabled = true;
      submitButton.textContent = '保存中...';

      try {
        const response = await fetch('/submit', {
          method: 'POST',
          body: new FormData(form)
        });
        const result = await response.json();
        if (!response.ok || !result.ok) {
          throw new Error(result.error || '保存失败');
        }
        setStatus('ok', [
          '保存成功。',
          '目录：' + result.relativePath,
          '生成器：' + result.generatorOutput.trim(),
          '预览：http://localhost:' + location.port + result.previewPath
        ].join('\\n'));
        form.reset();
        preview.textContent = '尚未选择图片';
        syncType();
      } catch (error) {
        setStatus('error', error.message);
      } finally {
        submitButton.disabled = false;
        submitButton.textContent = '保存并生成 data.js';
      }
    }

    submitButton.addEventListener('click', saveEntry);

    syncType();
  </script>
</body>
</html>
"""


class AdminError(Exception):
    """Expected validation or submission error."""


def json_response(handler, status, payload):
    body = json.dumps(payload, ensure_ascii=False, indent=2).encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', 'application/json; charset=utf-8')
    handler.send_header('Content-Length', str(len(body)))
    handler.end_headers()
    handler.wfile.write(body)


def text_response(handler, status, body, content_type='text/html; charset=utf-8'):
    encoded = body.encode('utf-8')
    handler.send_response(status)
    handler.send_header('Content-Type', content_type)
    handler.send_header('Content-Length', str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def parse_multipart(headers, body):
    content_type = headers.get('Content-Type', '')
    if not content_type.lower().startswith('multipart/form-data'):
        raise AdminError('请求必须是 multipart/form-data。')

    raw = (
        f'Content-Type: {content_type}\r\n'
        'MIME-Version: 1.0\r\n\r\n'
    ).encode('utf-8') + body
    message = BytesParser(policy=policy.default).parsebytes(raw)
    fields = {}
    files = {}

    for part in message.iter_parts():
        if part.get_content_disposition() != 'form-data':
            continue
        name = part.get_param('name', header='content-disposition')
        if not name:
            continue
        filename = part.get_filename()
        payload = part.get_payload(decode=True) or b''
        if filename:
            files[name] = {
                'filename': filename,
                'content': payload,
                'content_type': part.get_content_type(),
            }
        else:
            charset = part.get_content_charset() or 'utf-8'
            fields[name] = payload.decode(charset, errors='replace')

    return fields, files


def split_lines(value):
    return [line.strip() for line in (value or '').splitlines() if line.strip()]


def scalar(value):
    return json.dumps(str(value), ensure_ascii=False)


def block(value):
    if value is None:
        return None
    text = str(value).replace('\r\n', '\n').replace('\r', '\n').rstrip()
    if not text:
        return None
    lines = text.split('\n')
    return '|\n' + '\n'.join(f'  {line}' if line else '  ' for line in lines)


def append_scalar(lines, key, value, required=False):
    value = (value or '').strip()
    if value or required:
        lines.append(f'{key}: {scalar(value)}')


def append_list(lines, key, values):
    values = split_lines(values)
    if not values:
        return
    lines.append(f'{key}:')
    for value in values:
        lines.append(f'  - {scalar(value)}')


def append_block(lines, key, value):
    rendered = block(value)
    if rendered:
        lines.append(f'{key}: {rendered}')


def sanitize_cd_dir_name(title):
    name = re.sub(r'[\\/]+', ' ', title.strip())
    name = re.sub(r'\s+', ' ', name).strip(' .')
    return name


def validate_cover(files):
    cover = files.get('cover')
    if not cover or not cover['content']:
        raise AdminError('请上传封面图片。')

    original_name = cover['filename']
    _, ext = os.path.splitext(original_name)
    ext = ext.lower()
    if ext not in COVER_EXTENSIONS:
        allowed = ', '.join(sorted(COVER_EXTENSIONS))
        raise AdminError(f'封面格式不支持：{html.escape(ext or "无扩展名")}。支持 {allowed}。')
    return ext, cover['content']


def ensure_inside_root(path):
    real_root = os.path.realpath(ROOT_DIR)
    real_path = os.path.realpath(path)
    if real_path != real_root and not real_path.startswith(real_root + os.sep):
        raise AdminError('目标路径不在仓库内，已拒绝写入。')


def unique_concert_dir(date_value):
    base = os.path.join(ROOT_DIR, 'concerts', date_value)
    if not os.path.exists(base):
        return base
    index = 2
    while True:
        candidate = os.path.join(ROOT_DIR, 'concerts', f'{date_value}-{index}')
        if not os.path.exists(candidate):
            return candidate
        index += 1


def write_file(path, content, mode='w'):
    ensure_inside_root(path)
    with open(path, mode) as f:
        f.write(content)


def build_cd_yaml(fields):
    lines = []
    append_scalar(lines, 'title', fields.get('cd_title'), required=True)
    append_list(lines, 'tracks', fields.get('tracks'))
    append_list(lines, 'artists', fields.get('artists'))
    append_list(lines, 'composers', fields.get('composers'))
    append_list(lines, 'genres', fields.get('genres'))
    append_scalar(lines, 'count', fields.get('count'))
    append_scalar(lines, 'source', fields.get('source'))
    append_block(lines, 'notes', fields.get('cd_notes'))
    return '\n'.join(lines) + '\n'


def build_concert_yaml(fields, cover_name):
    lines = []
    append_scalar(lines, 'title', fields.get('concert_title'), required=True)
    append_scalar(lines, 'date', fields.get('date'), required=True)
    append_scalar(lines, 'venue', fields.get('venue'))
    append_scalar(lines, 'hall', fields.get('hall'))
    append_list(lines, 'performers', fields.get('performers'))
    append_list(lines, 'program', fields.get('program'))
    append_scalar(lines, 'image', cover_name, required=True)
    return '\n'.join(lines) + '\n'


def run_generator():
    process = subprocess.run(
        [sys.executable, GENERATE_SCRIPT],
        cwd=ROOT_DIR,
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    output = (process.stdout + process.stderr).strip()
    if process.returncode != 0:
        raise AdminError(f'写入已完成，但 generate_data.py 运行失败：\n{output}')
    return output or 'data.js generated successfully in web folder.'


def create_entry(fields, files):
    entry_type = (fields.get('entry_type') or '').strip()
    if entry_type not in {'cd', 'vinyl', 'concert'}:
        raise AdminError('请选择 CD、黑胶或音乐会。')

    cover_ext, cover_bytes = validate_cover(files)
    cover_name = f'cover{cover_ext}'

    if entry_type in {'cd', 'vinyl'}:
        label = 'CD' if entry_type == 'cd' else '黑胶'
        collection_dir = 'CDs' if entry_type == 'cd' else 'Vinyls'
        title = (fields.get('cd_title') or '').strip()
        if not title:
            raise AdminError(f'{label} 标题不能为空。')
        directory_name = sanitize_cd_dir_name(title)
        if not directory_name:
            raise AdminError(f'{label} 标题不能作为目录名，请换一个标题。')
        target_dir = os.path.join(ROOT_DIR, collection_dir, directory_name)
        yaml_name = 'disc.yml'
        yaml_text = build_cd_yaml(fields)
    else:
        title = (fields.get('concert_title') or '').strip()
        date_value = (fields.get('date') or '').strip()
        if not title:
            raise AdminError('音乐会标题不能为空。')
        if not re.fullmatch(r'\d{4}-\d{2}-\d{2}', date_value):
            raise AdminError('音乐会日期必须是 YYYY-MM-DD 格式。')
        target_dir = unique_concert_dir(date_value)
        yaml_name = 'concert.yml'
        yaml_text = build_concert_yaml(fields, cover_name)

    ensure_inside_root(target_dir)
    if entry_type in {'cd', 'vinyl'} and os.path.exists(target_dir):
        label = 'CD' if entry_type == 'cd' else '黑胶'
        raise AdminError(f'{label} 目录已存在：{os.path.relpath(target_dir, ROOT_DIR)}')
    if os.path.exists(target_dir):
        raise AdminError(f'目标目录已存在：{os.path.relpath(target_dir, ROOT_DIR)}')

    os.makedirs(target_dir)
    created = True
    try:
        cover_path = os.path.join(target_dir, cover_name)
        yaml_path = os.path.join(target_dir, yaml_name)
        write_file(cover_path, cover_bytes, mode='wb')
        write_file(yaml_path, yaml_text)
        generator_output = run_generator()
    except Exception:
        if created:
            shutil.rmtree(target_dir, ignore_errors=True)
        raise

    return {
        'relativePath': os.path.relpath(target_dir, ROOT_DIR),
        'generatorOutput': generator_output,
        'previewPath': '/web/index.html',
    }


class AdminHandler(BaseHTTPRequestHandler):
    server_version = 'MyDiscsAdmin/1.0'

    def log_message(self, fmt, *args):
        sys.stderr.write('%s - - [%s] %s\n' % (
            self.address_string(),
            self.log_date_time_string(),
            fmt % args,
        ))

    def do_GET(self):
        path = urlparse(self.path).path
        if path in {'/', '/index.html'}:
            text_response(self, 200, PAGE_HTML)
            return
        if path == '/health':
            json_response(self, 200, {'ok': True})
            return
        text_response(self, 404, 'Not found', 'text/plain; charset=utf-8')

    def do_POST(self):
        path = urlparse(self.path).path
        if path != '/submit':
            json_response(self, 404, {'ok': False, 'error': 'Not found'})
            return

        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0:
            json_response(self, 400, {'ok': False, 'error': '请求体为空。'})
            return
        if length > MAX_UPLOAD_BYTES:
            json_response(self, 413, {'ok': False, 'error': '上传内容太大。'})
            return

        try:
            body = self.rfile.read(length)
            fields, files = parse_multipart(self.headers, body)
            result = create_entry(fields, files)
            json_response(self, 200, {'ok': True, **result})
        except AdminError as exc:
            json_response(self, 400, {'ok': False, 'error': str(exc)})
        except Exception as exc:
            json_response(self, 500, {'ok': False, 'error': f'服务器错误：{exc}'})


def main():
    parser = argparse.ArgumentParser(description='Run the local My Discs entry form.')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', default=8765, type=int)
    args = parser.parse_args()

    server = ThreadingHTTPServer((args.host, args.port), AdminHandler)
    print(f'Local entry form: http://{args.host}:{args.port}/')
    print('Press Ctrl-C to stop.')
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nStopped.')
    finally:
        server.server_close()


if __name__ == '__main__':
    main()
