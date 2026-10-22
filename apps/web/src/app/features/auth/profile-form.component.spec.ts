import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ApiError } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { DeviceService } from '../../core/device.service';
import { I18nService } from '../../core/i18n.service';
import { MeService } from '../me/me.service';
import { ProfileFormComponent } from './profile-form.component';

// one 2-unit character, to prove the counter counts code points (not written as a literal: no-emoji.spec.ts)
const FACE = String.fromCodePoint(0x1f600);
const NEW_MEMBER = { id: 'u1', display_name: 'เพื่อนบ้าน0001', role: 'user', locale: 'th', avatar_path: null as string | null, onboarded_at: null };

async function setup(opts: { native?: boolean; signOutLink?: boolean } = {}) {
  const profile = signal({ ...NEW_MEMBER });
  const auth = {
    profile,
    setProfile: vi.fn((patch: Record<string, unknown>) => profile.update((p) => ({ ...p, ...patch }))),
    signOut: vi.fn().mockResolvedValue(undefined),
  };
  const me = {
    completeProfile: vi.fn().mockResolvedValue({ display_name: 'น้องเมย์', locale: 'th', avatar_path: null, onboarded: true }),
    uploadAvatar: vi.fn().mockResolvedValue('u1/a.webp'),
    removeAvatar: vi.fn().mockResolvedValue(undefined),
  };
  const device = { native: opts.native ?? false, takePhoto: vi.fn(), pickPhotos: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: AuthService, useValue: auth },
      { provide: MeService, useValue: me },
      { provide: DeviceService, useValue: device },
    ],
  });
  const fixture = TestBed.createComponent(ProfileFormComponent);
  if (opts.signOutLink) fixture.componentRef.setInput('signOutLink', true);
  const done = vi.fn();
  fixture.componentInstance.done.subscribe(done);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      await Promise.resolve();
      fixture.detectChanges();
    }
  };
  const type = async (value: string) => {
    const input = root.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    await settle();
  };
  const start = () => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes('เริ่มใช้แจ้ง'))!;
  const submit = async () => {
    root.querySelector('form')!.dispatchEvent(new Event('submit', { cancelable: true }));
    await settle();
  };
  const choose = async (file: File) => {
    const input = root.querySelector<HTMLInputElement>('input[type="file"][capture]')!;
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new Event('change'));
    await settle();
  };
  return { fixture, root, auth, me, device, done, type, start, submit, choose, settle, profile };
}

describe('ProfileFormComponent', () => {
  it('starts with an empty nickname field and "Start" off', async () => {
    const t = await setup();
    expect(t.root.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!.value).toBe('');
    expect(t.start().disabled).toBe(true);
  });

  it.each([
    ['one character', 'ก'],
    ['blank', '   '],
    ['invisible characters', '​​​'],
  ])('keeps "Start" off for %s', async (_n, name) => {
    const t = await setup();
    await t.type(name);
    expect(t.start().disabled).toBe(true);
  });

  it('turns "Start" on for 2 to 30 characters and counts code points', async () => {
    const t = await setup();
    await t.type('กข');
    expect(t.start().disabled).toBe(false);
    await t.type(FACE.repeat(30));
    expect(t.root.querySelector('.count')?.textContent?.trim()).toBe('30/30');
    expect(t.start().disabled).toBe(false);
    await t.type(FACE.repeat(31));
    expect(t.start().disabled).toBe(true);
  });

  it('saves the trimmed nickname, marks the profile set up and says done', async () => {
    const t = await setup();
    await t.type('  น้องเมย์ ');
    await t.submit();
    expect(t.me.completeProfile).toHaveBeenCalledWith('น้องเมย์');
    expect(t.auth.setProfile).toHaveBeenCalledWith(expect.objectContaining({ display_name: 'น้องเมย์', onboarded_at: expect.any(String) }));
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('shows an API refusal under the field and stays put, keeping what was typed', async () => {
    const t = await setup();
    t.me.completeProfile.mockRejectedValue(new ApiError(422, 'profanity', 'ข้อความมีคำที่ไม่เหมาะสม ลองเรียบเรียงใหม่นะ', 'No'));
    await t.type('ชื่อ');
    await t.submit();
    expect(t.root.querySelector('[role="alert"]')?.textContent).toContain('ข้อความมีคำที่ไม่เหมาะสม');
    expect(t.root.querySelector('input[autocomplete="nickname"]')?.getAttribute('aria-invalid')).toBe('true');
    expect(t.root.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!.value).toBe('ชื่อ');
    expect(t.done).not.toHaveBeenCalled();
    expect(t.start().disabled).toBe(false); // can try again
  });

  it('does not save twice when pressed twice', async () => {
    const t = await setup();
    let release!: () => void;
    t.me.completeProfile.mockReturnValue(new Promise((r) => (release = () => r({ display_name: 'ก', locale: 'th', avatar_path: null, onboarded: true }))));
    await t.type('น้องเมย์');
    void t.submit();
    await t.submit();
    release();
    await t.settle();
    expect(t.me.completeProfile).toHaveBeenCalledTimes(1);
  });

  it('sends a chosen picture at once and shows it in the circle', async () => {
    const t = await setup();
    await t.choose(new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
    expect(t.me.uploadAvatar).toHaveBeenCalledTimes(1);
    expect(t.auth.setProfile).toHaveBeenCalledWith({ avatar_path: 'u1/a.webp' });
    expect(t.root.querySelector('app-avatar img')?.getAttribute('src')).toContain('/avatars/u1/a.webp');
  });

  it('keeps "Start" off while the picture is on its way', async () => {
    const t = await setup();
    let release!: (path: string) => void;
    t.me.uploadAvatar.mockReturnValue(new Promise((r) => (release = r)));
    await t.type('น้องเมย์');
    await t.choose(new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
    expect(t.start().disabled).toBe(true);
    expect(t.root.textContent).toContain('กำลังอัปโหลดรูป');
    release('u1/a.webp');
    await t.settle();
    expect(t.start().disabled).toBe(false);
  });

  it('a picture that fails says why and does not lose the nickname', async () => {
    const t = await setup();
    t.me.uploadAvatar.mockRejectedValue(new ApiError(415, 'invalid_photo', 'ไฟล์นี้ไม่ใช่รูปที่ใช้ได้ ลองเลือกรูปอื่นนะ', 'No'));
    await t.type('น้องเมย์');
    await t.choose(new File(['x'], 'me.txt', { type: 'text/plain' }));
    expect(t.root.querySelector('.picture [role="status"]')?.textContent).toContain('ไฟล์นี้ไม่ใช่รูปที่ใช้ได้');
    expect(t.root.querySelector<HTMLInputElement>('input[autocomplete="nickname"]')!.value).toBe('น้องเมย์');
    expect(t.start().disabled).toBe(false);
  });

  it('the little x takes a picture off again', async () => {
    const t = await setup();
    await t.choose(new File(['x'], 'me.jpg', { type: 'image/jpeg' }));
    t.root.querySelector<HTMLButtonElement>('.remove')!.click();
    await t.settle();
    expect(t.me.removeAvatar).toHaveBeenCalledTimes(1);
    expect(t.auth.setProfile).toHaveBeenLastCalledWith({ avatar_path: null });
    expect(t.root.querySelector('.remove')).toBeNull();
  });

  it('works without a picture', async () => {
    const t = await setup();
    await t.type('น้องเมย์');
    await t.submit();
    expect(t.me.uploadAvatar).not.toHaveBeenCalled();
    expect(t.done).toHaveBeenCalledTimes(1);
  });

  it('in the APK the buttons use the device camera and photo picker', async () => {
    const t = await setup({ native: true });
    t.device.takePhoto.mockResolvedValue(new File(['x'], 'c.jpg'));
    t.device.pickPhotos.mockResolvedValue([new File(['y'], 'g.jpg')]);
    const [camera, gallery] = [...t.root.querySelectorAll<HTMLButtonElement>('.add button')];
    camera.click();
    await t.settle();
    gallery.click();
    await t.settle();
    expect(t.device.takePhoto).toHaveBeenCalledTimes(1);
    expect(t.device.pickPhotos).toHaveBeenCalledWith(1);
    expect(t.me.uploadAvatar).toHaveBeenCalledTimes(2);
  });

  it('shows the way out only when asked to', async () => {
    const without = await setup();
    expect(without.root.querySelector('.links')).toBeNull();
    TestBed.resetTestingModule();
    const withLink = await setup({ signOutLink: true });
    const out = [...withLink.root.querySelectorAll<HTMLButtonElement>('.links button')][0];
    expect(out.textContent).toContain('ออกจากระบบ');
    out.click();
    expect(withLink.auth.signOut).toHaveBeenCalledTimes(1);
  });

  it('words itself in English', async () => {
    const t = await setup();
    TestBed.inject(I18nService).setLocale('en');
    t.fixture.detectChanges();
    expect(t.root.querySelector('h2')?.textContent).toContain('Set up your profile');
    expect(t.root.querySelector('.primary')?.textContent).toContain('Start using Jaeng');
  });
});
