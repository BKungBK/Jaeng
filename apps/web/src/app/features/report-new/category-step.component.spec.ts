import { TestBed } from '@angular/core/testing';
import { CategoriesService, type CategoryInfo } from '../../core/categories.service';
import { CATEGORIES } from './categories.testing';
import { CategoryStepComponent } from './category-step.component';

const flush = () => new Promise((r) => setTimeout(r, 0));

async function setup(list = vi.fn().mockResolvedValue(CATEGORIES), selected: string | null = null) {
  TestBed.configureTestingModule({ providers: [{ provide: CategoriesService, useValue: { list, labelOf: (c: CategoryInfo) => c.name_th } }] });
  const fixture = TestBed.createComponent(CategoryStepComponent);
  fixture.componentRef.setInput('selected', selected);
  await fixture.whenStable();
  await flush();
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const picked = vi.fn();
  fixture.componentInstance.picked.subscribe(picked);
  return { fixture, root, list, picked };
}

describe('CategoryStepComponent', () => {
  it('shows the eight categories as big buttons with their Lucide icon and name', async () => {
    const { root } = await setup();
    const buttons = root.querySelectorAll<HTMLButtonElement>('button.cat');
    expect(buttons).toHaveLength(8);
    expect(buttons[0].textContent?.trim()).toBe('ถนน/ทางเท้า');
    expect(buttons[0].querySelector('svg.icon-construction')).not.toBeNull();
    expect([...buttons].every((b) => b.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('marks the chosen one as pressed', async () => {
    const { root } = await setup(undefined, 'hazard');
    const pressed = root.querySelectorAll('button.cat[aria-pressed="true"]');
    expect(pressed).toHaveLength(1);
    expect(pressed[0].textContent).toContain('จุดอันตราย');
  });

  it('reports the tapped category', async () => {
    const { root, picked } = await setup();
    root.querySelectorAll<HTMLButtonElement>('button.cat')[6].click();
    expect(picked).toHaveBeenCalledWith(CATEGORIES[6]);
  });

  it('draws the tick on the card being picked, and shows an earlier choice already drawn', async () => {
    const { fixture, root } = await setup(undefined, 'hazard');
    expect(root.querySelector('button.cat[aria-pressed="true"] app-tick svg')).not.toBeNull();
    expect(root.querySelector('app-tick svg.play')).toBeNull(); // chosen before this visit: no replay
    fixture.componentRef.setInput('picking', 'hazard');
    await fixture.whenStable();
    expect(root.querySelector('button.cat[aria-pressed="true"] app-tick svg.play')).not.toBeNull();
    expect(root.querySelector('button.cat.picking')).not.toBeNull();
  });

  it('offers a retry when the list cannot load', async () => {
    const list = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(CATEGORIES);
    const { fixture, root } = await setup(list);
    expect(root.querySelectorAll('button.cat')).toHaveLength(0);
    const retry = [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('ลองโหลดใหม่'))!;
    retry.click();
    await flush();
    await fixture.whenStable();
    expect(root.querySelectorAll('button.cat')).toHaveLength(8);
  });
});
