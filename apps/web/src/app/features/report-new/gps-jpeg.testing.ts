// Test helper: a real tiny JPEG with an EXIF GPS IFD, built byte by byte (shared by the photo-tools
// and report-draft specs, so the draft's location logic runs through the real exifr reader).

export type Gps = { lat: number; latRef: 'N' | 'S'; lng: number; lngRef: 'E' | 'W' };

/** degrees, minutes and seconds (in thousandths) of a non-negative decimal angle */
function dms(v: number): [number, number, number] {
  const d = Math.floor(v);
  const mFull = (v - d) * 60;
  const m = Math.floor(mFull);
  return [d, m, Math.round((mFull - m) * 60 * 1000)];
}

export function gpsJpeg(g: Gps): Uint8Array {
  const tiff = new Uint8Array(128);
  const dv = new DataView(tiff.buffer);
  const LE = true;
  tiff.set([0x49, 0x49]); // 'II'
  dv.setUint16(2, 42, LE);
  dv.setUint32(4, 8, LE); // IFD0 at 8
  // IFD0: one entry, GPSInfo pointer
  dv.setUint16(8, 1, LE);
  dv.setUint16(10, 0x8825, LE);
  dv.setUint16(12, 4, LE); // LONG
  dv.setUint32(14, 1, LE);
  dv.setUint32(18, 26, LE); // GPS IFD offset
  dv.setUint32(22, 0, LE); // no next IFD
  // GPS IFD at 26: four entries, sorted by tag
  dv.setUint16(26, 4, LE);
  const entry = (i: number, tag: number, type: number, count: number, value: number | number[]) => {
    const o = 28 + i * 12;
    dv.setUint16(o, tag, LE);
    dv.setUint16(o + 2, type, LE);
    dv.setUint32(o + 4, count, LE);
    if (typeof value === 'number') dv.setUint32(o + 8, value, LE);
    else tiff.set(value, o + 8);
  };
  entry(0, 0x0001, 2, 2, [g.latRef.charCodeAt(0), 0]);
  entry(1, 0x0002, 5, 3, 80);
  entry(2, 0x0003, 2, 2, [g.lngRef.charCodeAt(0), 0]);
  entry(3, 0x0004, 5, 3, 104);
  dv.setUint32(28 + 48, 0, LE); // no next IFD
  const rationals = (at: number, [d, m, s]: [number, number, number]) => {
    dv.setUint32(at, d, LE);
    dv.setUint32(at + 4, 1, LE);
    dv.setUint32(at + 8, m, LE);
    dv.setUint32(at + 12, 1, LE);
    dv.setUint32(at + 16, s, LE);
    dv.setUint32(at + 20, 1000, LE);
  };
  rationals(80, dms(g.lat));
  rationals(104, dms(g.lng));

  const exifHead = [0x45, 0x78, 0x69, 0x66, 0, 0]; // 'Exif\0\0'
  const app1Len = 2 + exifHead.length + tiff.length;
  const out = new Uint8Array(2 + 2 + 2 + exifHead.length + tiff.length + 2);
  let o = 0;
  out.set([0xff, 0xd8, 0xff, 0xe1, app1Len >> 8, app1Len & 0xff], o);
  o += 6;
  out.set(exifHead, o);
  o += exifHead.length;
  out.set(tiff, o);
  o += tiff.length;
  out.set([0xff, 0xd9], o);
  return out;
}

export const blobOf = (bytes: Uint8Array) => new Blob([bytes as BlobPart], { type: 'image/jpeg' });

/** A File the draft service can take: a GPS-tagged JPEG, or plain bytes without EXIF. */
export function photoFile(name: string, gps?: Gps): File {
  const bytes = gps ? gpsJpeg(gps) : new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  return new File([bytes as BlobPart], name, { type: 'image/jpeg' });
}
