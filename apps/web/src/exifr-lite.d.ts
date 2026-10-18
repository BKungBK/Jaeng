// exifr ships types for its main entry only; the lite bundle has the same API (JPEG/HEIC + GPS, no XMP/ICC/IPTC).
declare module 'exifr/dist/lite.esm.mjs' {
  export { gps } from 'exifr';
}
