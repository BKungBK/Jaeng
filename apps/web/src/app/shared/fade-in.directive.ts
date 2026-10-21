import { afterNextRender, Directive, ElementRef, inject, signal } from '@angular/core';

/**
 * A picture that comes in out of a blur once it has loaded (plan 8; theme/_motion.scss does the fade
 * from `data-loaded`). It is also set on `error`, so a picture that never arrives is never left see-through.
 */
@Directive({
  selector: 'img[appFadeIn]',
  host: {
    '[attr.data-loaded]': 'loaded() ? "" : null',
    '(load)': 'loaded.set(true)',
    '(error)': 'loaded.set(true)',
  },
})
export class FadeInDirective {
  protected readonly loaded = signal(false);

  constructor() {
    const img = inject<ElementRef<HTMLImageElement>>(ElementRef).nativeElement;
    // from the cache the picture may already be there before the listener existed
    afterNextRender(() => {
      if (img.complete && img.getAttribute('src')) this.loaded.set(true);
    });
  }
}
