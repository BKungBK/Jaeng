import { expect, test } from 'bun:test';
import { LEVELS } from '@jaeng/shared/levels';

test('@jaeng/shared resolves from the api', () => {
  expect(LEVELS).toHaveLength(4);
});
