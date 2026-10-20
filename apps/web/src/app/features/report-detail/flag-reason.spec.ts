import { TestBed } from '@angular/core/testing';
import { FLAG_REASONS } from '@jaeng/shared/admin';
import { I18nService } from '../../core/i18n.service';
import { flagReasonKey, flagReasonText } from './flag-reason';

describe('flag reasons', () => {
  it('words every reason, each differently, in both languages', () => {
    const i18n = TestBed.inject(I18nService);
    const t = (k: Parameters<typeof i18n.t>[0]) => i18n.t(k);
    const th = FLAG_REASONS.map((r) => t(flagReasonKey(r)));
    expect(new Set(th).size).toBe(FLAG_REASONS.length);
    expect(t(flagReasonKey('spam'))).toBe('สแปมหรือโฆษณา');
    expect(t(flagReasonKey('other'))).toBe('อื่นๆ');
    i18n.setLocale('en');
    expect(flagReasonText('spam', t)).toBe('Spam or advertising');
    expect(flagReasonText('mystery', t)).toBe('mystery');
  });
});
