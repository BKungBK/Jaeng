import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n.service';
import { StatsLineComponent, type StatsState } from './stats-line.component';

function setup(state: StatsState) {
  const fixture = TestBed.createComponent(StatsLineComponent);
  fixture.componentRef.setInput('state', state);
  fixture.detectChanges();
  return { fixture, root: fixture.nativeElement as HTMLElement };
}

describe('StatsLineComponent', () => {
  it('shows a dash for both numbers before the first answer', () => {
    const { root } = setup('loading');
    expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe('เดือนนี้แก้แล้ว — เรื่อง · ค้างอยู่ — เรื่อง');
  });

  it('shows the numbers with their icons', () => {
    const { root } = setup({ resolved_this_month: 3, open_count: 12 });
    const text = root.textContent?.replace(/\s+/g, ' ').trim();
    expect(text).toBe('เดือนนี้แก้แล้ว 3 เรื่อง · ค้างอยู่ 12 เรื่อง');
    expect(root.querySelector('svg.icon-circleCheck')).not.toBeNull();
    expect(root.querySelector('svg.icon-clock')).not.toBeNull();
  });

  it('hides itself on an error', () => {
    const { root } = setup('error');
    expect(root.textContent?.trim()).toBe('');
  });

  it('speaks English after a switch', async () => {
    const { root, fixture } = setup({ resolved_this_month: 3, open_count: 1 });
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    expect(root.textContent?.replace(/\s+/g, ' ').trim()).toBe('Fixed this month: 3 · Still open: 1');
  });
});
