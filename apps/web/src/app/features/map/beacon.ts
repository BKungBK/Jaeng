// Bat-Signal beacon and cluster markers (spec 3.3, DESIGN.md "Beacon"). Plain DOM because
// MapLibre markers live outside Angular views; styles are in src/theme/map.scss.
// User text only ever goes in through textContent.
import { beamHeight } from '@jaeng/shared/beam';
import type { CategorySlug } from '@jaeng/shared/categories';
import { DangerLevel, LEVELS, LevelInfo } from '@jaeng/shared/levels';
import { EmojiSlug, emojiUrl } from './emoji';
import { ReportProps, STATUS_TH } from './report';
import { BEAM_ZOOM } from './toy';

const CATEGORY_EMOJI: Record<CategorySlug, EmojiSlug> = {
  road: 'hole',
  light: 'light-bulb',
  water: 'droplet',
  flood: 'water-wave',
  waste: 'wastebasket',
  tree: 'deciduous-tree',
  hazard: 'warning',
  other: 'round-pushpin',
};

export const categoryIconUrl = (slug: CategorySlug) => emojiUrl(CATEGORY_EMOJI[slug] ?? 'round-pushpin');

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

function build(root: HTMLElement, p: ReportProps, view: BeaconView, showLabel: boolean) {
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
    el('span', 'tick', disc).textContent = '✓';
  } else {
    const img = el('img', 'icon', disc);
    img.src = categoryIconUrl(p.category);
    img.alt = '';
    img.draggable = false;
  }
  el('i', 'sym', disc).textContent = view.state === 'done' ? '✓' : view.level.symbol;
  if (showLabel) el('span', 'lbl', disc);
}

const structureKey = (p: ReportProps, view: BeaconView, showLabel: boolean) =>
  `${p.category}|${p.danger_level}|${view.state}|${showLabel}`;

export function updateBeaconElement(root: HTMLElement, p: ReportProps, view: BeaconView, showLabel: boolean): void {
  const key = structureKey(p, view, showLabel);
  if (root.dataset['key'] !== key) {
    build(root, p, view, showLabel);
    root.dataset['key'] = key;
  }
  root.className = `beacon st-${view.state}${view.compact ? ' compact' : ''}`;
  setLevelVars(root, view.level);
  root.style.setProperty('--h', `${view.height}px`);
  const disc = root.querySelector<HTMLElement>('.disc')!;
  disc.setAttribute('aria-label', beaconAriaLabel(p));
  const lbl = root.querySelector('.lbl');
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
  btn.setAttribute('aria-label', `${count} เรื่องในพื้นที่นี้`);
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
