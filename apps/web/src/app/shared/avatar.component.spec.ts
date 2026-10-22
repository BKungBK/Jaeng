import { TestBed } from '@angular/core/testing';
import { AvatarComponent } from './avatar.component';

function setup(inputs: { name?: string | null; path?: string | null; size?: number }) {
  const fixture = TestBed.createComponent(AvatarComponent);
  for (const [key, value] of Object.entries(inputs)) fixture.componentRef.setInput(key, value);
  fixture.detectChanges();
  const root = fixture.nativeElement as HTMLElement;
  return { fixture, root };
}

describe('AvatarComponent', () => {
  it('shows the picture from the avatars bucket when there is one', () => {
    const { root } = setup({ name: 'น้องเมย์', path: 'u1/a.webp' });
    expect(root.querySelector('img')?.getAttribute('src')).toBe(`${location.origin}/sb/storage/v1/object/public/avatars/u1/a.webp`);
    expect(root.querySelector('.initial')).toBeNull();
  });

  it('shows the first letter of the name without a picture; a leading Thai vowel is skipped', () => {
    expect(setup({ name: 'เก่ง', path: null }).root.querySelector('.initial')?.textContent?.trim()).toBe('ก่');
    expect(setup({ name: 'mia' }).root.querySelector('.initial')?.textContent?.trim()).toBe('M');
  });

  it('shows the person icon with neither a name nor a picture', () => {
    const { root } = setup({});
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.initial')).toBeNull();
    expect(root.querySelector('app-icon')).not.toBeNull();
  });

  it('falls back to the letter when the picture cannot be loaded, and tries again for a new path', () => {
    const { fixture, root } = setup({ name: 'พี่ปลา', path: 'u1/a.webp' });
    root.querySelector('img')!.dispatchEvent(new Event('error'));
    fixture.detectChanges();
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('.initial')?.textContent?.trim()).toBe('พี่');
    fixture.componentRef.setInput('path', 'u1/b.webp');
    fixture.detectChanges();
    expect(root.querySelector('img')?.getAttribute('src')).toContain('u1/b.webp');
  });

  it('is decorative and takes its size from the input', () => {
    const { root } = setup({ name: 'a', size: 72 });
    expect(root.getAttribute('aria-hidden')).toBe('true');
    expect(root.style.getPropertyValue('--avatar-size')).toBe('72px');
  });
});
