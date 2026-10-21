import { EASE, FIT, FLY, glassNav } from './motion';

const page = () => {
  const el = document.createElement('div');
  el.className = 'ion-page ion-page-invisible';
  return el;
};

describe('motion', () => {
  it('has one easing and one camera tempo', () => {
    expect(EASE).toBe('cubic-bezier(0.2, 0.8, 0.2, 1)');
    expect(FLY).toEqual({ duration: 1600, curve: 1.3, essential: true });
    expect(FIT).toEqual({ duration: 1200, essential: true });
  });

  it('brings a page in over 420 ms', () => {
    const ani = glassNav(document.createElement('div'), { enteringEl: page(), leavingEl: page(), direction: 'forward' });
    expect(ani.getDuration()).toBe(420);
    expect(ani.getEasing()).toBe(EASE);
  });

  it('copes with no leaving page (the first page) and with Back', () => {
    expect(() => glassNav(document.createElement('div'), { enteringEl: page(), direction: 'forward' })).not.toThrow();
    expect(glassNav(document.createElement('div'), { enteringEl: page(), leavingEl: page(), direction: 'back' }).getDuration()).toBe(420);
  });
});
