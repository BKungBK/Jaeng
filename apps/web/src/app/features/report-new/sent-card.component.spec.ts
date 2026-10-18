import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { MapReturnService } from './map-return.service';
import { SentCardComponent } from './sent-card.component';

async function setup() {
  const router = { navigate: vi.fn().mockResolvedValue(true) };
  const back = { go: vi.fn().mockResolvedValue(undefined) };
  TestBed.configureTestingModule({
    providers: [
      { provide: Router, useValue: router },
      { provide: MapReturnService, useValue: back },
    ],
  });
  const fixture = TestBed.createComponent(SentCardComponent);
  await fixture.whenStable();
  const root = fixture.nativeElement as HTMLElement;
  const button = (text: string) => [...root.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.includes(text))!;
  return { root, router, back, button };
}

describe('SentCardComponent', () => {
  it('says it was sent and thanks the reporter in the neighbor voice', async () => {
    const { root } = await setup();
    expect(root.querySelector('h2')?.textContent?.trim()).toBe('ส่งแล้ว รอผู้ดูแลตรวจ');
    expect(root.textContent).toContain('ขอบคุณที่แจ้งนะ เดี๋ยวผู้ดูแลตรวจให้');
  });

  it('opens /me from "ดูเรื่องของฉัน"', async () => {
    const { button, router } = await setup();
    button('ดูเรื่องของฉัน').click();
    expect(router.navigate).toHaveBeenCalledWith(['/me']);
  });

  it('goes back to the map from "กลับไปแผนที่"', async () => {
    const { button, back } = await setup();
    button('กลับไปแผนที่').click();
    expect(back.go).toHaveBeenCalledWith();
  });
});
