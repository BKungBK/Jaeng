import { TestBed } from '@angular/core/testing';
import { RollComponent, rollDigits } from './roll.component';

describe('rollDigits', () => {
  it.each([
    [0, [0]],
    [9, [9]],
    [10, [1, 0]],
    [99, [9, 9]],
    [100, [1, 0, 0]],
    [-3, [0]],
    [Number.NaN, [0]],
    [Number.POSITIVE_INFINITY, [0]],
    [4.9, [4]],
  ])('%s -> %j', (value, digits) => {
    expect(rollDigits(value)).toEqual(digits);
  });
});

describe('RollComponent', () => {
  function setup(value: number) {
    const fixture = TestBed.createComponent(RollComponent);
    fixture.componentRef.setInput('value', value);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('says the number once to a screen reader and hides the columns', () => {
    const { root } = setup(42);
    expect(root.querySelector('.sr-only')?.textContent?.trim()).toBe('42');
    expect(root.querySelector('.cols')?.getAttribute('aria-hidden')).toBe('true');
    expect(root.querySelectorAll('.col')).toHaveLength(2);
  });

  it('keeps a column per place value, so 9 -> 10 adds a tens column and rolls the units one', () => {
    const { fixture, root } = setup(9);
    const units = root.querySelector('.col') as HTMLElement;
    expect(units.style.getPropertyValue('--d')).toBe('9');
    fixture.componentRef.setInput('value', 10);
    fixture.detectChanges();
    const cols = root.querySelectorAll<HTMLElement>('.col');
    expect(cols).toHaveLength(2);
    expect(root.querySelector('.sr-only')?.textContent?.trim()).toBe('10');
    // the units column is the same element, now at 0 (it rolls there); the new one is the tens
    expect(cols[1]).toBe(units);
    expect(units.style.getPropertyValue('--d')).toBe('0');
    expect(cols[0].style.getPropertyValue('--d')).toBe('1');
  });

  it('shrinks 100 -> 99 and reads 99', () => {
    const { fixture, root } = setup(100);
    fixture.componentRef.setInput('value', 99);
    fixture.detectChanges();
    expect(root.querySelectorAll('.col')).toHaveLength(2);
    expect(root.querySelector('.sr-only')?.textContent?.trim()).toBe('99');
  });

  it('shows 0 for NaN', () => {
    const { root } = setup(Number.NaN);
    expect(root.querySelector('.sr-only')?.textContent?.trim()).toBe('0');
  });
});
