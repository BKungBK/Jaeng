import { computed, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { PhotoStepComponent } from './photo-step.component';
import { ReportDraftService, type DraftPhoto } from './report-draft.service';

const photo = (n: number, state: DraftPhoto['state'], error: string | null = null): DraftPhoto => ({
  localId: `l${n}`,
  previewUrl: `blob:p${n}`,
  width: 1600,
  height: 1200,
  gps: null,
  state,
  photoId: state === 'ready' ? `p${n}` : null,
  error,
  blob: null,
});

async function setup(initial: DraftPhoto[] = []) {
  const photos = signal(initial);
  const draft = {
    photos,
    canContinueFromPhotos: computed(() => photos().length > 0 && photos().every((p) => p.state === 'ready')),
    overflowed: signal(false),
    addFiles: vi.fn().mockResolvedValue(undefined),
    retry: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  TestBed.configureTestingModule({ providers: [{ provide: ReportDraftService, useValue: draft }] });
  const fixture = TestBed.createComponent(PhotoStepComponent);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const next = vi.fn();
  fixture.componentInstance.next.subscribe(next);
  const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text));
  return { fixture, root, draft, photos, next, button };
}

describe('PhotoStepComponent', () => {
  it('offers the camera and the gallery as file inputs', async () => {
    const { root, button } = await setup();
    expect(button('ถ่ายรูป')).toBeDefined();
    expect(button('เลือกจากคลัง')).toBeDefined();
    const camera = root.querySelector<HTMLInputElement>('input[capture="environment"]')!;
    expect(camera.type).toBe('file');
    expect(camera.accept).toBe('image/*');
    expect(camera.multiple).toBe(false);
    const gallery = root.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
    expect(gallery.accept).toBe('image/*');
  });

  it('keeps "ไปต่อ" disabled without a photo', async () => {
    const { button } = await setup();
    expect(button('ไปต่อ')!.disabled).toBe(true);
  });

  it('hands the chosen files to the draft and clears the input for the next pick', async () => {
    const { root, draft } = await setup();
    const input = root.querySelector<HTMLInputElement>('input[type="file"][multiple]')!;
    const files = [new File(['a'], 'a.jpg', { type: 'image/jpeg' }), new File(['b'], 'b.jpg', { type: 'image/jpeg' })];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    input.dispatchEvent(new Event('change'));
    expect(draft.addFiles).toHaveBeenCalledWith(files);
  });

  it('shows each photo with its state, and remove and retry controls', async () => {
    const { root, draft, button } = await setup([photo(1, 'ready'), photo(2, 'uploading'), photo(3, 'error', 'รูปใหญ่เกินไป (ไม่เกิน 3 MB)')]);
    const tiles = root.querySelectorAll('li');
    expect(tiles).toHaveLength(3);
    expect(tiles[0].textContent).toContain('พร้อมแล้ว');
    expect(tiles[1].textContent).toContain('กำลังอัปโหลด');
    expect(tiles[2].textContent).toContain('รูปใหญ่เกินไป (ไม่เกิน 3 MB)');
    expect(tiles[0].querySelector('img')?.getAttribute('src')).toBe('blob:p1');
    tiles[2].querySelector<HTMLButtonElement>('button[aria-label="ลบรูปที่ 3"]')!.click();
    expect(draft.remove).toHaveBeenCalledWith('l3');
    button('ลองใหม่')!.click();
    expect(draft.retry).toHaveBeenCalledWith('l3');
    expect(button('ไปต่อ')!.disabled).toBe(true);
  });

  it('hides the add buttons at four photos and goes on when all are ready', async () => {
    const { root, button, next } = await setup([1, 2, 3, 4].map((n) => photo(n, 'ready')));
    expect(button('ถ่ายรูป')).toBeUndefined();
    expect(root.textContent).toContain('ครบ 4 รูปแล้ว');
    button('ไปต่อ')!.click();
    expect(next).toHaveBeenCalled();
  });

  it('never claims the photos are blurred', async () => {
    const { root } = await setup([photo(1, 'ready')]);
    expect(root.textContent).not.toContain('เบลอ');
  });
});
