import { TestBed } from '@angular/core/testing';
import { I18nService } from '../../core/i18n.service';
import { FilterBarComponent } from './filter-bar.component';

function setup() {
  const fixture = TestBed.createComponent(FilterBarComponent);
  fixture.detectChanges();
  const buttons = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll('button')];
  return { fixture, buttons };
}

describe('FilterBarComponent', () => {
  it('shows the four levels, all on', () => {
    const { buttons } = setup();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['ทั่วไป', 'ควรระวัง', 'อันตราย', 'วิกฤต']);
    expect(buttons().map((b) => b.querySelector('svg')?.getAttribute('data-level'))).toEqual(['0', '1', '2', '3']);
    expect(buttons().every((b) => b.getAttribute('aria-pressed') === 'true')).toBe(true);
  });

  it('names the levels and the group in English after a switch', async () => {
    const { fixture, buttons } = setup();
    TestBed.inject(I18nService).setLocale('en');
    await fixture.whenStable();
    expect(buttons().map((b) => b.textContent?.trim())).toEqual(['Minor', 'Caution', 'Danger', 'Critical']);
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('Filter by danger level');
  });

  it('labels the group for screen readers', () => {
    const { fixture } = setup();
    const group = (fixture.nativeElement as HTMLElement).querySelector('[role="group"]');
    expect(group?.getAttribute('aria-label')).toBe('กรองตามระดับอันตราย');
  });

  it('toggles a level off and back on, keeping levels sorted', async () => {
    const { fixture, buttons } = setup();
    buttons()[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.levels()).toEqual([0, 1, 3]);
    expect(buttons()[2].getAttribute('aria-pressed')).toBe('false');

    buttons()[2].click();
    await fixture.whenStable();
    expect(fixture.componentInstance.levels()).toEqual([0, 1, 2, 3]);
  });
});
