"""Copy the recorded mp3s from video/ into audio/raw/ with ordered names (originals stay)."""
import shutil
from sections import SECTIONS, VIDEO, RAW, raw_name

RAW.mkdir(parents=True, exist_ok=True)
missing = []
for sid, _, title in SECTIONS:
    src = VIDEO / f"{title}.mp3"
    dst = RAW / raw_name(sid, title)
    if not src.exists():
        missing.append(src.name)
        continue
    if not dst.exists() or dst.stat().st_size != src.stat().st_size:
        shutil.copy2(src, dst)
print(f"copied {len(SECTIONS) - len(missing)} files to {RAW}")
if missing:
    print("MISSING:", ", ".join(missing))
