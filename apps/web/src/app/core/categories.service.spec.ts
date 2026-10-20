import { TestBed } from '@angular/core/testing';
import { CategoriesService } from './categories.service';
import { I18nService } from './i18n.service';
import { SupabaseService } from './supabase.service';

function setup(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const select = vi.fn().mockReturnValue({ order });
  const from = vi.fn().mockReturnValue({ select });
  const client = vi.fn().mockResolvedValue({ from });
  TestBed.configureTestingModule({ providers: [{ provide: SupabaseService, useValue: { client } }] });
  return { from, select, order, service: TestBed.inject(CategoriesService) };
}

const rows = [
  { id: 1, slug: 'road', name_th: 'ถนน', name_en: 'Roads', icon: 'construction', default_level: 1 },
  { id: 2, slug: 'light', name_th: 'ไฟ', name_en: 'Lights', icon: 'lightbulb', default_level: 1 },
];

describe('CategoriesService', () => {
  it('reads the categories table ordered by sort', async () => {
    const { service, from, select, order } = setup({ data: rows, error: null });
    expect(await service.list()).toEqual(rows);
    expect(from).toHaveBeenCalledWith('categories');
    expect(select).toHaveBeenCalledWith('id, slug, name_th, name_en, icon, default_level');
    expect(order).toHaveBeenCalledWith('sort', { ascending: true });
  });

  it('calls supabase once even when list() is called twice', async () => {
    const { service, from } = setup({ data: rows, error: null });
    const [a, b] = await Promise.all([service.list(), service.list()]);
    await service.list();
    expect(a).toBe(b);
    expect(from).toHaveBeenCalledTimes(1);
  });

  it('names categories in the current language, and nothing until loaded', async () => {
    const { service } = setup({ data: rows, error: null });
    expect(service.names()).toEqual({});
    await service.list();
    expect(service.names()).toEqual({ road: 'ถนน', light: 'ไฟ' });
    TestBed.inject(I18nService).setLocale('en');
    expect(service.names()).toEqual({ road: 'Roads', light: 'Lights' });
    expect(service.labelOf(rows[0] as never)).toBe('Roads');
  });

  it('forgets a failed load so the next call retries', async () => {
    const { service, order } = setup({ data: null, error: new Error('x') });
    await expect(service.list()).rejects.toBeTruthy();
    order.mockResolvedValueOnce({ data: rows, error: null });
    expect(await service.list()).toEqual(rows);
  });
});
