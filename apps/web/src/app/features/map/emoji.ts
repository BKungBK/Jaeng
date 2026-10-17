// Microsoft Fluent Emoji 3D images (MIT) served from assets/emoji/<slug>.png.
// scripts/fetch-emoji.sh downloads exactly this list.
export const EMOJI_SLUGS = [
  // category icons
  'hole',
  'light-bulb',
  'droplet',
  'water-wave',
  'wastebasket',
  'deciduous-tree',
  'warning',
  'round-pushpin',
  // toy map landmarks and movers
  'hindu-temple',
  'elephant',
  'dragon',
  'sauropod',
  'mountain',
  'cherry-blossom',
  'desert-island',
  'palm-tree',
  'umbrella-on-ground',
  'speedboat',
  'passenger-ship',
  'sailboat',
  'locomotive',
  'airplane',
  'compass',
  'cloud',
] as const;

export type EmojiSlug = (typeof EMOJI_SLUGS)[number];

export const emojiUrl = (slug: EmojiSlug) => `assets/emoji/${slug}.png`;
