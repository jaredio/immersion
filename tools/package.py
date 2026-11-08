from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED

root = Path(__file__).resolve().parent.parent
for browser in ('chrome', 'firefox'):
    source = root / 'dist' / browser
    output = root / 'dist' / f'immersion-{browser}.zip'
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for file in sorted(source.rglob('*')):
            # Chromium creates compiled DNR caches inside unpacked extensions.
            # They are browser-generated and must never enter release packages.
            if file.is_file() and '_metadata' not in file.relative_to(source).parts:
                archive.write(file, file.relative_to(source).as_posix())
    print(f'Packaged {output.name}')
