import { expectAccessiblePage } from '../../a11y.testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { NavController } from '@ionic/angular';
import { ServerCheckError, ServerConfigService, type ServerCheck } from '../../core/server-config.service';
import { th } from '../../i18n/th';
import { ServerPage } from './server.page';

async function setup(opts: { address?: string; reason?: string; check?: ServerCheck; saveFails?: Error } = {}) {
  const server = {
    address: signal(opts.address ?? 'http://192.168.1.5:8000').asReadonly(),
    native: true,
    check: vi.fn().mockResolvedValue(opts.check ?? { ok: true, address: 'http://192.168.1.5:8000' }),
    save: vi.fn(opts.saveFails ? () => Promise.reject(opts.saveFails) : () => Promise.resolve()),
  };
  const nav = { navigateRoot: vi.fn().mockResolvedValue(true) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ServerConfigService, useValue: server },
      { provide: NavController, useValue: nav },
    ],
  });
  const fixture = TestBed.createComponent(ServerPage);
  if (opts.reason) fixture.componentRef.setInput('reason', opts.reason);
  const root = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 4; i++) {
      fixture.detectChanges();
      await fixture.whenStable();
    }
  };
  await settle();
  const input = () => root.querySelector<HTMLInputElement>('#server-input')!;
  const buttons = () => [...root.querySelectorAll<HTMLButtonElement>('.pair button')];
  const type = async (v: string) => {
    input().value = v;
    input().dispatchEvent(new Event('input'));
    await settle();
  };
  const status = () => root.querySelector('#server-result')!.textContent!.trim();
  return { server, nav, root, settle, input, buttons, type, status };
}

describe('ServerPage', () => {
  it('starts with the current address, a working Test button and Save off', async () => {
    const { input, buttons } = await setup();
    expect(input().value).toBe('http://192.168.1.5:8000');
    const [test, save] = buttons();
    expect(test.disabled).toBe(false);
    expect(save.disabled).toBe(true);
  });

  it('says in words what the test found, and unlocks Save only after a good one', async () => {
    const ok = await setup();
    ok.buttons()[0].click();
    await ok.settle();
    expect(ok.server.check).toHaveBeenCalledWith('http://192.168.1.5:8000');
    expect(ok.status()).toContain(th.server.result.ok);
    expect(ok.buttons()[1].disabled).toBe(false);
  });

  it.each(['invalid', 'unreachable', 'notJaeng'] as const)('shows %s and keeps Save off', async (reason) => {
    const page = await setup({ check: { ok: false, reason } });
    page.buttons()[0].click();
    await page.settle();
    expect(page.status()).toContain(th.server.result[reason]);
    expect(page.buttons()[1].disabled).toBe(true);
  });

  it('forgets the test result as soon as the address changes', async () => {
    const page = await setup();
    page.buttons()[0].click();
    await page.settle();
    await page.type('192.168.1.6:8000');
    expect(page.status()).toBe('');
    expect(page.buttons()[1].disabled).toBe(true);
  });

  it('opened by the app because the server is unreachable: says so before anything is typed', async () => {
    const page = await setup({ address: '', reason: 'unreachable' });
    expect(page.status()).toContain(th.server.result.unreachable);
    expect(page.buttons()[0].disabled).toBe(true); // nothing to test yet
  });

  it('drops the app\'s reason once the reader types another address', async () => {
    const page = await setup({ address: 'http://old.example', reason: 'unreachable' });
    expect(page.status()).toContain(th.server.result.unreachable);
    await page.type('http://new.example');
    expect(page.status()).toBe('');
  });

  it('saves the tested address; a failed save is shown and nothing else changes', async () => {
    const page = await setup();
    page.buttons()[0].click();
    await page.settle();
    page.buttons()[1].click();
    await page.settle();
    expect(page.server.save).toHaveBeenCalledWith('http://192.168.1.5:8000');

    TestBed.resetTestingModule();
    const bad = await setup({ saveFails: new ServerCheckError('unreachable') });
    bad.buttons()[0].click();
    await bad.settle();
    bad.buttons()[1].click();
    await bad.settle();
    expect(bad.status()).toContain(th.server.result.unreachable);
    expect(bad.buttons()[1].disabled).toBe(true);
  });

  it('goes back to the map', async () => {
    const page = await setup();
    page.root.querySelector<HTMLButtonElement>('.head .ctl')!.click();
    expect(page.nav.navigateRoot).toHaveBeenCalledWith('/');
  });

  it('has one h1 and no unnamed control', async () => {
    expectAccessiblePage((await setup()).root);
  });
});
