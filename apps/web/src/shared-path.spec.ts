import { beamHeight } from '@jaeng/shared/beam';

describe('@jaeng/shared', () => {
  it('resolves from the web app', () => {
    expect(beamHeight(0)).toBe(60);
  });
});
