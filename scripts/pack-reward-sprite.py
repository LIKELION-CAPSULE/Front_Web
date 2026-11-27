"""Pack the offline render frames; requires Pillow, never runs in the application."""
from pathlib import Path
from PIL import Image
import os

folder = Path(os.environ.get('CX_3D_EVIDENCE_DIR', '/tmp/cx-3d-evidence')) / 'reward'
frames = [Image.open(folder / f'reward-{i:02}.webp').convert('RGBA') for i in range(12)]
frames[0].save('src/assets/attendance/path/reward-capsule.webp', quality=90, method=6)
frames[0].save('src/assets/attendance/path/reward-opening.webp', save_all=True, append_images=frames[1:], duration=100, loop=1, quality=90, method=6)
w, h = frames[0].size
sheet = Image.new('RGBA', (w * 6, h * 2))
for i, frame in enumerate(frames):
    sheet.paste(frame, (i % 6 * w, i // 6 * h))
sheet.save(folder / 'reward-frame-sheet.png')
for name in ['hangup-handset-3d', 'hangup-handset-3d-red']:
    Image.open(folder / f'{name}-after.png').resize((480, 480), Image.Resampling.LANCZOS).save(
        f'src/assets/connection/{name}.webp', quality=90, method=6)
