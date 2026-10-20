import { inject, Pipe, type PipeTransform } from '@angular/core';
import { I18nService } from '../core/i18n.service';
import type { MessageKey, MessageParams } from './keys';

/** `{{ 'common.close' | t }}`. Impure, and it reads the locale signal, so views repaint on a switch. */
@Pipe({ name: 't', pure: false })
export class TPipe implements PipeTransform {
  private i18n = inject(I18nService);

  transform(key: MessageKey, params?: MessageParams): string {
    return this.i18n.t(key, params);
  }
}
