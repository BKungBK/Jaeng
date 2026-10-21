import { TestBed } from '@angular/core/testing';
import { TickComponent } from './tick.component';

describe('TickComponent', () => {
  function setup(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(TickComponent);
    for (const [k, v] of Object.entries(inputs)) fixture.componentRef.setInput(k, v);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('draws one path and is decorative', () => {
    const root = setup();
    const svg = root.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('path')).toHaveLength(1);
    expect(root.querySelector('path')?.getAttribute('pathLength')).toBe('1');
  });

  it('plays its draw by default and sits fully drawn when told not to', () => {
    expect(setup().querySelector('svg')?.classList.contains('play')).toBe(true);
    expect(setup({ play: false }).querySelector('svg')?.classList.contains('play')).toBe(false);
  });

  it('takes its size from the input', () => {
    const svg = setup({ size: 32 }).querySelector('svg');
    expect(svg?.getAttribute('width')).toBe('32');
    expect(svg?.getAttribute('height')).toBe('32');
  });
});
