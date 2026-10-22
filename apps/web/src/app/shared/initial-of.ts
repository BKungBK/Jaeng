// Thai leading vowels (U+0E40 to U+0E44) are written before the consonant they belong to; alone they are not a
// letter. Built from code points: Thai in code must not be a literal (no-thai-literals.spec.ts).
const THAI_LEADING_VOWEL = new RegExp(`^[${String.fromCharCode(0x0e40)}-${String.fromCharCode(0x0e44)}]$`, 'u');
const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });

/** The first letter of a name as one whole grapheme (a Thai consonant keeps its vowel and tone marks). */
export function initialOf(name: string): string {
  for (const { segment } of graphemes.segment(name.trim())) {
    if (!THAI_LEADING_VOWEL.test(segment)) return segment.toLocaleUpperCase('th');
  }
  return '';
}
