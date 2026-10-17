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

describe('ReportsService', () => {
  it('asks reports_in_bbox for every public status at the chosen levels', async () => {
    const fc = { type: 'FeatureCollection', features: [] };
    const { rpc, service } = setup({ data: fc, error: null });
    expect(await service.inBbox([99, 12, 101, 14], [0, 2])).toEqual(fc);
    expect(rpc).toHaveBeenCalledWith('reports_in_bbox', {
      min_lng: 99,
      min_lat: 12,
      max_lng: 101,
      max_lat: 14,
      levels: [0, 2],
      statuses: ['open', 'fix_claimed', 'resolved'],
    });
  });

  it('sends nothing when every level is off', async () => {
    const { rpc, service } = setup({ data: null, error: null });
    expect(await service.inBbox([99, 12, 101, 14], [])).toEqual(EMPTY_COLLECTION);
    expect(rpc).not.toHaveBeenCalled();
  });

  it('rejects when the RPC fails', async () => {
    const { service } = setup({ data: null, error: { message: 'boom' } });
    await expect(service.inBbox([99, 12, 101, 14], [0])).rejects.toThrow('boom');
  });
});
