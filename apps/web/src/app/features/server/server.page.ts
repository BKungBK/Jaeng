import { ChangeDetectionStrategy, Component, computed, ElementRef, inject, input, signal } from '@angular/core';
import { NavController } from '@ionic/angular';
import { I18nService } from '../../core/i18n.service';
import {
  normalizeServerUrl,
  ServerCheck,
  ServerCheckError,
  ServerConfigService,
  serverOrigin,
  type ServerReason,
} from '../../core/server-config.service';
import type { MessageKey } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { BackdropComponent } from '../../shared/backdrop.component';
import { IconComponent } from '../../shared/icon.component';

type Shown = ServerReason | 'unset' | 'ok';

/**
 * `/server` (spec 8.4): where the app finds its server. The APK is built for one address, but a
 * computer's IP changes, so the reader can fix it here without a new build. The app opens this page
 * by itself (`?reason=`) when it cannot reach the server.
 */
@Component({
  selector: 'app-server',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [BackdropComponent, IconComponent, TPipe],
  templateUrl: 'server.page.html',
  styleUrl: 'server.page.scss',
  host: { class: 'ion-page' },
})
export class ServerPage {
  private server = inject(ServerConfigService);
  private nav = inject(NavController);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly i18n = inject(I18nService);

  /** Why the app sent the reader here (query param, bound by withComponentInputBinding). */
  readonly reason = input<string | null | undefined>(null);

  /** on the web the server is the page itself, so that is the address to test */
  protected readonly value = signal(this.server.native ? this.server.address() : serverOrigin());
  protected readonly testing = signal(false);
  protected readonly saving = signal(false);
  protected readonly result = signal<ServerCheck | null>(null);
  protected readonly failed = signal(false);

  /** The reader may save only an address that has just passed the test. */
  protected readonly canSave = computed(() => {
    const r = this.result();
    return !!r && r.ok && r.address === normalizeServerUrl(this.value()) && !this.saving();
  });
  protected readonly shown = computed<Shown | null>(() => {
    const r = this.result();
    if (r) return r.ok ? 'ok' : r.reason;
    const why = this.reason();
    return why === 'unset' || why === 'unreachable' || why === 'notJaeng' || why === 'invalid' ? why : null;
  });

  protected readonly resultKey = computed<MessageKey | null>(() => {
    const s = this.shown();
    return s ? `server.result.${s}` : null;
  });

  ionViewDidEnter() {
    this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }

  protected onInput(event: Event) {
    this.value.set((event.target as HTMLInputElement).value);
    this.result.set(null);
    this.failed.set(false);
  }

  protected async test() {
    if (this.testing()) return;
    this.testing.set(true);
    this.failed.set(false);
    try {
      this.result.set(await this.server.check(this.value()));
    } finally {
      this.testing.set(false);
    }
  }

  protected async save() {
    if (!this.canSave()) return;
    this.saving.set(true);
    try {
      await this.server.save(this.value()); // reloads the app on success
    } catch (e) {
      if (e instanceof ServerCheckError) this.result.set({ ok: false, reason: e.reason });
      else this.failed.set(true);
    } finally {
      this.saving.set(false);
    }
  }

  protected goBack() {
    void this.nav.navigateRoot('/');
  }
}
