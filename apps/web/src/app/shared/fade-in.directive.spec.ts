import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FadeInDirective } from './fade-in.directive';

@Component({ imports: [FadeInDirective], template: `<img appFadeIn [src]="src" alt="" />` })
class Host {
  src = 'blob:a';
}

function complete(value: boolean) {
  Object.defineProperty(HTMLImageElement.prototype, 'complete', { configurable: true, get: () => value });
}

describe('FadeInDirective', () => {
  afterEach(() => delete (HTMLImageElement.prototype as { complete?: boolean }).complete);

  async function setup() {
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const img = fixture.nativeElement.querySelector('img') as HTMLImageElement;
    return { fixture, img };
  }

  it('shows a picture that was already complete (from the cache) at once', async () => {
    complete(true);
    const { img } = await setup();
    expect(img.hasAttribute('data-loaded')).toBe(true);
  });

  it('waits for the load event of a picture that is still coming', async () => {
    complete(false);
    const { fixture, img } = await setup();
    expect(img.hasAttribute('data-loaded')).toBe(false);
    img.dispatchEvent(new Event('load'));
    await fixture.whenStable();
    expect(img.hasAttribute('data-loaded')).toBe(true);
  });

  it('is also shown when the picture fails, so it is never left see-through', async () => {
    complete(false);
    const { fixture, img } = await setup();
    img.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(img.hasAttribute('data-loaded')).toBe(true);
  });
});
