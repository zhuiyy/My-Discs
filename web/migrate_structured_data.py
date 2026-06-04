import json
import os
import re
import shutil


ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CDS_DIR = os.path.join(ROOT_DIR, 'CDs')
CONCERTS_DIR = os.path.join(ROOT_DIR, 'concerts')
COVER_EXTENSIONS = ('.jpg', '.jpeg', '.png', '.webp')


CD_SECTION_MAP = {
    '曲目': 'tracks',
    '演奏家': 'artists',
    '演奏家/歌手': 'artists',
    '歌手': 'vocalists',
    '原唱': 'original_artists',
    '编曲/作曲': 'composers',
    '作曲家': 'composers',
    '制作人': 'producers',
    '风格': 'genres',
    '数量': 'count',
    '来源': 'source',
    '附': 'notes',
}


def yaml_quote(value):
    return json.dumps(str(value), ensure_ascii=False)


def write_scalar(lines, key, value):
    if value is None or value == '':
        return
    lines.append(f'{key}: {yaml_quote(value)}')


def write_list(lines, key, values):
    values = [str(value).strip() for value in values if str(value).strip()]
    if not values:
        return
    lines.append(f'{key}:')
    for value in values:
        lines.append(f'  - {yaml_quote(value)}')


def write_block(lines, key, value):
    value = str(value).strip()
    if not value:
        return
    lines.append(f'{key}: |')
    for block_line in value.splitlines():
        lines.append(f'  {block_line}')


def find_cover_filename(item_path):
    for name in os.listdir(item_path):
        base, ext = os.path.splitext(name)
        if base.lower() == 'cover' and ext.lower() in COVER_EXTENSIONS:
            return name
    return None


def parse_cd_readme(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    title_match = re.search(r'^#\s+(.+?)\s*$', content, flags=re.MULTILINE)
    title = title_match.group(1).strip() if title_match else ''
    content = re.sub(r'^#\s+.*$', '', content, flags=re.MULTILINE)
    content = re.sub(r'!\[.*?\]\(.*?\)', '', content)

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

    data = {'title': title}
    for heading, value in sections.items():
        key = CD_SECTION_MAP.get(heading)
        if not key:
            continue
        if key in data and data[key]:
            data[key] = f'{data[key]}\n\n{value}'
        else:
            data[key] = value
    return data


def content_to_list(value):
    return [line.strip() for line in value.splitlines() if line.strip()]


def content_to_genres(value):
    pieces = re.split(r'[,/]+', value)
    genres = [piece.strip() for piece in pieces if piece.strip()]
    return genres or content_to_list(value)


def tracks_should_be_block(value):
    return bool(re.search(r'^\s*[-#*]', value, flags=re.MULTILINE))


def write_disc_yml(path, data):
    lines = []
    write_scalar(lines, 'title', data.get('title'))

    tracks = data.get('tracks', '')
    if tracks_should_be_block(tracks):
        write_block(lines, 'tracks', tracks)
    else:
        write_list(lines, 'tracks', content_to_list(tracks))

    write_list(lines, 'artists', content_to_list(data.get('artists', '')))
    write_list(lines, 'vocalists', content_to_list(data.get('vocalists', '')))
    write_list(lines, 'original_artists', content_to_list(data.get('original_artists', '')))
    write_list(lines, 'composers', content_to_list(data.get('composers', '')))
    write_list(lines, 'producers', content_to_list(data.get('producers', '')))
    write_list(lines, 'genres', content_to_genres(data.get('genres', '')))
    write_scalar(lines, 'count', data.get('count'))
    write_scalar(lines, 'source', data.get('source'))
    write_block(lines, 'notes', data.get('notes', ''))

    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines).rstrip() + '\n')


def migrate_cds():
    count = 0
    for item in sorted(os.listdir(CDS_DIR)):
        item_path = os.path.join(CDS_DIR, item)
        readme_path = os.path.join(item_path, 'README.md')
        disc_path = os.path.join(item_path, 'disc.yml')
        if not os.path.isdir(item_path) or not os.path.exists(readme_path):
            continue
        data = parse_cd_readme(readme_path)
        if not data.get('title'):
            data['title'] = item
        write_disc_yml(disc_path, data)
        count += 1
    return count


def date_to_iso(value):
    match = re.match(r'^(\d{2})\.(\d{2})\.(\d{4})$', value.strip())
    if not match:
        return value.strip()
    day, month, year = match.groups()
    return f'{year}-{month}-{day}'


def parse_concert_sections(path):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()

    raw_sections = re.split(r'^####\s+', content, flags=re.MULTILINE)
    sections = []
    for section in raw_sections:
        if not section.strip():
            continue
        img_match = re.search(r'!\[.*?\]\(\./pics/(.*?)\)', section)
        if not img_match:
            continue
        image = img_match.group(1)
        text = section.replace(img_match.group(0), '').strip()
        lines = text.splitlines()
        if not lines:
            continue
        sections.append({
            'date': date_to_iso(lines[0]),
            'body': '\n'.join(lines[1:]).strip(),
            'image': image,
        })
    return sections


def parse_concert_body(section):
    body_lines = section['body'].splitlines()
    title = ''
    program = []
    performers = []
    venue = ''
    hall = ''

    for line in body_lines:
        stripped = line.strip()
        title_match = re.match(r'^-\s+\*\*(.+?)\*\*$', stripped)
        performer_match = re.match(r'^-\s+\*(.+?)\*$', stripped)
        program_match = re.match(r'^-\s+(.+)$', stripped)

        if title_match:
            title = title_match.group(1).strip()
        elif line.startswith('  - '):
            program.append(line[4:].strip())
        elif performer_match:
            performers = [name.strip() for name in performer_match.group(1).split(' & ') if name.strip()]
        elif program_match:
            location = program_match.group(1).strip()
            if ',' in location:
                venue, hall = [part.strip() for part in location.split(',', 1)]
            else:
                venue = location

    return {
        'date': section['date'],
        'title': title or section['date'],
        'venue': venue,
        'hall': hall,
        'performers': performers,
        'program': program,
        'image': 'cover.jpg',
    }


def write_concert_yml(path, data):
    lines = []
    write_scalar(lines, 'title', data.get('title'))
    write_scalar(lines, 'date', data.get('date'))
    write_scalar(lines, 'venue', data.get('venue'))
    write_scalar(lines, 'hall', data.get('hall'))
    write_list(lines, 'performers', data.get('performers', []))
    write_list(lines, 'program', data.get('program', []))
    write_scalar(lines, 'image', data.get('image'))

    with open(path, 'w', encoding='utf-8') as f:
        f.write('\n'.join(lines).rstrip() + '\n')


def migrate_concerts():
    readme_path = os.path.join(CONCERTS_DIR, 'README.md')
    pics_dir = os.path.join(CONCERTS_DIR, 'pics')
    count = 0
    used_dirs = {}

    for section in parse_concert_sections(readme_path):
        data = parse_concert_body(section)
        dirname = data['date']
        if dirname in used_dirs:
            used_dirs[dirname] += 1
            dirname = f'{dirname}-{used_dirs[dirname]}'
        else:
            used_dirs[dirname] = 1

        target_dir = os.path.join(CONCERTS_DIR, dirname)
        os.makedirs(target_dir, exist_ok=True)
        write_concert_yml(os.path.join(target_dir, 'concert.yml'), data)

        source_image = os.path.join(pics_dir, section['image'])
        target_image = os.path.join(target_dir, 'cover.jpg')
        if os.path.exists(source_image):
            shutil.copy2(source_image, target_image)
        count += 1
    return count


if __name__ == '__main__':
    cd_count = migrate_cds()
    concert_count = migrate_concerts()
    print(f'Migrated {cd_count} CDs and {concert_count} concerts.')
