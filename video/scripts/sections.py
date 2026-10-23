"""Section list shared by the audio pipeline: id, script heading number, raw file name."""
from pathlib import Path

VIDEO = Path(__file__).resolve().parent.parent
REPO = VIDEO.parent
SCRIPT_MD = REPO / "docs" / "video" / "script-th.md"
RAW = VIDEO / "audio" / "raw"
WORK = VIDEO / "audio" / "work"
MASTER = VIDEO / "audio" / "master"
DATA = VIDEO / "data"

# (id, heading number in script-th.md, original recording name in video/)
SECTIONS = [
    ("s1", "1", "แนะนำตัว"),
    ("s2", "2", "ที่มาและปัญหา"),
    ("s3", "3", "วัตถุประสงค์"),
    ("s4", "4", "ขอบเขตของระบบ"),
    ("s5", "5", "อุปกรณ์และทฤษฎี"),
    ("s6", "6", "การออกแบบระบบ"),
    ("s7", "7", "การสร้างระบบ"),
    ("s8", "8", "หลักการทำงาน"),
    ("s8-1", "8.1", "สมัครและเข้าสู่ระบบ"),
    ("s8-2", "8.2", "แผนที่และลำแสง"),
    ("s8-3", "8.3", "ค้นหากรองและรายการ"),
    ("s8-4", "8.4", "แจ้งเรื่อง"),
    ("s8-5", "8.5", "ผู้ดูแลตรวจและอนุมัติ"),
    ("s8-6", "8.6", "ชุมชนมีส่วนร่วม"),
    ("s8-7", "8.7", "ติดตามจนแก้เสร็จ"),
    ("s8-8", "8.8", "ควบคุมคุณภาพและความปลอดภัย"),
    ("s8-9", "8.9", "เรียลไทม์"),
    ("s8-10", "8.10", "ภาษาธีมแอปและหน้าส่วนตัว"),
    ("s9", "9", "การทดลองและผลลัพธ์"),
    ("s10", "10", "ปัญหาและข้อจำกัด"),
    ("s11", "11", "สรุปและแนวทางพัฒนาต่อ"),
]


def script_text() -> dict:
    """Spoken lines of script-th.md per heading number ("1".."11", "8.1".."8.10"), notes removed."""
    import re
    out, cur = {}, None
    for line in SCRIPT_MD.read_text(encoding="utf-8").splitlines():
        m = re.match(r"^#{1,3} (\d+(?:\.\d+)?)\.? ", line)
        if m:
            cur = m.group(1)
            out[cur] = []
            continue
        if line.startswith("# ") or line.startswith("## "):
            cur = None  # 12. Q&A and the facts table are not spoken
            continue
        s = line.strip()
        if cur is None or not s or s == "---" or s.startswith("|"):
            continue
        if re.match(r"^(ภาพ|ตัวเลือก|หมายเหตุ|เดโม)\b", s):
            continue
        out[cur].append(s)
    out.pop("12", None)
    return out


def script_sentences(num: str) -> list:
    """Split a section's spoken lines into sentence-sized pieces (after ครับ / line breaks)."""
    import re
    parts = []
    for line in script_text().get(num, []):
        for p in re.split(r"(?<=ครับ)\s+|(?<=ครับ:)\s*", line):
            p = p.strip(" :")
            if len(p) >= 4:
                parts.append(p)
    return parts


def raw_name(sid: str, title: str) -> str:
    """s8-1 -> 08-01-สมัครและเข้าสู่ระบบ.mp3, s5 -> 05-00-อุปกรณ์และทฤษฎี.mp3"""
    major, _, minor = sid[1:].partition("-")
    return f"{int(major):02d}-{int(minor or 0):02d}-{title}.mp3"


def raw_path(sid: str) -> Path:
    for s, _, title in SECTIONS:
        if s == sid:
            return RAW / raw_name(s, title)
    raise KeyError(sid)
