"""Convert offline handset stills; legacy filename retained for existing commands.

The attendance reward uses its original cutout, so this script must never overwrite it.
Requires Pillow; never runs in the application.
"""
from pathlib import Path
from PIL import Image
import os

folder = Path(os.environ.get('CX_3D_EVIDENCE_DIR', '/tmp/cx-3d-evidence')) / 'reward'
for name in ['hangup-handset-3d', 'hangup-handset-3d-red']:
    Image.open(folder / f'{name}-after.png').resize((480, 480), Image.Resampling.LANCZOS).save(
        f'src/assets/connection/{name}.webp', quality=90, method=6)
