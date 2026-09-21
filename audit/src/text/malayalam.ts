const MALAYALAM_LETTER = /\p{Script=Malayalam}/gu;
const ANY_LETTER = /\p{L}/gu;

/** Malayalam letters as a fraction of all letters in the text. 0 when there are no letters at all
 * (not `NaN`), so callers can compare it directly against a threshold without a special case. */
export function malayalamRatio(text: string): number {
  const letters = text.match(ANY_LETTER) ?? [];
  if (letters.length === 0) return 0;
  const malayalamLetters = text.match(MALAYALAM_LETTER) ?? [];
  return malayalamLetters.length / letters.length;
}

/**
 * DESIGN §5.3 `a11y.lang`: a declared `lang` is wrong in either direction -- claiming English on a
 * page that is clearly Malayalam (screen readers mispronounce everything), or claiming Malayalam
 * on a page that barely has any. The two thresholds are deliberately asymmetric (0.3 vs 0.05)
 * because a page can legitimately mix in a little Malayalam (a name, a place) without being a
 * Malayalam page, but a page that is mostly Malayalam is unambiguously one.
 */
export function langMismatches(ratio: number, lang: string | null): boolean {
  const declaredMalayalam = (lang ?? '').trim().toLowerCase().startsWith('ml');
  if (ratio > 0.3 && !declaredMalayalam) return true;
  if (ratio < 0.05 && declaredMalayalam) return true;
  return false;
}
