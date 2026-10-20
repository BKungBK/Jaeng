import { TestBed } from '@angular/core/testing';
import { SupabaseService } from '../../core/supabase.service';
import { EMPTY_COLLECTION } from './report';
import { ReportsService } from './reports.service';

function setup(response: { data: unknown; error: unknown }) {
  const rpc = vi.fn().mockResolvedValue(response);
  TestBed.configureTestingModule({
    providers: [{ provide: SupabaseService, useValue: { client: async () => ({ rpc }) } }],
  });
  return { rpc, service: TestBed.inject(ReportsService) };
}

const ALL = ['open', 'fix_claimed', 'resolved'] as const;

describe('ReportsService', () => {
  it('asks reports_in_bbox with the levels, statuses and categories chosen', async () => {
    const fc = { type: 'FeatureCollection', features: [] };
    const { rpc, service } = setup({ data: fc, error: null });
    expect(await service.inBbox([99, 12, 101, 14], { levels: [0, 2], categories: [], statuses: ALL })).toEqual(fc);
    expect(rpc).toHaveBeenCalledWith('reports_in_bbox', {
      min_lng: 99,
      min_lat: 12,
      max_lng: 101,
      max_lat: 14,
      levels: [0, 2],
      statuses: ['open', 'fix_claimed', 'resolved'],
      categories: null,
    });
    await service.inBbox([99, 12, 101, 14], { levels: [0], categories: ['flood'], statuses: ['open'] });
    expect(rpc).toHaveBeenLastCalledWith('reports_in_bbox', expect.objectContaining({ categories: ['flood'], statuses: ['open'] }));
  });

  it('sends nothing when every level is off', async () => {
    const { rpc, service } = setup({ data: null, error: null });
    expect(await service.inBbox([99, 12, 101, 14], { levels: [], categories: [], statuses: ALL })).toEqual(EMPTY_COLLECTION);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects when the RPC fails', async () => {
    const { service } = setup({ data: null, error: { message: 'boom' } });
    await expect(service.inBbox([99, 12, 101, 14], { levels: [0], categories: [], statuses: ALL })).rejects.toThrow('boom');
  });

  it('searches the whole country by title or tag and keeps the first five', async () => {
    const props = (id: string) => ({ properties: { id, title: id } });
    const fc = { type: 'FeatureCollection', features: ['a', 'b', 'c', 'd', 'e', 'f'].map(props) };
    const { rpc, service } = setup({ data: fc, error: null });
    const found = await service.search('ถนน');
    expect(found.map((r) => r.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(rpc).toHaveBeenCalledWith('reports_in_bbox', {
      min_lng: 97.3,
      min_lat: 5.6,
      max_lng: 105.7,
      max_lat: 20.5,
      statuses: ['open', 'fix_claimed', 'resolved'],
      q: 'ถนน',
    });
  });
});
