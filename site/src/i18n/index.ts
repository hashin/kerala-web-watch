import en from './en.json';
import ml from './ml.json';

export type Locale = 'en' | 'ml';
export const LOCALES: Locale[] = ['en', 'ml'];
export const DEFAULT_LOCALE: Locale = 'en';

export type TranslationKey = keyof typeof en;

const DICTIONARIES: Record<Locale, Record<TranslationKey, string>> = { en, ml };

/**
 * Looks up `key` in `locale`'s dictionary, falling back to English if a key is ever missing.
 * WP4.5's own scope is wiring this lookup and the `/ml/` routing, not translation -- `ml.json`
 * intentionally carries the same English text as `en.json` for now (ADR pending human review of
 * a translated sample, per IMPLEMENTATION.md's WP5.3), so every render below is correct today and
 * simply gets better copy once WP5.3 fills in real Malayalam values, with no code change needed.
 */
export function t(locale: Locale, key: TranslationKey): string {
  return DICTIONARIES[locale][key] ?? DICTIONARIES[DEFAULT_LOCALE][key];
}
