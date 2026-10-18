// Lucide icons (ISC), the app's only icon set (owner decision 2026-10-17: no emoji).
// Plain DOM for map markers and controls.
import {
  Camera,
  Check,
  ChevronDown,
  ChevronLeft,
  CircleCheck,
  CircleUser,
  CircleX,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Wrench,
  Image,
  RefreshCw,
  Upload,
  Construction,
  createElement,
  Droplet,
  Hand,
  IconNode,
  Lightbulb,
  Link,
  LocateFixed,
  LogOut,
  Mail,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Phone,
  Plus,
  Send,
  Trash2,
  TreeDeciduous,
  TriangleAlert,
  Waves,
  X,
} from 'lucide';

export const ICONS = {
  construction: Construction,
  lightbulb: Lightbulb,
  droplet: Droplet,
  waves: Waves,
  trash2: Trash2,
  treeDeciduous: TreeDeciduous,
  triangleAlert: TriangleAlert,
  mapPin: MapPin,
  check: Check,
  plus: Plus,
  minus: Minus,
  locateFixed: LocateFixed,
  x: X,
  circleUser: CircleUser,
  logOut: LogOut,
  mail: Mail,
  send: Send,
  hand: Hand,
  link: Link,
  messageCircle: MessageCircle,
  phone: Phone,
  camera: Camera,
  image: Image,
  chevronLeft: ChevronLeft,
  chevronDown: ChevronDown,
  upload: Upload,
  refreshCw: RefreshCw,
  fileText: FileText,
  // one icon per report status on /me (with the word, never colour alone)
  clock: Clock,
  eye: Eye,
  wrench: Wrench,
  circleCheck: CircleCheck,
  circleX: CircleX,
  eyeOff: EyeOff,
  pencil: Pencil,
} satisfies Record<string, IconNode>;

export type IconName = keyof typeof ICONS;

export const isIconName = (name: string): name is IconName => Object.hasOwn(ICONS, name);

/** An inline SVG drawn in currentColor, hidden from assistive tech (callers label the control). */
export function iconElement(name: IconName, size = 20): SVGElement {
  const svg = createElement(ICONS[name], { width: size, height: size, 'aria-hidden': 'true', focusable: 'false' });
  svg.classList.add('icon', `icon-${name}`);
  return svg;
}
