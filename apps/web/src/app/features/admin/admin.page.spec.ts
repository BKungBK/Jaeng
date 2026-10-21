import { expectAccessiblePage } from '../../a11y.testing';
import { Component, input, output } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { NavController } from '@ionic/angular';
import { I18nService } from '../../core/i18n.service';
import { MapReturnService } from '../report-new/map-return.service';
import { AdminPage } from './admin.page';
import { AdminService } from './admin.service';
import { ReviewQueueComponent } from './review-queue.component';

@Component({ selector: 'app-review-queue', template: 'queue' })
class FakeQueue {
  readonly changed = output<void>();
}

async function open(url: string) {
  const admin = { counts: vi.fn().mockResolvedValue({ reports: 3, claims: 0, flags: 2 }) };
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'admin', component: AdminPage }]),
      { provide: AdminService, useValue: admin },
      { provide: NavController, useValue: {} },
      { provide: MapReturnService, useValue: { go: vi.fn() } },
    ],
  });
  TestBed.overrideComponent(AdminPage, { remove: { imports: [ReviewQueueComponent] }, add: { imports: [FakeQueue] } });
  const harness = await RouterTestingHarness.create(url);
  const settle = async () => {
    for (let i = 0; i < 6; i++) {
      harness.detectChanges();
      await Promise.resolve();
    }
  };
  await settle();
  const root = harness.routeNativeElement as HTMLElement;
  const tabs = () => [...root.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
  return { harness, root, admin, tabs, settle, router: TestBed.inject(Router) };
}

describe('AdminPage', () => {
  it('opens the tab named in ?tab=', async () => {
    const { tabs } = await open('/admin?tab=claims');
    expect(tabs()[1].getAttribute('aria-selected')).toBe('true');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('false');
  });

  it('an unknown tab opens the review queue', async () => {
    const { tabs, root } = await open('/admin?tab=x');
    expect(tabs()[0].getAttribute('aria-selected')).toBe('true');
    expect(root.querySelector('app-review-queue')).not.toBeNull();
  });

  it('has one underline that slides to the open tab, and counts that roll (plan 8)', async () => {
    const { root } = await open('/admin');
    const ink = root.querySelector<HTMLElement>('.tabs .ink')!;
    expect(ink).not.toBeNull();
    expect(ink.getAttribute('aria-hidden')).toBe('true');
    expect(ink.style.getPropertyValue('--x')).toMatch(/px$/);
    expect(root.querySelectorAll('.tab app-roll').length).toBe(3); // reports, claims, flags
    expect(root.querySelector('.tab[aria-selected="true"]')?.getAttribute('style')).toBeNull(); // no border colour trick
  });

  it('puts the counts on the tabs, 0 included, none on users and log', async () => {
    const { tabs } = await open('/admin');
    expect(tabs()[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('รอตรวจ · 3');
    expect(tabs()[1].textContent).toContain('แจ้งว่าแก้แล้ว · 0');
    expect(tabs()[2].textContent).toContain('ถูกรายงาน · 2');
    expect(tabs()[3].textContent?.trim()).toBe('ผู้ใช้');
    expect(tabs()[4].textContent?.trim()).toBe('บันทึก');
  });

  it('names the tabs in English after a switch (plan 6)', async () => {
    const { tabs, settle } = await open('/admin');
    TestBed.inject(I18nService).setLocale('en');
    await settle();
    expect(tabs()[0].textContent?.replace(/\s+/g, ' ').trim()).toBe('Waiting · 3');
    expect(tabs()[4].textContent?.trim()).toBe('Log');
  });

  it('changing tab writes ?tab= and selects it', async () => {
    const { tabs, settle, router } = await open('/admin');
    tabs()[2].click();
    await settle();
    await new Promise((r) => setTimeout(r, 0));
    await settle();
    expect(router.url).toBe('/admin?tab=flags');
    expect(tabs()[2].getAttribute('aria-selected')).toBe('true');
  });

  it('reads the counts again after an action', async () => {
    const { root, admin, settle, harness } = await open('/admin');
    const queue = harness.routeDebugElement!.query((d) => d.name === 'app-review-queue').componentInstance as FakeQueue;
    queue.changed.emit();
    await settle();
    expect(admin.counts).toHaveBeenCalledTimes(2);
    expect(root).toBeTruthy();
  });
});

describe('AdminPage accessibility (plan 6)', () => {
  it('has one h1 and no unnamed button', async () => {
    expectAccessiblePage((await open('/admin')).root);
  });
});
