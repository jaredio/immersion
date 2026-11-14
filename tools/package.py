from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
import sys

root = Path(__file__).resolve().parent.parent
plan = json.load(sys.stdin)
for browser in ('chrome', 'firefox'):
    source = root / 'dist' / browser
    output = root / 'dist' / f'immersion-{browser}.zip'
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for name in sorted(set(plan[browser])):
            file = (source / name).resolve()
            if not file.is_relative_to(source.resolve()) or not file.is_file():
                raise RuntimeError(f'Invalid or missing release file: {name}')
            archive.write(file, name)
    print(f'Packaged {output.name}')
