import { TestBed } from '@angular/core/testing';
import { ModalController } from '@ionic/angular';
import { LoginPromptService, LoginSheetComponent } from './login-prompt.service';

function setup(role: string | undefined) {
  let resolve!: (v: { role?: string }) => void;
  const modal = {
    present: vi.fn().mockResolvedValue(undefined),
    onDidDismiss: vi.fn(() => new Promise<{ role?: string }>((r) => (resolve = r))),
  };
  const modals = { create: vi.fn().mockResolvedValue(modal) };
  TestBed.configureTestingModule({ providers: [{ provide: ModalController, useValue: modals }] });
  const service = TestBed.inject(LoginPromptService);
  return { service, modals, modal, close: () => resolve({ role }) };
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('LoginPromptService', () => {
  it('opens the login sheet and resolves true after a login', async () => {
    const { service, modals, modal, close } = setup('done');
    const answer = service.ask();
    await flush();
    expect(modals.create).toHaveBeenCalledWith(expect.objectContaining({ component: LoginSheetComponent }));
    expect(modal.present).toHaveBeenCalled();
    close();
    expect(await answer).toBe(true);
  });

  it('resolves false when the sheet is closed without logging in', async () => {
    const { service, close } = setup('backdrop');
    const answer = service.ask();
    await flush();
    close();
    expect(await answer).toBe(false);
  });

  it('shares one sheet between calls made while it is open', async () => {
    const { service, modals, close } = setup('done');
    const a = service.ask();
    const b = service.ask();
    await flush();
    close();
    expect(await a).toBe(true);
    expect(await b).toBe(true);
    expect(modals.create).toHaveBeenCalledTimes(1);
    void service.ask();
    await flush();
    expect(modals.create).toHaveBeenCalledTimes(2); // a later call opens a new one
  });
});
