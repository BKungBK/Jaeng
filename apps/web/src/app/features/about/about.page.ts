import { ChangeDetectionStrategy, Component, ElementRef, inject } from '@angular/core';
import type { MessageKey } from '../../i18n/keys';
import { TPipe } from '../../i18n/t.pipe';
import { EmergencyBoxComponent } from '../../shared/emergency-box.component';
import { IconComponent } from '../../shared/icon.component';
import { LanguageChoiceComponent } from '../../shared/language-choice.component';
import { ThemeChoiceComponent } from '../../shared/theme-choice.component';
import { MapReturnService } from '../report-new/map-return.service';

const RULES: MessageKey[] = ['about.rule1', 'about.rule2', 'about.rule3', 'about.rule4'];
const PRIVACY: MessageKey[] = ['about.privacy1', 'about.privacy2', 'about.privacy3', 'about.privacy4', 'about.privacy5'];
/** Names are proper names, the same in both languages; only what each one is gets translated. */
const CREDITS: { what: MessageKey; who: string; href: string }[] = [
  { what: 'about.creditMapData', who: 'OpenStreetMap contributors (ODbL)', href: 'https://www.openstreetmap.org/copyright' },
  { what: 'about.creditTiles', who: 'OpenFreeMap · OpenMapTiles', href: 'https://openfreemap.org' },
  { what: 'about.creditAreas', who: 'OCHA COD-AB (HDX)', href: 'https://data.humdata.org/dataset/cod-ab-tha' },
  { what: 'about.creditEngine', who: 'MapLibre GL JS (BSD-3)', href: 'https://maplibre.org' },
  { what: 'about.creditIcons', who: 'Lucide (ISC)', href: 'https://lucide.dev' },
  { what: 'about.creditFonts', who: 'Anuphan (OFL)', href: 'https://fonts.google.com' },
];

/** `/about` (spec 3.11, handoff "/about"): what Jaeng is, its rules, emergency numbers, privacy, display, credits. */
@Component({
  selector: 'app-about',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TPipe, IconComponent, EmergencyBoxComponent, LanguageChoiceComponent, ThemeChoiceComponent],
  templateUrl: 'about.page.html',
  styleUrl: 'about.page.scss',
  host: { class: 'ion-page' },
})
export class AboutPage {
  private back = inject(MapReturnService);
  private host = inject<ElementRef<HTMLElement>>(ElementRef);
  protected readonly rules = RULES;
  protected readonly privacy = PRIVACY;
  protected readonly credits = CREDITS;

  ionViewDidEnter() {
    this.host.nativeElement.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true });
  }

  protected goBack() {
    void this.back.go();
  }
}
