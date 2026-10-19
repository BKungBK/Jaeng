import { ApiError } from '../../core/api.service';
import type { LoginPromptService } from '../auth/login-prompt.service';

/** Runs a write; when the session is gone for good (401 after the API's own refresh) it asks the
 *  reporter to log in again and runs it once more, so the draft is never lost to an expired session. */
export async function withLogin<T>(prompt: Pick<LoginPromptService, 'ask'>, run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (e) {
    if (!(e instanceof ApiError) || e.status !== 401) throw e;
    if (!(await prompt.ask())) throw e;
    return run();
  }
}
