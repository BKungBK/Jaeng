import { burst, burstSpecs, collapse, EASE, FIT, FLY, glassNav, leave, POP_SPRING, springIn, viewTransition } from './motion';

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

describe('motion kit (plan 8)', () => {
  // the DOM lib types startViewTransition as always present; the tests take it away and put fakes in
  const doc = document as unknown as { startViewTransition?: unknown };

  afterEach(() => {
    delete doc.startViewTransition;
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.documentElement.removeAttribute('data-vt');
  });

  it('has one spring for choosing', () => {
    expect(POP_SPRING).toEqual({ type: 'spring', visualDuration: 0.35, bounce: 0.3 });
  });

  describe('burstSpecs', () => {
    it('spreads the sparks evenly, the first one pointing up', () => {
      const specs = burstSpecs(8, 24);
      expect(specs).toHaveLength(8);
      expect(specs[0].dx).toBeCloseTo(0, 5);
      expect(specs[0].dy).toBeLessThan(0);
      for (const s of specs) expect(Math.hypot(s.dx, s.dy)).toBeCloseTo(24, 5);
      expect(specs.map((s) => s.delay)).toEqual([0, 12, 24, 36, 48, 60, 72, 84]);
    });

    it('gives nothing for fewer than one spark', () => {
      expect(burstSpecs(0, 24)).toEqual([]);
      expect(burstSpecs(-3, 24)).toEqual([]);
    });
  });

  describe('without the Web Animations API (jsdom)', () => {
    it('burst leaves no sparks behind', () => {
      const host = document.createElement('div');
      expect(() => burst(host)).not.toThrow();
      expect(host.children).toHaveLength(0);
    });

    it('leave, collapse and springIn resolve at once', async () => {
      const el = document.createElement('div');
      await expect(leave(el)).resolves.toBeUndefined();
      await expect(collapse(el)).resolves.toBeUndefined();
      await expect(springIn(el)).resolves.toBeUndefined();
    });
  });

  describe('viewTransition', () => {
    it('just updates when the browser has no view transitions', async () => {
      const update = vi.fn();
      await viewTransition(update);
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('does not start one in a hidden tab', async () => {
      const start = vi.fn();
      doc.startViewTransition = start;
      Object.defineProperty(document, 'hidden', { configurable: true, value: true });
      const update = vi.fn();
      await viewTransition(update);
      expect(start).not.toHaveBeenCalled();
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('runs the update inside the transition and clears its marker', async () => {
      const update = vi.fn();
      doc.startViewTransition = (cb: () => void) => {
        void cb();
        return { finished: Promise.resolve() };
      };
      await viewTransition(update, { x: 10, y: 20 });
      expect(update).toHaveBeenCalledTimes(1);
      expect(document.documentElement.getAttribute('data-vt')).toBeNull();
    });

    it('still updates, once, when the transition is skipped (finished rejects)', async () => {
      const update = vi.fn();
      doc.startViewTransition = (cb: () => void) => {
        void cb();
        return { finished: Promise.reject(new Error('skipped')) };
      };
      await viewTransition(update);
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('updates once when startViewTransition throws before running the callback', async () => {
      const update = vi.fn();
      doc.startViewTransition = () => {
        throw new Error('nope');
      };
      await viewTransition(update);
      expect(update).toHaveBeenCalledTimes(1);
    });

    it('lets an error from the update itself out', async () => {
      doc.startViewTransition = (cb: () => void) => {
        void cb();
        return { finished: Promise.resolve() };
      };
      await expect(
        viewTransition(() => {
          throw new Error('boom');
        }),
      ).rejects.toThrow('boom');
    });
  });
});
