// The four danger-level shapes (● ▲ ◆ ⚠, spec 3.3) drawn as one solid SVG set, so they share a
// weight everywhere: chips, beacon and cluster badges, tooltip.
import { Component, input } from '@angular/core';
import type { DangerLevel } from '@jaeng/shared/levels';

export const LEVEL_SHAPE_PATHS: Record<DangerLevel, string> = {
  0: 'M6 1a5 5 0 1 1 0 10A5 5 0 1 1 6 1z',
  1: 'M6 1.2l5.3 9.4H.7z',
  2: 'M6 .6L11.4 6 6 11.4.6 6z',
  3: 'M6 .6l5.6 10.2H.4zM5.25 4.1v3.7h1.5V4.1zm0 4.6v1.3h1.5V8.7z',
};

const SVG_NS = 'http://www.w3.org/2000/svg';

export function levelShapeSvg(level: DangerLevel): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('data-level', String(level));
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', LEVEL_SHAPE_PATHS[level]);
  path.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(path);
  return svg;
}

@Component({
  selector: 'app-level-shape',
  template: `<svg viewBox="0 0 12 12" aria-hidden="true" [attr.data-level]="level()">
    <path fill-rule="evenodd" [attr.d]="paths[level()]" />
  </svg>`,
  styles: `
    :host {
      display: inline-flex;
      vertical-align: -0.1em;
    }
    svg {
      width: 0.85em;
      height: 0.85em;
      fill: currentColor;
    }
  `,
})
export class LevelShapeComponent {
  readonly level = input.required<DangerLevel>();
  protected readonly paths = LEVEL_SHAPE_PATHS;
}
