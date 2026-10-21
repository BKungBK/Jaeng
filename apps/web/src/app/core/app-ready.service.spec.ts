import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AppReadyService } from './app-ready.service';

describe('AppReadyService', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({ providers: [provideRouter([{ path: '**', children: [] }])] });
  });
  afterEach(() => vi.useRealTimers());

  it('only ever moves up, and is ready only when done', () => {
    const s = TestBed.inject(AppReadyService);
    s.step(0.4);
    s.step(0.2);
    expect(s.progress()).toBe(0.4);
    expect(s.ready()).toBe(false);
    s.done();
    expect(s.progress()).toBe(1);
    expect(s.ready()).toBe(true);
  });

  it('waits for the map when the first page is the map', async () => {
    const s = TestBed.inject(AppReadyService);
    await TestBed.inject(Router).navigateByUrl('/r/abc');
    await vi.advanceTimersByTimeAsync(1000);
    expect(s.ready()).toBe(false);
  });

  it('is ready soon after a first page that is not the map', async () => {
    const s = TestBed.inject(AppReadyService);
    await TestBed.inject(Router).navigateByUrl('/list');
    await vi.advanceTimersByTimeAsync(300);
    expect(s.ready()).toBe(true);
  });
});
