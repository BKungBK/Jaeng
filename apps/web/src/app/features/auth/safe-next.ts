// An in-app path only: "/" followed by anything but "/" or "\" (which browsers read as another host).
// Whitespace and control characters are refused too, since browsers drop tabs and newlines from URLs.
const IN_APP = /^\/(?![/\\])[^\s\u0000-\u001f\u007f]*$/;

export function safeNext(next: string | null | undefined): string {
  return next && IN_APP.test(next) ? next : '/';
}
