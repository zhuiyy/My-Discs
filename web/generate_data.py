import os
import json
import re
import sys

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


def parse_concerts_readme(readme_path):
    """
    Parses the concerts README to map image filenames to their descriptions.
    Returns a dict: { 'filename.jpg': { 'title': '...', 'description': '...' } }
    """
    if not os.path.exists(readme_path):
        return {}

    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    # Split by level 4 headers (#### Date)
    sections = re.split(r'^####\s+', content, flags=re.MULTILINE)
    
    mapping = {}
    
    for section in sections:
        if not section.strip():
            continue
            
        # Look for image link: ![alt](./pics/filename.jpg)
        img_match = re.search(r'!\[.*?\]\(\./pics/(.*?)\)', section)
        if img_match:
            filename = img_match.group(1)
            
            # The description is the section content, minus the image link
            desc = section.replace(img_match.group(0), '')
            
            lines = desc.strip().split('\n')
            # The first line is the date
            date_line = lines[0].strip()
            
            # The rest is the description
            desc_text = '\n'.join(lines[1:]).strip()
            
            mapping[filename] = {
                'title': date_line,
                'description': desc_text
            }
            
    return mapping


def split_markdown_sections(content):
    sections = {}
    current_title = None
    current_lines = []

    for line in content.splitlines():
        match = re.match(r'^###\s+(.+?)\s*$', line)
        if match:
            if current_title:
                sections[current_title] = '\n'.join(current_lines).strip()
            current_title = match.group(1).strip()
            current_lines = []
        elif current_title:
            current_lines.append(line)

    if current_title:
        sections[current_title] = '\n'.join(current_lines).strip()

    return sections


def markdown_lines_to_list(value):
    if isinstance(value, list):
        return value
    if not value:
        return []
    return [line.strip() for line in value.splitlines() if line.strip()]


def parse_readme_content(readme_path):
    with open(readme_path, 'r', encoding='utf-8') as f:
        content = f.read()

    content = re.sub(r'^#\s+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
    return content.strip()


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
    title = item.get('title')
    if title:
        parts.append(f'- **{title}**')

    program = item.get('program') or []
    if isinstance(program, str):
        program_lines = markdown_lines_to_list(program)
    else:
        program_lines = program
    for line in program_lines:
        parts.append(f'  - {line}')

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


def date_from_legacy_title(title):
    match = re.match(r'^(\d{2})\.(\d{2})\.(\d{4})$', title or '')
    if not match:
        return title or ''
    day, month, year = match.groups()
    return f'{year}-{month}-{day}'

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
                readme_path = os.path.join(item_path, 'README.md')
                yaml_path = next(
                    (
                        os.path.join(item_path, f'disc{ext}')
                        for ext in YAML_EXTENSIONS
                        if os.path.exists(os.path.join(item_path, f'disc{ext}'))
                    ),
                    None,
                )

                if cover_name:
                    structured = parse_simple_yaml(yaml_path) if yaml_path else {}
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

                    if structured:
                        entry['description'] = build_cd_description(entry)
                    elif os.path.exists(readme_path):
                        content = parse_readme_content(readme_path)
                        entry['description'] = content
                    
                    data.append(entry)

    # Process Concerts
    concerts_dir = os.path.join(root_dir, 'concerts')
    concerts_pics_path = os.path.join(concerts_dir, 'pics')
    concerts_readme_path = os.path.join(concerts_dir, 'README.md')
    
    concert_info = parse_concerts_readme(concerts_readme_path)
    concert_entries = []
    structured_concerts_found = False

    if os.path.exists(concerts_dir):
        for item in os.listdir(concerts_dir):
            item_path = os.path.join(concerts_dir, item)
            if not os.path.isdir(item_path) or item == 'pics':
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
            structured_concerts_found = True
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

    if not structured_concerts_found and os.path.exists(concerts_pics_path):
        for item in os.listdir(concerts_pics_path):
            if item.lower().endswith(('.jpg', '.jpeg', '.png', '.webp')):
                entry = {
                    'type': 'concert',
                    'title': 'Concert Memory',
                    'subtitle': item.split('.')[0].replace('_', '/'),
                    'image': f'../concerts/pics/{item}',
                    'description': '',
                    'sort_date': '' # Helper for sorting
                }
                
                if item in concert_info:
                    info = concert_info[item]
                    entry['title'] = info['title']
                    entry['date'] = date_from_legacy_title(info['title'])
                    entry['subtitle'] = entry['date']
                    entry['description'] = info['description']
                    entry['sort_date'] = info['title']  # Assuming title is date like 11.26.2025
                else:
                    stem = item.rsplit('.', 1)[0]
                    entry['description'] = f'Concert photo from {stem.replace("_", "/")}'
                    entry['sort_date'] = stem.replace('_', '.')

                concert_entries.append(entry)
    # Sort Concerts by README order for legacy records, date for structured records.
    readme_order = list(concert_info.keys())

    def get_sort_index(entry):
        if entry.get('date'):
            return entry['date']
        # Extract the filename from the image path (e.g., '../concerts/pics/file.jpg' -> 'file.jpg')
        filename = entry['image'].split('/')[-1]
        if filename in readme_order:
            return readme_order.index(filename)
        return 99999  # Keep unlisted items at the very end

    if concert_entries and concert_entries[0].get('date'):
        concert_entries.sort(key=get_sort_index, reverse=True)
    else:
        concert_entries.sort(key=get_sort_index)

    unlisted_pics = []
    if not structured_concerts_found:
        unlisted_pics = sorted(
            e['image'].split('/')[-1]
            for e in concert_entries
            if e['image'].split('/')[-1] not in concert_info
        )
    if unlisted_pics:
        print(
            'Warning: concert image(s) not referenced in concerts/README.md: '
            + ', '.join(unlisted_pics),
            file=sys.stderr,
        )

    # Clean up sort_date before saving
    for entry in concert_entries:
        if 'sort_date' in entry:
            del entry['sort_date']

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
