import { TestBed } from '@angular/core/testing';
import { FilterState } from './filter-state.service';

describe('FilterState', () => {
  it('starts with every level, every category and fixed reports shown', () => {
    const f = TestBed.inject(FilterState);
    expect(f.levels()).toEqual([0, 1, 2, 3]);
    expect(f.categories()).toEqual([]);
    expect(f.showResolved()).toBe(true);
    expect(f.extraCount()).toBe(0);
    expect(f.statuses()).toEqual(['open', 'fix_claimed', 'resolved']);
  });

  it('counts two categories and the resolved switch as three extras', () => {
    const f = TestBed.inject(FilterState);
    f.toggleCategory('flood');
    f.toggleCategory('road');
    f.showResolved.set(false);
    expect(f.extraCount()).toBe(3);
    expect(f.statuses()).toEqual(['open', 'fix_claimed']);
    f.toggleCategory('road');
    expect(f.categories()).toEqual(['flood']);
  });

  it('clears the extras without touching the levels', () => {
    const f = TestBed.inject(FilterState);
    f.levels.set([3]);
    f.toggleCategory('flood');
    f.showResolved.set(false);
    f.clearExtra();
    expect(f.extraCount()).toBe(0);
    expect(f.levels()).toEqual([3]);
    expect(f.filter()).toEqual({ levels: [3], categories: [], statuses: ['open', 'fix_claimed', 'resolved'] });
  });
});
