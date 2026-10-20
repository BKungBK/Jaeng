import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { I18nService } from '../core/i18n.service';
import { TPipe } from './t.pipe';

@Component({
  selector: 'app-t-probe',
  template: `<p>{{ 'common.close' | t }}</p><p>{{ 'common.reportCount' | t: { n: 2 } }}</p>`,
  imports: [TPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class Probe {}

describe('TPipe', () => {
  beforeEach(() => localStorage.clear());

  it('re-renders an OnPush view when the locale changes', async () => {
    const fixture = TestBed.createComponent(Probe);
    await fixture.whenStable();
    const ps = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('p')].map((p) => p.textContent);
    expect(ps()).toEqual(['ปิด', '2 เรื่อง']);
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    expect(ps()).toEqual(['Close', '2 reports']);
  });
});
