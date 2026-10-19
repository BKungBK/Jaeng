import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { NavController } from '@ionic/angular';
import { MapReturnService } from './map-return.service';

function setup(popped: boolean) {
  const order: string[] = [];
  const nav = { pop: vi.fn(async () => (order.push('pop'), popped)) };
  const router = { navigate: vi.fn(async (cmd: unknown[]) => (order.push(cmd.join('')), true)) };
  TestBed.configureTestingModule({
    providers: [
      { provide: NavController, useValue: nav },
      { provide: Router, useValue: router },
    ],
  });
  return { back: TestBed.inject(MapReturnService), nav, router, order };
}

describe('MapReturnService', () => {
  it('goes back to the map page already in the stack', async () => {
    const { back, router, order } = setup(true);
    await back.go();
    expect(order).toEqual(['pop']);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('opens the map fresh when /report was the first page', async () => {
    const { back, router } = setup(false);
    await back.go();
    expect(router.navigate).toHaveBeenCalledWith(['/'], { replaceUrl: true });
  });

  it('then opens a report on that same map, with a toast for it', async () => {
    const { back, router, order } = setup(true);
    await back.go(['/r', 'd1'], 'ขอบคุณนะ นับให้แล้ว');
    expect(order).toEqual(['pop', '/rd1']);
    expect(router.navigate).toHaveBeenLastCalledWith(['/r', 'd1'], { state: { toast: 'ขอบคุณนะ นับให้แล้ว' } });
  });
});
