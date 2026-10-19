// Starter profanity lists: clear, unambiguous words only. Thai is matched on whole words produced by
// Intl.Segmenter (never substrings); English on word boundaries after a leetspeak mapping.
export const BAD_WORDS: { th: readonly string[]; en: readonly string[] } = {
  th: [
    'เหี้ย',
    'สัส',
    'ควย',
    'หี',
    'เย็ด',
    'เงี่ยน',
    'แม่ง',
    'ตอแหล',
    'กะหรี่',
    'จัญไร',
    'เฮงซวย',
    'เสือก',
    'ฉิบหาย',
    'ถ่อย',
    'ดอกทอง',
    'ร่าน',
    'อัปรีย์',
    'สถุน',
  ],
  en: [
    'fuck',
    'fucker',
    'fucking',
    'fucked',
    'motherfucker',
    'shit',
    'shitty',
    'bullshit',
    'bitch',
    'bastard',
    'asshole',
    'arsehole',
    'dick',
    'dickhead',
    'cunt',
    'pussy',
    'whore',
    'slut',
    'wanker',
    'twat',
    'nigger',
    'faggot',
    'retard',
    'jackass',
    'douchebag',
  ],
};

const ZERO_WIDTH = /[​-‍﻿]/g;
const LEET: Record<string, string> = { '@': 'a', '0': 'o', '1': 'i', '3': 'e', $: 's', '!': 'i' };

const thSet = new Set(BAD_WORDS.th);
const enSet = new Set(BAD_WORDS.en);
const collapseAll = (s: string) => s.replace(/(.)\1+/g, '$1');
const enCollapsed = new Set(BAD_WORDS.en.map(collapseAll));
const segmenter = new Intl.Segmenter('th', { granularity: 'word' });

function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(ZERO_WIDTH, '');
}

function thaiHit(text: string): boolean {
  for (const seg of segmenter.segment(text)) {
    if (seg.isWordLike && thSet.has(seg.segment)) return true;
  }
  return false;
}

function englishHit(text: string): boolean {
  // Check both the raw text and the leetspeak-mapped one so "shit!" is not turned into "shiti".
  const mapped = text.replace(/[@0-9$!]/g, (c) => LEET[c] ?? c);
  for (const variant of [text, mapped]) {
    for (const token of variant.match(/[a-z]+/g) ?? []) {
      // Cap runs of a repeated letter at two ("fuuuuck" -> "fuuck").
      const capped = token.replace(/([a-z])\1{2,}/g, '$1$1');
      if (enSet.has(capped)) return true;
      // Only a stretched word ("fuuuck") is compared fully collapsed, so "Niger" stays clean.
      if (capped !== token && enCollapsed.has(collapseAll(token))) return true;
    }
  }
  return false;
}

export function containsBadWord(text: string): boolean {
  const t = normalize(text);
  if (t.length === 0) return false;
  return thaiHit(t) || englishHit(t);
}
