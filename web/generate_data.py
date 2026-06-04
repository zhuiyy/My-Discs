import os
import json
import re

COVER_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')
YAML_EXTENSIONS = ('.yml', '.yaml')


def parse_yaml_scalar(value):
    value = value.strip()
    if value == '':
        return ''
    if value[0:1] in ('"', "'") and value[-1:] == value[0]:
        try:
            return json.loads(value)
        except json.JSONDecodeError:
            return value[1:-1]
    return value


def parse_simple_yaml(path):
    """
    Parse the tiny YAML subset used by this repository.

    Supported forms:
      key: value
      key:
        - value
      key: |
        multi-line markdown/text

    This avoids adding a PyYAML dependency for a static-site data generator.
    """
    with open(path, 'r', encoding='utf-8') as f:
        lines = f.read().splitlines()

    data = {}
    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.strip()
        if not stripped or stripped.startswith('#'):
            i += 1
            continue
        if line.startswith((' ', '\t')) or ':' not in line:
            i += 1
            continue

        key, raw_value = line.split(':', 1)
        key = key.strip()
        raw_value = raw_value.strip()

        if raw_value == '|':
            i += 1
            block = []
            while i < len(lines):
                child = lines[i]
                if child and not child.startswith((' ', '\t')):
                    break
                block.append(child[2:] if child.startswith('  ') else child.lstrip('\t'))
                i += 1
            data[key] = '\n'.join(block).rstrip()
            continue

        if raw_value == '':
            i += 1
            values = []
            while i < len(lines):
                child = lines[i]
                child_stripped = child.strip()
                if not child_stripped:
                    i += 1
                    continue
                if child and not child.startswith((' ', '\t')):
                    break
                if child_stripped.startswith('- '):
                    values.append(parse_yaml_scalar(child_stripped[2:]))
                i += 1
            data[key] = values
            continue

        data[key] = parse_yaml_scalar(raw_value)
        i += 1

    return data


def find_cover_filename(item_path):
    """Return the cover image basename if present, else None."""
    try:
        names = os.listdir(item_path)
    except OSError:
        return None
    for name in names:
        base, ext = os.path.splitext(name)
        if base.lower() == 'cover' and ext.lower() in COVER_EXTENSIONS:
            return name
    return None


def markdown_lines_to_list(value):
    if isinstance(value, list):
        return value
    if not value:
        return []
    return [line.strip() for line in value.splitlines() if line.strip()]


def build_cd_description(item):
    parts = []
    section_map = [
        ('tracks', '曲目'),
        ('artists', '演奏家'),
        ('vocalists', '歌手'),
        ('original_artists', '原唱'),
        ('composers', '作曲家'),
        ('producers', '制作人'),
        ('genres', '风格'),
        ('count', '数量'),
        ('source', '来源'),
        ('notes', '附'),
    ]

    for key, title in section_map:
        value = item.get(key)
        if not value:
            continue
        parts.append(f'### {title}')
        if isinstance(value, list):
            parts.append('\n\n'.join(str(v) for v in value))
        else:
            parts.append(str(value))

    return '\n'.join(parts).strip()


def build_concert_description(item):
    parts = []
    program = item.get('program') or []
    if isinstance(program, str):
        program_lines = markdown_lines_to_list(program)
    else:
        program_lines = program
    for line in program_lines:
        parts.append(f'- {line}')

    performers = item.get('performers') or []
    if performers:
        parts.append(f"- *{' & '.join(performers)}*")

    venue_parts = [item.get('venue'), item.get('hall')]
    venue = ', '.join(part for part in venue_parts if part)
    if venue:
        parts.append(f'- {venue}')

    notes = item.get('notes')
    if notes:
        parts.append(str(notes))

    return '\n'.join(parts).strip()


def normalize_list(value):
    if isinstance(value, list):
        return [str(v).strip() for v in value if str(v).strip()]
    if not value:
        return []
    return markdown_lines_to_list(str(value))


def generate_data():
    data = []
    music_data = []
    
    base_dir = os.path.dirname(os.path.abspath(__file__))
    root_dir = os.path.dirname(base_dir)
    
    # Process CDs
    cds_path = os.path.join(root_dir, 'CDs')
    if os.path.exists(cds_path):
        for item in os.listdir(cds_path):
            item_path = os.path.join(cds_path, item)
            if os.path.isdir(item_path):
                cover_name = find_cover_filename(item_path)
                yaml_path = next(
                    (
                        os.path.join(item_path, f'disc{ext}')
                        for ext in YAML_EXTENSIONS
                        if os.path.exists(os.path.join(item_path, f'disc{ext}'))
                    ),
                    None,
                )

                if cover_name and yaml_path:
                    structured = parse_simple_yaml(yaml_path)
                    entry = {
                        'type': 'cd',
                        'title': structured.get('title') or item,
                        'image': f'../CDs/{item}/{cover_name}',
                        'description': '',
                        'tracks': structured.get('tracks') or [],
                        'artists': normalize_list(structured.get('artists')),
                        'vocalists': normalize_list(structured.get('vocalists')),
                        'original_artists': normalize_list(structured.get('original_artists')),
                        'composers': normalize_list(structured.get('composers')),
                        'producers': normalize_list(structured.get('producers')),
                        'genres': normalize_list(structured.get('genres')),
                        'count': structured.get('count') or '',
                        'source': structured.get('source') or '',
                        'tags': normalize_list(structured.get('tags')),
                        'notes': structured.get('notes') or '',
                    }
                    entry['description'] = build_cd_description(entry)
                    
                    data.append(entry)

    # Process Concerts
    concerts_dir = os.path.join(root_dir, 'concerts')
    concert_entries = []

    if os.path.exists(concerts_dir):
        for item in os.listdir(concerts_dir):
            item_path = os.path.join(concerts_dir, item)
            if not os.path.isdir(item_path):
                continue
            yaml_path = next(
                (
                    os.path.join(item_path, f'concert{ext}')
                    for ext in YAML_EXTENSIONS
                    if os.path.exists(os.path.join(item_path, f'concert{ext}'))
                ),
                None,
            )
            if not yaml_path:
                continue
            structured = parse_simple_yaml(yaml_path)
            image_name = structured.get('image') or find_cover_filename(item_path)
            if not image_name:
                continue
            entry = {
                'type': 'concert',
                'title': structured.get('title') or item,
                'date': structured.get('date') or item,
                'subtitle': structured.get('date') or item,
                'image': f'../concerts/{item}/{image_name}',
                'description': '',
                'venue': structured.get('venue') or '',
                'hall': structured.get('hall') or '',
                'performers': normalize_list(structured.get('performers')),
                'program': structured.get('program') or [],
                'encores': structured.get('encores') or [],
                'notes': structured.get('notes') or '',
            }
            entry['description'] = build_concert_description(entry)
            concert_entries.append(entry)

    concert_entries.sort(key=lambda entry: entry.get('date') or '', reverse=True)

    # Combine Data
    data.extend(concert_entries)

    # Process Music
    music_path = os.path.join(base_dir, 'music')
    if os.path.exists(music_path):
        for item in os.listdir(music_path):
            if item.lower().endswith(('.mp3', '.flac', '.wav', '.ogg', '.m4a')):
                entry = {
                    'title': os.path.splitext(item)[0],
                    'path': f'music/{item}'
                }
                music_data.append(entry)

    # Write to data.js
    output_path = os.path.join(base_dir, 'data.js')
    with open(output_path, 'w', encoding='utf-8') as f:
        # Write both siteData and musicData
        f.write(f'const siteData = {json.dumps(data, ensure_ascii=False, indent=2)};\n')
        f.write(f'const musicData = {json.dumps(music_data, ensure_ascii=False, indent=2)};')

if __name__ == '__main__':
    generate_data()
    print("data.js generated successfully in web folder.")
