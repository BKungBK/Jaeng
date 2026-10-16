import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HomePage } from './home.page';

describe('HomePage', () => {
  let fixture: ComponentFixture<HomePage>;

  beforeEach(async () => {
    fixture = TestBed.createComponent(HomePage);
    fixture.detectChanges();
  });

  it('shows brand', () => {
    const h1: HTMLElement | null = fixture.nativeElement.querySelector('h1');
    expect(h1?.textContent?.trim()).toBe('แจ้ง');
  });
});
