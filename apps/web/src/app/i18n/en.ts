// English, in the same friendly-neighbour voice as the Thai (short, warm, never bureaucratic).
// Typed as Messages: a key missing from or added to this file is a compile error.
import { MSG_INTERNAL_EN } from '@jaeng/shared/api';
import type { Messages } from './keys';

export const en: Messages = {
  app: {
    title: 'Jaeng',
  },
  common: {
    close: 'Close',
    back: 'Back',
    cancel: 'Cancel',
    retry: 'Try again',
    reportCount: '{n} reports',
  },
  errors: {
    internal: MSG_INTERNAL_EN,
    network: "Can't connect right now. Please try again.",
    unauthorized: 'Please sign in first.',
    photoTooLarge: 'The photo is too large (3 MB max).',
    draftCleared: 'The draft was cleared because the account changed. Start again anytime.',
  },
  time: {
    justNow: 'just now',
  },
};
