import os
import json
import re
from datetime import datetime

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
                cover_path = os.path.join(item_path, 'cover.jpg')
                readme_path = os.path.join(item_path, 'README.md')
                
                if os.path.exists(cover_path):
                    entry = {
                        'type': 'cd',
                        'title': item,
                        'image': f'../CDs/{item}/cover.jpg',
                        'description': ''
                    }
                    
                    if os.path.exists(readme_path):
                        with open(readme_path, 'r', encoding='utf-8') as f:
                            content = f.read()
                            
                            # 1. Remove H1 Title
                            content = re.sub(r'^#\s+.*$', '', content, flags=re.MULTILINE)
                            
                            # 2. Remove Images (Markdown syntax)
                            content = re.sub(r'!\[.*?\]\(.*?\)', '', content)
                            
                            entry['description'] = content.strip()
                    
                    data.append(entry)

    # Process Concerts
    concerts_dir = os.path.join(root_dir, 'concerts')
    concerts_pics_path = os.path.join(concerts_dir, 'pics')
    concerts_readme_path = os.path.join(concerts_dir, 'README.md')
    
    concert_info = parse_concerts_readme(concerts_readme_path)
    concert_entries = []

    if os.path.exists(concerts_pics_path):
        for item in os.listdir(concerts_pics_path):
            if item.lower().endswith(('.jpg', '.jpeg', '.png')):
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
                    entry['description'] = info['description']
                    entry['sort_date'] = info['title'] # Assuming title is date like 11.26.2025
                else:
                     entry['description'] = f'Concert photo from {item.split(".")[0].replace("_", "/")}'
                     try:
                         date_str = item.split('.')[0].replace('_', '.')
                         entry['sort_date'] = date_str
                     except:
                         entry['sort_date'] = '01.01.1970'

                concert_entries.append(entry)

    # Sort Concerts by Date (Newest First)
    def parse_date(date_str):
        try:
            return datetime.strptime(date_str, '%m.%d.%Y')
        except ValueError:
            return datetime.min

    concert_entries.sort(key=lambda x: parse_date(x['sort_date']), reverse=True)

    # Clean up sort_date before saving
    for entry in concert_entries:
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
