"""Fetch the small, licensed font subsets used by Weather Board from Google Fonts."""
from pathlib import Path
import hashlib
import json
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1] / 'web' / 'fonts'
AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
NAMES = 'ac_unit,add,air,api,arrow_forward,check,close,cloud,content_copy,dark_mode,database,delete,device_thermostat,devices,door_front,edit,expand_more,foggy,history,humidity_percentage,light_mode,link,local_fire_department,location_on,monitoring,north_east,partly_cloudy_day,rainy,rainy_light,refresh,schedule,search,sensors,settings,speed,sunny,thunderstorm,view_list'
TEXT = 'https://fonts.googleapis.com/css2?family=Google+Sans+Flex:opsz,wght,ROND@6..144,100..1000,0..100&family=Google+Sans+Code:wght@400..700&display=swap'
SYMBOLS = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,300..700,0..1,-50..200&icon_names=' + NAMES + '&display=block'

def fetch(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers={'User-Agent': AGENT}), timeout=30) as response:
        return response.read()

def main():
    ROOT.mkdir(exist_ok=True)
    manifest = []
    def asset(name, url):
        data = fetch(url)
        (ROOT / name).write_bytes(data)
        manifest.append(dict(file=name, source=url, sha256=hashlib.sha256(data).hexdigest()))
    css = fetch(TEXT).decode()
    blocks = []
    for match in re.finditer(r'/\* (latin-ext|latin) \*/\s*(@font-face\s*\{.*?\})', css, re.S):
        region, block = match.groups()
        family = re.search(r"font-family: '([^']+)'", block).group(1)
        url = re.search(r'url\(([^)]+)\)', block).group(1)
        name = family.lower().replace(' ', '-') + '-' + region + '.woff2'
        asset(name, url)
        blocks.append(block.replace(url, name))
    symbol_css = fetch(SYMBOLS).decode()
    block = re.search(r'@font-face\s*\{.*?\}', symbol_css, re.S).group(0)
    url = re.search(r'url\(([^)]+)\)', block).group(1)
    if "format('woff2')" not in block:
        raise ValueError('Expected the modern variable WOFF2 subset')
    asset('material-symbols-rounded.woff2', url)
    blocks.append(block.replace(url, 'material-symbols-rounded.woff2'))
    (ROOT / 'fonts.css').write_text('/* Google Fonts subsets; see LICENSE files and sources.json. */\n' + '\n'.join(blocks) + '\n', encoding='utf-8')
    for name, url in {
        'GoogleSansFlex-OFL.txt': 'https://raw.githubusercontent.com/googlefonts/googlesans-flex/main/OFL.txt',
        'GoogleSansCode-OFL.txt': 'https://raw.githubusercontent.com/googlefonts/googlesans-code/main/OFL.txt',
        'MaterialSymbols-LICENSE.txt': 'https://raw.githubusercontent.com/google/material-design-icons/master/LICENSE',
    }.items():
        asset(name, url)
    (ROOT / 'sources.json').write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')
    print('Vendored', len(manifest), 'licensed assets;', sum(path.stat().st_size for path in ROOT.glob('*.woff2')), 'font bytes')

if __name__ == '__main__':
    main()
