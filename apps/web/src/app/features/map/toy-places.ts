// What sits on the toy map (spec 3.2.1). Positions are real coordinates; choices are the builder's (spec 14).
import type { EmojiSlug } from './emoji';

type LngLat = [number, number];

export const PROVINCE_LABELS: { name: string; lngLat: LngLat }[] = [
  { name: 'เชียงใหม่', lngLat: [98.98, 18.79] },
  { name: 'พิษณุโลก', lngLat: [100.26, 16.82] },
  { name: 'นครสวรรค์', lngLat: [100.12, 15.7] },
  { name: 'ขอนแก่น', lngLat: [102.83, 16.43] },
  { name: 'นครราชสีมา', lngLat: [102.1, 14.97] },
  { name: 'อุบลราชธานี', lngLat: [104.86, 15.24] },
  { name: 'พระนครศรีอยุธยา', lngLat: [100.57, 14.35] },
  { name: 'กรุงเทพมหานคร', lngLat: [100.5, 13.75] },
  { name: 'กาญจนบุรี', lngLat: [99.53, 14.02] },
  { name: 'ชลบุรี', lngLat: [100.98, 13.36] },
  { name: 'ระยอง', lngLat: [101.28, 12.68] },
  { name: 'สุราษฎร์ธานี', lngLat: [99.33, 9.14] },
  { name: 'ภูเก็ต', lngLat: [98.39, 7.88] },
  { name: 'สงขลา', lngLat: [100.59, 7.19] },
  { name: 'ปัตตานี', lngLat: [101.25, 6.87] },
];

/** 3D landmarks standing on the land (and islands/boats on the sea). size is relative to 1 = 48 px. */
export const LANDMARKS: { slug: EmojiSlug; lngLat: LngLat; size: number }[] = [
  // north
  { slug: 'mountain', lngLat: [98.55, 19.35], size: 1.1 },
  { slug: 'mountain', lngLat: [100.3, 19.5], size: 0.9 },
  { slug: 'hindu-temple', lngLat: [99.35, 18.35], size: 0.9 },
  { slug: 'cherry-blossom', lngLat: [99.9, 18.1], size: 0.8 },
  // isan
  { slug: 'dragon', lngLat: [102.75, 17.6], size: 1 },
  { slug: 'sauropod', lngLat: [102.35, 16.75], size: 1 },
  { slug: 'elephant', lngLat: [103.75, 15.05], size: 1 },
  { slug: 'hindu-temple', lngLat: [103.2, 14.6], size: 0.9 },
  // centre and west
  { slug: 'hindu-temple', lngLat: [100.85, 14.65], size: 0.9 },
  { slug: 'elephant', lngLat: [99.1, 14.8], size: 0.8 },
  // east
  { slug: 'umbrella-on-ground', lngLat: [100.93, 12.85], size: 0.8 },
  { slug: 'palm-tree', lngLat: [102.25, 12.4], size: 0.8 },
  // south
  { slug: 'desert-island', lngLat: [99.95, 9.55], size: 0.9 },
  { slug: 'desert-island', lngLat: [98.75, 7.55], size: 0.9 },
  { slug: 'palm-tree', lngLat: [99.6, 8.3], size: 0.9 },
  { slug: 'speedboat', lngLat: [98.05, 8.35], size: 0.8 },
];

/** Things that drift slowly over the toy map along a path, looping every `seconds`. */
export const ROUTES: { slug: EmojiSlug; path: LngLat[]; seconds: number }[] = [
  // northern railway: Bangkok → Ayutthaya → Phitsanulok → Lampang → Chiang Mai
  { slug: 'locomotive', path: [[100.52, 13.75], [100.57, 14.35], [100.26, 16.82], [99.5, 18.29], [98.98, 18.79]], seconds: 90 },
  { slug: 'airplane', path: [[100.75, 13.69], [99.6, 16.4], [98.97, 18.77]], seconds: 60 },
  { slug: 'airplane', path: [[100.75, 13.69], [99.3, 10.8], [98.31, 8.11]], seconds: 60 },
  { slug: 'passenger-ship', path: [[100.85, 12.4], [101.6, 10.6], [100.6, 9.9], [100.2, 11.6], [100.85, 12.4]], seconds: 120 },
  { slug: 'sailboat', path: [[101.9, 11.6], [102.4, 10.2], [101.4, 9.4], [101.9, 11.6]], seconds: 120 },
  { slug: 'cloud', path: [[95.6, 17.5], [97.2, 17.5]], seconds: 150 },
  { slug: 'cloud', path: [[105.6, 12.2], [104.2, 12.2]], seconds: 150 },
  { slug: 'cloud', path: [[96.8, 9.6], [97.6, 10.4]], seconds: 150 },
  { slug: 'cloud', path: [[104.1, 8.6], [102.9, 8.2]], seconds: 150 },
];
