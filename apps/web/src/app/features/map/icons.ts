// Lucide icons (ISC), the app's only icon set (owner decision 2026-10-17: no emoji).
// Plain DOM for map markers and controls.
import {
  Check,
  Construction,
  createElement,
  Droplet,
  IconNode,
  Lightbulb,
  LocateFixed,
  MapPin,
  Minus,
  Plus,
  Trash2,
  TreeDeciduous,
  TriangleAlert,
  Waves,
  X,
} from 'lucide';

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
  plus: Plus,
  minus: Minus,
  locateFixed: LocateFixed,
  x: X,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export const isIconName = (name: string): name is IconName => Object.hasOwn(ICONS, name);

/** An inline SVG drawn in currentColor, hidden from assistive tech (callers label the control). */
export function iconElement(name: IconName, size = 20): SVGElement {
  const svg = createElement(ICONS[name], { width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
  svg.classList.add('icon', `icon-${name}`);
  return svg;
}
