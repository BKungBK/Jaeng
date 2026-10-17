// Bat-Signal beacon and cluster markers (spec 3.3, DESIGN.md "Beacon"). Plain DOM because
// MapLibre markers live outside Angular views; styles are in src/theme/map.scss.
// User text only ever goes in through textContent.
import { beamHeight } from '@jaeng/shared/beam';
import { CATEGORY_ICONS, CategorySlug } from '@jaeng/shared/categories';
import { DangerLevel, LEVELS, LevelInfo } from '@jaeng/shared/levels';
import { iconElement, IconName } from './icons';
import { ReportProps, STATUS_TH } from './report';
import { levelShapeSvg } from './level-shape';
import { BEAM_ZOOM } from './toy';

export const categoryIcon = (slug: CategorySlug): IconName => CATEGORY_ICONS[slug] ?? 'mapPin';

export type BeaconView = { compact: boolean; height: number; state: 'open' | 'claimed' | 'done'; level: LevelInfo };

const COMPACT_HEIGHT = 60;

export function beaconView(p: ReportProps, zoom: number): BeaconView {
  const state = p.status === 'resolved' ? 'done' : p.status === 'fix_claimed' ? 'claimed' : 'open';
  const compact = zoom < BEAM_ZOOM;
  const height = state === 'done' ? 0 : compact ? COMPACT_HEIGHT : beamHeight(p.confirm_count);
  return { compact, height, state, level: LEVELS[p.danger_level] };
}

export function beaconAriaLabel(p: ReportProps): string {
  return `${p.title} ระดับ${LEVELS[p.danger_level].nameTh} ${STATUS_TH[p.status]}`;
}

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement) {
  const node = document.createElement(tag);
  node.className = className;
  parent?.appendChild(node);
  return node;
}

function setLevelVars(node: HTMLElement, level: LevelInfo) {
  node.style.setProperty('--c', level.color);
  node.style.setProperty('--d', level.pulse);
}

function build(root: HTMLElement, p: ReportProps, view: BeaconView) {
  root.replaceChildren();
  for (let i = 0; i < view.level.rings; i++) el('i', i ? 'ring two' : 'ring', root);
  el('i', 'base', root);
  const stand = el('div', 'stand', root);
  el('div', 'beam', stand);
  const disc = el('div', 'disc', stand);
  disc.setAttribute('role', 'button');
  disc.tabIndex = 0;
  disc.dataset['id'] = p.id;
  if (view.state === 'done') {
    el('span', 'tick', disc).appendChild(iconElement('check', 18));
  } else {
    disc.appendChild(iconElement(categoryIcon(p.category), 18));
  }
  disc.appendChild(levelBadge(view.state === 'done' ? null : p.danger_level));
}

/** The small badge at the disc's lower right: the level's shape, or a tick once resolved. */
function levelBadge(level: DangerLevel | null): HTMLElement {
  const sym = el('i', 'sym');
  if (level === null) sym.appendChild(iconElement('check', 10));
  else {
    sym.setAttribute('data-level', String(level));
    sym.appendChild(levelShapeSvg(level));
  }
  return sym;
}

// Rebuild only when the look changes; label and height update in place so a focused disc survives.
const structureKey = (p: ReportProps, view: BeaconView) => `${p.category}|${p.danger_level}|${view.state}`;

export function updateBeaconElement(root: HTMLElement, p: ReportProps, view: BeaconView, showLabel: boolean): void {
  const key = structureKey(p, view);
  if (root.dataset['key'] !== key) {
    build(root, p, view);
    root.dataset['key'] = key;
  }
  const disc = root.querySelector<HTMLElement>('.disc')!;
  let lbl = root.querySelector('.lbl');
  if (showLabel && !lbl) lbl = el('span', 'lbl', disc);
  if (!showLabel && lbl) {
    lbl.remove();
    lbl = null;
  }
  root.className = `beacon st-${view.state}${view.compact ? ' compact' : ''}`;
  setLevelVars(root, view.level);
  root.style.setProperty('--h', `${view.height}px`);
  disc.setAttribute('aria-label', beaconAriaLabel(p));
  if (lbl) lbl.textContent = p.title;
}

export function createBeaconElement(p: ReportProps, view: BeaconView, showLabel: boolean): HTMLElement {
  const root = document.createElement('div');
  updateBeaconElement(root, p, view, showLabel);
  return root;
}

export function createClusterElement(count: number, maxLevel: DangerLevel): HTMLElement {
  const root = el('div', 'cluster');
  setLevelVars(root, LEVELS[maxLevel]);
  el('i', 'ring', root);
  const btn = el('button', 'count', root);
  btn.type = 'button';
  btn.textContent = String(count);
  btn.setAttribute('aria-label', `${count} เรื่องในพื้นที่นี้ ระดับสูงสุด${LEVELS[maxLevel].nameTh}`);
  btn.appendChild(levelBadge(maxLevel));
  return root;
}

/** Spec 3.3: with more than `max` labels on screen, keep the most confirmed ones. */
export function pickLabelIds(items: readonly { id: string; confirm_count: number }[], max = 12): Set<string> {
  return new Set(
    [...items]
      .sort((a, b) => b.confirm_count - a.confirm_count || a.id.localeCompare(b.id))
      .slice(0, max)
      .map((i) => i.id),
  );
}
