import { expect, test } from 'bun:test';
import { CATEGORY_ICONS, CATEGORY_SLUGS } from '../categories';
import { LEVELS, REPORT_STATUSES } from '../levels';

test('level colours match the prototype palette', () => {
  expect(LEVELS.map((l) => l.color)).toEqual(['#8FD3B6', '#F6D983', '#F4A582', '#E57373']);
});

test('level names, shapes, pulse and rings', () => {
  expect(LEVELS.map((l) => [l.level, l.nameTh, l.nameEn, l.shape, l.pulse, l.rings])).toEqual([
    [0, 'ทั่วไป', 'Minor', 'circle', '3s', 1],
    [1, 'ควรระวัง', 'Caution', 'triangle', '2.4s', 1],
    [2, 'อันตราย', 'Danger', 'diamond', '1.6s', 2],
    [3, 'วิกฤต', 'Critical', 'alert', '1s', 2],
  ]);
});

test('category icons are Lucide names, never emoji', () => {
  expect(CATEGORY_SLUGS.map((s) => CATEGORY_ICONS[s])).toEqual([
    'construction',
    'lightbulb',
    'droplet',
    'waves',
    'trash2',
    'treeDeciduous',
    'triangleAlert',
    'mapPin',
  ]);
});

test('statuses match the database check constraint', () => {
  expect(REPORT_STATUSES).toEqual(['pending_review', 'open', 'fix_claimed', 'resolved', 'rejected', 'hidden']);
});

test('category slugs in display order', () => {
  expect(CATEGORY_SLUGS).toEqual(['road', 'light', 'water', 'flood', 'waste', 'tree', 'hazard', 'other']);
});
