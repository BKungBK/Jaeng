import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AppComponent } from './app.component';
import { glassNav } from './core/motion';

describe('AppComponent', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
      providers: [provideRouter([])]
    }).compileComponents();
    const fixture = TestBed.createComponent(AppComponent);
    fixture.detectChanges();
    return { fixture, root: fixture.nativeElement as HTMLElement };
  }

  it('should create the app', async () => {
    const { fixture } = await setup();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('plays the intro and moves between pages with the glass transition', async () => {
    const { root } = await setup();
    expect(root.querySelector('app-intro')).not.toBeNull();
    const outlet = root.querySelector('ion-router-outlet') as HTMLElement & { animation?: unknown };
    expect(outlet.animation).toBe(glassNav);
  });
});
