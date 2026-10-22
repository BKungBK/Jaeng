import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { DISPLAY_NAME_MAX, DISPLAY_NAME_MIN } from '@jaeng/shared/report';
import { AuthService } from '../../core/auth.service';
import { DeviceService } from '../../core/device.service';
import { I18nService, type Said } from '../../core/i18n.service';
import { TPipe } from '../../i18n/t.pipe';
import { AvatarComponent } from '../../shared/avatar.component';
import { IconComponent } from '../../shared/icon.component';
import { MeService } from '../me/me.service';

let nextId = 0;

/**
 * The sign-up profile step: a nickname (which is the name everyone sees) and, if they like, a picture.
 * The picture is sent the moment it is chosen; the nickname is saved with "Start", which is what marks the
 * profile as set up. It sits in the login form's own frame and uses the same fields and buttons.
 */
@Component({
  selector: 'app-profile-form',
  templateUrl: 'profile-form.component.html',
  styleUrls: ['profile-form.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [AvatarComponent, IconComponent, TPipe],
})
export class ProfileFormComponent {
  private me = inject(MeService);
  private device = inject(DeviceService);
  protected readonly auth = inject(AuthService);
  protected readonly i18n = inject(I18nService);

  /** Emits once the profile is saved. */
  readonly done = output<void>();
  /** The sheet that opens by itself has no close button: this is the way out for someone who is not who it thinks. */
  readonly signOutLink = input(false);

  protected readonly id = `profile-${++nextId}`;
  protected readonly min = DISPLAY_NAME_MIN;
  protected readonly max = DISPLAY_NAME_MAX;
  protected readonly name = signal('');
  protected readonly uploading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<Said>(null);
  protected readonly photoError = signal<Said>(null);

  protected readonly avatarPath = computed(() => this.auth.profile()?.avatar_path ?? null);
  /** the counter counts code points, like the API */
  protected readonly nameLength = computed(() => [...this.name().trim()].length);
  protected readonly nameOk = computed(() => {
    const trimmed = this.name().trim();
    const n = [...trimmed].length;
    return n >= DISPLAY_NAME_MIN && n <= DISPLAY_NAME_MAX && !/[\p{Cc}\p{Cf}]/u.test(trimmed);
  });
  protected readonly canStart = computed(() => this.nameOk() && !this.uploading() && !this.saving());

  protected onName(event: Event) {
    this.name.set((event.target as HTMLInputElement).value);
  }

  /** The APK has its own camera and photo picker; the web clicks the hidden file input. */
  protected async openCamera(fallback: HTMLInputElement) {
    if (!this.device.native) return fallback.click();
    const file = await this.device.takePhoto();
    if (file) void this.send(file);
  }

  protected async openGallery(fallback: HTMLInputElement) {
    if (!this.device.native) return fallback.click();
    const [file] = await this.device.pickPhotos(1);
    if (file) void this.send(file);
  }

  protected picked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // the same file can be picked again after it was removed
    if (file) void this.send(file);
  }

  private async send(file: File) {
    if (this.uploading()) return;
    this.uploading.set(true);
    this.photoError.set(null);
    try {
      this.auth.setProfile({ avatar_path: await this.me.uploadAvatar(file) });
    } catch (e) {
      this.photoError.set({ error: e });
    } finally {
      this.uploading.set(false);
    }
  }

  protected async removePhoto() {
    if (this.uploading()) return;
    this.uploading.set(true);
    this.photoError.set(null);
    try {
      await this.me.removeAvatar();
      this.auth.setProfile({ avatar_path: null });
    } catch (e) {
      this.photoError.set({ error: e });
    } finally {
      this.uploading.set(false);
    }
  }

  protected async submit(event: Event) {
    event.preventDefault();
    if (!this.canStart()) return;
    this.saving.set(true);
    this.error.set(null);
    try {
      const saved = await this.me.completeProfile(this.name().trim());
      this.auth.setProfile({ display_name: saved.display_name, onboarded_at: new Date().toISOString() });
      this.done.emit();
    } catch (e) {
      this.error.set({ error: e });
    } finally {
      this.saving.set(false);
    }
  }

  protected async signOut() {
    await this.auth.signOut();
  }
}
