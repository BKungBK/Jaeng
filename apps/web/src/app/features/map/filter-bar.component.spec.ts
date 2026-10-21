import { TestBed } from '@angular/core/testing';
import { FilterState } from '../../core/filter-state.service';
import { I18nService } from '../../core/i18n.service';
import { provideCategories } from '../report-new/categories.testing';
import { FilterBarComponent } from './filter-bar.component';

function setup() {
  const fixture = TestBed.createComponent(FilterBarComponent);
  fixture.detectChanges();
  const buttons = () => [...(fixture.nativeElement as HTMLElement).querySelectorAll<HTMLButtonElement>('button.chip')];
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
    expect(TestBed.inject(FilterState).levels()).toEqual([0, 1, 3]);
    expect(buttons()[2].getAttribute('aria-pressed')).toBe('false');

    buttons()[2].click();
    await fixture.whenStable();
    expect(TestBed.inject(FilterState).levels()).toEqual([0, 1, 2, 3]);
  });

  it('settles a chip only when it is switched back on, not when the map first shows all four', async () => {
    const { fixture, buttons } = setup();
    expect(buttons().some((b) => b.classList.contains('back'))).toBe(false);
    buttons()[1].click();
    await fixture.whenStable();
    expect(buttons()[1].classList.contains('back')).toBe(false); // switching off plays no settle
    buttons()[1].click();
    await fixture.whenStable();
    expect(buttons()[1].classList.contains('back')).toBe(true);
    expect(buttons()[0].classList.contains('back')).toBe(false);
  });
});

describe('FilterBarComponent more filters (plan 6)', () => {
  const setupMore = () => {
    TestBed.configureTestingModule({ providers: [provideCategories()] });
    const fixture = TestBed.createComponent(FilterBarComponent);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const more = () => root.querySelector<HTMLButtonElement>('button.more')!;
    const settle = async () => {
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      fixture.detectChanges();
    };
    return { fixture, root, more, settle };
  };

  it('marks itself open (the map lifts it over the dock) and closes on a press anywhere else', async () => {
    const { fixture, more, root, settle } = setupMore();
    document.body.appendChild(root);
    more().click();
    await settle();
    expect(root.classList).toContain('open');
    // a press inside the panel keeps it
    root.querySelector('app-filters-panel h2')!.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();
    expect(root.querySelector('app-filters-panel')).not.toBeNull();
    // the panel's own backdrop is trapped inside a glass parent on wide screens: the page itself listens
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    await settle();
    expect(root.querySelector('app-filters-panel')).toBeNull();
    expect(root.classList).not.toContain('open');
    root.remove();
    fixture.destroy();
  });

  it('ends the tray with a 44 px more-filters button that counts what is on', async () => {
    const { more, settle } = setupMore();
    expect(more().getAttribute('aria-label')).toBe('ตัวกรองเพิ่มเติม');
    expect(more().querySelector('.count')).toBeNull();
    const f = TestBed.inject(FilterState);
    f.toggleCategory('flood');
    f.showResolved.set(false);
    await settle();
    expect(more().querySelector('.count')?.textContent).toBe('2');
    expect(more().getAttribute('aria-label')).toBe('ตัวกรองเพิ่มเติม (เปิดอยู่ 2)');
  });

  it('opens the panel with the eight categories, toggles them, clears, and closes with Escape back to the button', async () => {
    const { more, root, settle } = setupMore();
    more().click();
    await settle();
    expect(more().getAttribute('aria-expanded')).toBe('true');
    const cats = [...root.querySelectorAll<HTMLButtonElement>('app-filters-panel .cat')];
    expect(cats).toHaveLength(8);
    expect(cats[0].textContent?.trim()).toBe('ถนน/ทางเท้า');
    cats[3].click();
    await settle();
    expect(TestBed.inject(FilterState).categories()).toEqual(['flood']);
    expect(root.querySelectorAll('app-filters-panel .cat')[3].getAttribute('aria-pressed')).toBe('true');
    root.querySelector<HTMLButtonElement>('app-filters-panel .btn:not(.primary)')!.click();
    await settle();
    expect(TestBed.inject(FilterState).extraCount()).toBe(0);
    root.querySelector('app-filters-panel section')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await settle();
    expect(root.querySelector('app-filters-panel')).toBeNull();
    expect(document.activeElement).toBe(more());
  });

  it('is a modal dialog: Tab goes round inside it, Shift+Tab from the first control to the last', async () => {
    const { more, root, settle } = setupMore();
    document.body.appendChild(root);
    more().click();
    await settle();
    const panel = root.querySelector('app-filters-panel section')!;
    expect(panel.getAttribute('aria-modal')).toBe('true');
    const items = [...panel.querySelectorAll<HTMLElement>('button')];
    const first = items[0];
    const last = items[items.length - 1];
    last.focus();
    const tab = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    last.dispatchEvent(tab);
    expect(tab.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(first);
    const back = new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true });
    first.dispatchEvent(back);
    expect(back.defaultPrevented).toBe(true);
    expect(document.activeElement).toBe(last);
    // in the middle the browser's own Tab order is left alone
    items[1].focus();
    const mid = new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true });
    items[1].dispatchEvent(mid);
    expect(mid.defaultPrevented).toBe(false);
    root.remove();
  });

  it('names the categories in English after a switch', async () => {
    const { more, root, settle } = setupMore();
    TestBed.inject(I18nService).setLocale('en');
    more().click();
    await settle();
    expect(root.querySelector('app-filters-panel .cat')?.textContent?.trim()).toBe('Roads & sidewalks');
    expect(more().getAttribute('aria-label')).toBe('More filters');
  });
});