"""Pack the twelve transparent offline clock frames. Requires Pillow."""
from pathlib import Path
from PIL import Image
import json
import os

folder = Path('src/assets/connection/capsule-clock')
temporary = Path(os.environ.get('CX_3D_EVIDENCE_DIR', '/tmp/cx-3d-evidence')) / 'clock'
frames = [Image.open(temporary / f'frame-{i:02}.webp').convert('RGBA') for i in range(12)]
sheet = Image.new('RGBA', (256 * 12, 180))
for i, frame in enumerate(frames):
    sheet.paste(frame, (256 * i, 0))
sheet.save(folder / 'capsule-clock-sprite.webp', quality=90, method=4)
frames[0].save(folder / 'capsule-clock-still.webp', quality=90, method=4)
sheet.resize((1536, 90)).save(temporary / 'clock-frame-sheet.png')
matrices = [json.loads((temporary / f'frame-{i}-matrices.json').read_text()) for i in range(12)]
assert len({tuple(values) for values in matrices}) == 12, 'All twelve bead poses must differ'
assert all(frame.getchannel('A').getextrema() == (0, 255) for frame in frames), 'Transparent frame margins required'
print('ok clock: 12 distinct bead poses, transparent frames, 3072×180 sheet')
