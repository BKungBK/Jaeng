import { computed } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from './api.service';
import { I18nService, LOCALE_STORAGE_KEY } from './i18n.service';
import { th } from '../i18n/th';
import { en } from '../i18n/en';

function make() {
  TestBed.resetTestingModule();
  return TestBed.inject(I18nService);
}

describe('I18nService', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.lang = 'th';
  });
  afterEach(() => vi.restoreAllMocks());

  it('starts in Thai and unchosen', () => {
    const s = make();
    expect(s.locale()).toBe('th');
    expect(s.chosen()).toBe(false);
  });

  it('starts in the stored locale', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'en');
    const s = make();
    expect(s.locale()).toBe('en');
    expect(s.chosen()).toBe(true);
    expect(document.documentElement.lang).toBe('en');
  });

  it('ignores a stored value that is not a locale', () => {
    localStorage.setItem(LOCALE_STORAGE_KEY, 'fr');
    const s = make();
    expect(s.locale()).toBe('th');
    expect(s.chosen()).toBe(false);
  });

  it('switches text, <html lang>, title and storage', () => {
    const s = make();
    expect(s.t('common.close')).toBe('ปิด');
    s.setLocale('en');
    expect(s.t('common.close')).toBe('Close');
    expect(document.documentElement.lang).toBe('en');
    expect(document.title).toBe('Jaeng');
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe('en');
    expect(s.chosen()).toBe(true);
  });

  it('survives a storage that throws on read and write', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('denied');
    });
    const s = make();
    expect(s.locale()).toBe('th');
    expect(() => s.setLocale('en')).not.toThrow();
    expect(s.locale()).toBe('en');
  });

  it('fills placeholders and leaves unknown ones as written', () => {
    const s = make();
    expect(s.t('common.reportCount', { n: 3 })).toBe('3 เรื่อง');
    expect(s.t('common.reportCount')).toBe('{n} เรื่อง');
  });

  it('picks English singular or plural', () => {
    const s = make();
    s.setLocale('en');
    expect(s.t('age.days', { n: 1 })).toBe('Open for 1 day');
    expect(s.t('age.days', { n: 4 })).toBe('Open for 4 days');
    expect(s.t('common.reportCount', { n: 1 })).toBe('1 report');
  });

  it('adopts the profile locale only while the reader has not chosen', () => {
    const s = make();
    s.adoptProfileLocale('en');
    expect(s.locale()).toBe('en');

    localStorage.setItem(LOCALE_STORAGE_KEY, 'th');
    const t = make();
    t.adoptProfileLocale('en');
    expect(t.locale()).toBe('th');
  });

  it('words API errors in the current language', () => {
    const s = make();
    const e = new ApiError(429, 'rate_limited', 'วันนี้ครบแล้ว', 'Too many today');
    expect(s.errorText(e)).toBe('วันนี้ครบแล้ว');
    s.setLocale('en');
    expect(s.errorText(e)).toBe('Too many today');
  });

  it('says keys, errors and nothing, in the current language', () => {
    const s = make();
    expect(s.say(null)).toBe('');
    expect(s.say({ key: 'common.reportCount', params: { n: 2 } })).toBe('2 เรื่อง');
    expect(s.say('common.close')).toBe('ปิด');
    expect(s.say('free text')).toBe('free text');
    s.setLocale('en');
    expect(s.say('common.close')).toBe('Close');
    expect(s.say({ error: new ApiError(500, 'internal', 'ก', 'boom') })).toBe('boom');
  });

  it('words anything else as the internal error', () => {
    const s = make();
    expect(s.errorText(new Error('x'))).toBe(th.errors.internal);
    s.setLocale('en');
    expect(s.errorText('nope')).toBe(en.errors.internal);
  });

  it('names levels by locale', () => {
    const s = make();
    expect(s.levelName(3)).toBe('วิกฤต');
    s.setLocale('en');
    expect(s.levelName(3)).toBe('Critical');
  });

  it('formats times by locale', () => {
    const s = make();
    const now = Date.parse('2026-10-17T12:00:00Z');
    expect(s.ago('2026-10-17T11:55:00Z', now)).toBe('5 นาทีที่แล้ว');
    s.setLocale('en');
    expect(s.ago('2026-10-17T11:55:00Z', now)).toBe('5 minutes ago');
    expect(s.date('2026-10-17T00:00:00Z')).toBe('17 Oct 2026');
  });

  it('calls watchers on every change until stopped', () => {
    const s = make();
    const fn = vi.fn();
    const stop = s.watch(fn);
    s.setLocale('en');
    expect(fn).toHaveBeenLastCalledWith('en');
    stop();
    s.setLocale('th');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('recomputes a computed that reads t()', () => {
    const s = make();
    const c = computed(() => s.t('common.close'));
    expect(c()).toBe('ปิด');
    s.setLocale('en');
    expect(c()).toBe('Close');
  });
});

describe('dictionaries', () => {
  type Tree = { [k: string]: string | Tree };
  const leaves = (o: Tree, p = ''): [string, string][] =>
    Object.entries(o).flatMap(([k, v]) => (typeof v === 'string' ? [[p + k, v] as [string, string]] : leaves(v, `${p}${k}.`)));
  const thLeaves = leaves(th as unknown as Tree);
  const enLeaves = new Map(leaves(en as unknown as Tree));
  const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

  it('has a non-empty string at every leaf in both languages', () => {
    for (const [, v] of thLeaves) expect(v.trim()).not.toBe('');
    for (const [, v] of enLeaves) expect(v.trim()).not.toBe('');
    expect(enLeaves.size).toBe(thLeaves.length);
  });

  it('uses the same placeholders in both languages', () => {
    for (const [k, v] of thLeaves) expect([k, holes(enLeaves.get(k) ?? '')]).toEqual([k, holes(v)]);
  });

  it('has no Thai in English', () => {
    for (const [k, v] of enLeaves) expect([k, /[฀-๿]/.test(v)]).toEqual([k, false]);
  });

  it('never claims photos are blurred', () => {
    for (const [k, v] of [...thLeaves, ...enLeaves]) {
      if (/ยังไม่ได้เบลอ|not blurred yet/i.test(v)) continue;
      expect([k, /เบลอ|blur/i.test(v)]).toEqual([k, false]);
    }
  });
});
