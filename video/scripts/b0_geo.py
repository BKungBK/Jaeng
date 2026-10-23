"""Thailand provinces (the app's own apps/web/src/assets/geo/provinces.json) -> SVG paths for Remotion.

Equirectangular projection with cos(lat) correction, fitted into a 900 x 1600 box.
Writes src/data/thailand.json: {w, h, provinces: [{code, name, region, d, cx, cy}]}.
"""
import json
import math
from sections import REPO, VIDEO

src = json.loads((REPO / "apps/web/src/assets/geo/provinces.json").read_text(encoding="utf-8"))
K = math.cos(math.radians(13.5))


def rings(geom):
    if geom["type"] == "Polygon":
        return geom["coordinates"]
    return [r for poly in geom["coordinates"] for r in poly]


pts = [(lon * K, -lat) for f in src["features"] for r in rings(f["geometry"]) for lon, lat in r]
x0, x1 = min(p[0] for p in pts), max(p[0] for p in pts)
y0, y1 = min(p[1] for p in pts), max(p[1] for p in pts)
W, H = 900, 1600
s = min(W / (x1 - x0), H / (y1 - y0))
w, h = round((x1 - x0) * s, 1), round((y1 - y0) * s, 1)


def xy(lon, lat):
    return (lon * K - x0) * s, (-lat - y0) * s


out = []
for f in src["features"]:
    parts, sx, sy, n = [], 0.0, 0.0, 0
    for r in rings(f["geometry"]):
        cmds = []
        last = None
        for lon, lat in r:
            x, y = xy(lon, lat)
            p = (round(x, 1), round(y, 1))
            if p != last:
                cmds.append(f"{p[0]} {p[1]}")
                last = p
                sx, sy, n = sx + x, sy + y, n + 1
        parts.append("M" + " L".join(cmds) + "Z")
    pr = f["properties"]
    out.append({"code": pr.get("pcode"), "name": pr.get("name_th"), "region": pr.get("region"),
                "d": "".join(parts), "cx": round(sx / n, 1), "cy": round(sy / n, 1)})
dst = VIDEO / "src" / "data" / "thailand.json"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(json.dumps({"w": w, "h": h, "provinces": out}, ensure_ascii=False), encoding="utf-8")
print(f"{len(out)} provinces, box {w} x {h}, {dst.stat().st_size // 1024} KB, regions {sorted({p['region'] for p in out})}")
