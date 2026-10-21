import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DetailsSectionComponent, TagSuggestService } from './details-section.component';
import { ReportDraftService, type DraftDetails } from './report-draft.service';

async function setup(details: Partial<DraftDetails> = {}) {
  const draft = {
    details: signal<DraftDetails>({ title: '', description: '', danger: 2, tags: [], hideAuthor: false, ...details }),
  };
  const suggest = { suggest: vi.fn().mockResolvedValue(['หน้าโรงเรียน', 'โรงพยาบาล']) };
  TestBed.configureTestingModule({
    providers: [
      { provide: ReportDraftService, useValue: draft },
      { provide: TagSuggestService, useValue: suggest },
    ],
  });
  const fixture = TestBed.createComponent(DetailsSectionComponent);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const toggle = root.querySelector<HTMLButtonElement>('button[aria-controls]')!;
  const open = async () => {
    toggle.click();
    await fixture.whenStable();
  };
  return { fixture, root, draft, suggest, toggle, open };
}

const type = (el: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input'));
};

describe('DetailsSectionComponent', () => {
  it('starts folded', async () => {
    const { root, toggle } = await setup();
    expect(toggle.textContent).toContain('เพิ่มรายละเอียด');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(root.querySelector('input')).toBeNull();
  });

  it('starts with "ไม่แสดงชื่อฉัน" off and turns it on', async () => {
    const { root, open, draft } = await setup();
    await open();
    const sw = root.querySelector<HTMLInputElement>('input[role="switch"]')!;
    expect(sw.checked).toBe(false);
    expect(sw.closest('label')?.textContent).toContain('ไม่แสดงชื่อฉัน');
    sw.click();
    expect(draft.details().hideAuthor).toBe(true);
  });

  it('moves the switch knob with a stretch that remembers which way it went', async () => {
    const { fixture, root, open } = await setup();
    await open();
    const label = root.querySelector<HTMLLabelElement>('label.switch')!;
    const sw = label.querySelector<HTMLInputElement>('input')!;
    expect(label.getAttribute('data-fx')).toBeNull(); // opening the section plays nothing
    sw.click();
    await fixture.whenStable();
    expect(label.getAttribute('data-fx')).toBe('on');
    expect(label.querySelector('.knob svg')).not.toBeNull(); // a drawn ✓ / – in the knob, no glyph
    sw.click();
    await fixture.whenStable();
    expect(label.getAttribute('data-fx')).toBe('off');
  });

  it('counts the title and the description against their limits', async () => {
    const { fixture, root, open, draft } = await setup();
    await open();
    const title = root.querySelector<HTMLInputElement>('#rn-title')!;
    const desc = root.querySelector<HTMLTextAreaElement>('#rn-desc')!;
    expect(title.maxLength).toBe(120);
    expect(desc.maxLength).toBe(1000);
    type(title, 'หลุม');
    type(desc, 'ลึกมาก');
    await fixture.whenStable();
    expect(draft.details()).toMatchObject({ title: 'หลุม', description: 'ลึกมาก' });
    expect(root.textContent).toContain('4/120');
    expect(root.textContent).toContain('6/1000');
  });

  it('shows the four levels with their shapes and checks the current one', async () => {
    const { root, open, draft, fixture } = await setup({ danger: 1 });
    await open();
    const radios = [...root.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
    expect(radios).toHaveLength(4);
    expect(radios.map((r) => r.checked)).toEqual([false, true, false, false]);
    expect(root.querySelectorAll('.levels app-level-shape')).toHaveLength(4);
    expect(root.querySelector('.levels')?.textContent).toContain('วิกฤต');
    radios[3].click();
    await fixture.whenStable();
    expect(draft.details().danger).toBe(3);
  });

  it('adds tags as typed, at most five', async () => {
    const { fixture, root, open, draft } = await setup({ tags: ['a', 'b', 'c', 'd'] });
    await open();
    const input = root.querySelector<HTMLInputElement>('#rn-tags')!;
    type(input, '#ห้า');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    await fixture.whenStable();
    expect(draft.details().tags).toEqual(['a', 'b', 'c', 'd', '#ห้า']);
    expect(root.querySelector<HTMLInputElement>('#rn-tags')!.disabled).toBe(true);
    expect(root.textContent).toContain('ใส่ได้สูงสุด 5 แท็ก');
    // a sixth cannot get in, even past the disabled field
    fixture.componentInstance.addTag('หก');
    expect(draft.details().tags).toHaveLength(5);
  });

  it('removes a tag', async () => {
    const { fixture, root, open, draft } = await setup({ tags: ['a', 'b'] });
    await open();
    root.querySelector<HTMLButtonElement>('button[aria-label="ลบแท็ก a"]')!.click();
    await fixture.whenStable();
    expect(draft.details().tags).toEqual(['b']);
  });

  it('suggests tags 250 ms after typing stops and adds a picked one', async () => {
    const { fixture, root, open, suggest, draft } = await setup();
    await open();
    vi.useFakeTimers();
    try {
      const input = root.querySelector<HTMLInputElement>('#rn-tags')!;
      type(input, 'โ');
      await vi.advanceTimersByTimeAsync(100);
      type(input, 'โร');
      await vi.advanceTimersByTimeAsync(249);
      expect(suggest.suggest).not.toHaveBeenCalled();
      await vi.advanceTimersByTimeAsync(1);
      expect(suggest.suggest).toHaveBeenCalledTimes(1);
      expect(suggest.suggest).toHaveBeenCalledWith('โร');
      await vi.advanceTimersByTimeAsync(0);
      fixture.detectChanges();
      const pick = [...root.querySelectorAll<HTMLButtonElement>('.suggest button')].find((b) => b.textContent?.includes('หน้าโรงเรียน'))!;
      pick.click();
      fixture.detectChanges();
      expect(draft.details().tags).toEqual(['หน้าโรงเรียน']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('never claims the photos are blurred', async () => {
    const { root, open } = await setup();
    await open();
    expect(root.textContent).not.toContain('เบลอ');
  });
});
