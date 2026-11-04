"""Build a minimal static Amplify archive. No build server, secrets or source docs."""
import argparse
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

FILES = 'index.html workspace.html platform.css explore.css library.css workspace-base.css workspace.css palettes.js request-policy.js open-meteo.js location-names.js typeahead.js place-store.js explore.js library.js workspace.js history.js register-sw.js sw.js manifest.webmanifest icon.svg icon-192.png icon-512.png customHttp.yml'.split()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    web = Path(__file__).resolve().parents[1] / 'web'
    files = [web / name for name in FILES] + list((web / 'fonts').glob('*'))
    if any(not path.is_file() for path in files):
        raise SystemExit('Missing runtime asset')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(args.output, 'w', ZIP_DEFLATED) as archive:
        for path in files:
            archive.write(path, path.relative_to(web).as_posix())
    print(f'{len(files)} assets, {args.output.stat().st_size} bytes')


if __name__ == '__main__':
    main()
