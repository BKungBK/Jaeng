import { ApiError } from '../../core/api.service';
import { withLogin } from './with-login';

const expired = () => new ApiError(401, 'unauthorized', 'เข้าสู่ระบบก่อนนะ');

describe('withLogin', () => {
  it('passes a success straight through without asking', async () => {
    const prompt = { ask: vi.fn() };
    expect(await withLogin(prompt, async () => 7)).toBe(7);
    expect(prompt.ask).not.toHaveBeenCalled();
  });

  it('asks to log in on 401 and runs once more', async () => {
    const prompt = { ask: vi.fn().mockResolvedValue(true) };
    const run = vi.fn().mockRejectedValueOnce(expired()).mockResolvedValue('ok');
    expect(await withLogin(prompt, run)).toBe('ok');
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('gives the 401 back when the sheet is closed', async () => {
    const prompt = { ask: vi.fn().mockResolvedValue(false) };
    const run = vi.fn().mockRejectedValue(expired());
    await expect(withLogin(prompt, run)).rejects.toBeInstanceOf(ApiError);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('does not ask for other errors', async () => {
    const prompt = { ask: vi.fn() };
    const run = vi.fn().mockRejectedValue(new ApiError(429, 'rate_limited', 'x'));
    await expect(withLogin(prompt, run)).rejects.toMatchObject({ code: 'rate_limited' });
    expect(prompt.ask).not.toHaveBeenCalled();
  });
});
