"""Generate Immersion's geometric app mark. Requires Pillow only to regenerate."""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
for size in (16, 48, 128):
    scale = 4
    canvas = Image.new('RGBA', (size * scale, size * scale))
    draw = ImageDraw.Draw(canvas)
    def box(coords):
        return tuple(round(n * size * scale / 128) for n in coords)
    draw.rounded_rectangle(box((1, 1, 127, 127)), radius=round(size * scale * .23), fill='#111216')
    draw.rounded_rectangle(box((22, 25, 106, 103)), radius=round(size * scale * .09), outline='#8cecc0', width=max(2, round(size * scale * .045)))
    draw.rounded_rectangle(box((59, 57, 69, 88)), radius=max(1, round(size * scale * .025)), fill='#f4f4f5')
    draw.ellipse(box((58, 39, 70, 51)), fill='#f4f4f5')
    canvas.resize((size, size), Image.Resampling.LANCZOS).save(root / 'extension' / 'icons' / f'{size}.png')
