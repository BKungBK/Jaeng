// Lucide icons (ISC), the app's only icon set (owner decision 2026-10-17: no emoji).
// Plain DOM for map markers, a "sticker" image for MapLibre symbol layers.
import {
  Check,
  Cloud,
  Compass,
  Construction,
  createElement,
  Droplet,
  Flower2,
  IconNode,
  Landmark,
  Lightbulb,
  MapPin,
  Mountain,
  Plane,
  Sailboat,
  Ship,
  TrainFront,
  Trash2,
  TreeDeciduous,
  TreePalm,
  TriangleAlert,
  Umbrella,
  Waves,
} from 'lucide';
import type { Map as MlMap } from 'maplibre-gl';

export const ICONS = {
  construction: Construction,
  lightbulb: Lightbulb,
  droplet: Droplet,
  waves: Waves,
  trash2: Trash2,
  treeDeciduous: TreeDeciduous,
  triangleAlert: TriangleAlert,
  mapPin: MapPin,
  check: Check,
  mountain: Mountain,
  landmark: Landmark,
  flower2: Flower2,
  treePalm: TreePalm,
  umbrella: Umbrella,
  sailboat: Sailboat,
  ship: Ship,
  trainFront: TrainFront,
  plane: Plane,
  cloud: Cloud,
  compass: Compass,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export const isIconName = (name: string): name is IconName => Object.hasOwn(ICONS, name);

/** Sticker colours: cream paper, ink outline (DESIGN.md "Cel map"). */
export const STICKER = { paper: '#FFF8EC', ink: '#2B2A33' };

/** An inline SVG drawn in currentColor, hidden from assistive tech (callers label the control). */
export function iconElement(name: IconName, size = 20): SVGElement {
  const svg = createElement(ICONS[name], { width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
  svg.classList.add('icon', `icon-${name}`);
  return svg;
}

const escapeAttr = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

function nodeMarkup(node: IconNode): string {
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k]) => k !== 'key')
        .map(([k, v]) => `${k}="${escapeAttr(v as string | number)}"`)
        .join(' ');
      return `<${tag} ${a}/>`;
    })
    .join('');
}

/** A cream disc with an ink rim and the icon in ink, as standalone SVG markup of `px` × `px`. */
export function stickerSvg(name: IconName, px: number): string {
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 32 32">` +
    `<circle cx="16" cy="16" r="14.6" fill="${STICKER.paper}" stroke="${STICKER.ink}" stroke-width="2.2"/>` +
    `<g transform="translate(6.4 6.4) scale(0.8)" fill="none" stroke="${STICKER.ink}" stroke-width="2.2" ` +
    `stroke-linecap="round" stroke-linejoin="round">${nodeMarkup(ICONS[name])}</g></svg>`
  );
}

export type ImageLoader = (src: string, px: number) => Promise<HTMLImageElement>;

const loadSvgImage: ImageLoader = async (src, px) => {
  const img = new Image(px, px);
  img.src = src;
  await img.decode();
  return img;
};

/** Registers the sticker as a MapLibre image named after the icon, drawn at the screen's pixel ratio. */
export async function addStickerImage(
  map: Pick<MlMap, 'addImage' | 'hasImage'>,
  name: IconName,
  px = 96,
  load: ImageLoader = loadSvgImage,
): Promise<void> {
  if (map.hasImage(name)) return;
  const ratio = Math.max(1, Math.round(globalThis.devicePixelRatio || 1));
  const img = await load(`data:image/svg+xml;charset=utf-8,${encodeURIComponent(stickerSvg(name, px * ratio))}`, px * ratio);
  if (!map.hasImage(name)) map.addImage(name, img, { pixelRatio: ratio });
}
