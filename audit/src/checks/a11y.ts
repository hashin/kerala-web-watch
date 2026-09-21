import { langMismatches, malayalamRatio } from '../text/malayalam.js';
import { visibleText } from './text.js';
import type { Check, CheckResult } from './types.js';

const HTML_LANG = /<html\b[^>]*\blang\s*=\s*["']([^"']*)["']/i;
const TABINDEX_NEGATIVE = /\btabindex\s*=\s*["']-1["']/i;
const OUTLINE_NONE = /outline\s*:\s*(none|0)\b/i;

function htmlLang(html: string): string | null {
  return html.match(HTML_LANG)?.[1] ?? null;
}

function textOf(ctx: { text?: string; html?: string }): string | undefined {
  if (ctx.text !== undefined) return ctx.text;
  return ctx.html !== undefined ? visibleText(ctx.html) : undefined;
}

/** axe-core violation counts by impact -- 0 is a real, meaningful "none found", so every one of
 * these checks treats `ctx.axe === undefined` (never ran) as `na` and a 0 count as `pass`. */
export const A11Y_CHECKS: Check[] = [
  {
    id: 'a11y.axe_critical',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.axe_critical', r: 'na' };
      return ctx.axe.critical > 0
        ? { id: 'a11y.axe_critical', r: 'fail', ev: `${ctx.axe.critical} critical violation(s)` }
        : { id: 'a11y.axe_critical', r: 'pass' };
    },
  },
  {
    id: 'a11y.axe_serious',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.axe_serious', r: 'na' };
      return ctx.axe.serious > 0
        ? { id: 'a11y.axe_serious', r: 'fail', ev: `${ctx.axe.serious} serious violation(s)` }
        : { id: 'a11y.axe_serious', r: 'pass' };
    },
  },
  {
    id: 'a11y.axe_moderate_minor',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.axe_moderate_minor', r: 'na' };
      const count = ctx.axe.moderate + ctx.axe.minor;
      return count > 0 ? { id: 'a11y.axe_moderate_minor', r: 'fail', ev: `${count} moderate/minor violation(s)` } : { id: 'a11y.axe_moderate_minor', r: 'pass' };
    },
  },
  {
    id: 'a11y.lang',
    run: (ctx): CheckResult => {
      const text = textOf(ctx);
      const ratio = ctx.malayalamRatio ?? (text !== undefined ? malayalamRatio(text) : undefined);
      if (ratio === undefined || ctx.html === undefined) return { id: 'a11y.lang', r: 'na' };
      const lang = htmlLang(ctx.html);
      return langMismatches(ratio, lang)
        ? { id: 'a11y.lang', r: 'fail', ev: `<html lang="${lang ?? ''}"> vs. ${(ratio * 100).toFixed(0)}% Malayalam content` }
        : { id: 'a11y.lang', r: 'pass' };
    },
  },
  {
    id: 'a11y.alt',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.alt', r: 'na' };
      const count = ctx.axe.byRule['image-alt'] ?? 0;
      return count > 0 ? { id: 'a11y.alt', r: 'fail', ev: `${count} image(s) missing alt text` } : { id: 'a11y.alt', r: 'pass' };
    },
  },
  {
    id: 'a11y.contrast',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.contrast', r: 'na' };
      const count = ctx.axe.byRule['color-contrast'] ?? 0;
      return count > 0 ? { id: 'a11y.contrast', r: 'fail', ev: `${count} low-contrast element(s)` } : { id: 'a11y.contrast', r: 'pass' };
    },
  },
  {
    id: 'a11y.headings',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.headings', r: 'na' };
      const noH1 = ctx.axe.byRule['page-has-heading-one'] ?? 0;
      const skipped = ctx.axe.byRule['heading-order'] ?? 0;
      if (noH1 === 0 && skipped === 0) return { id: 'a11y.headings', r: 'pass' };
      const reasons = [noH1 > 0 && 'no <h1>', skipped > 0 && 'heading levels skipped'].filter((r): r is string => r !== false);
      return { id: 'a11y.headings', r: 'fail', ev: reasons.join(', ') };
    },
  },
  {
    id: 'a11y.labels',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.labels', r: 'na' };
      const count = ctx.axe.byRule['label'] ?? 0;
      return count > 0 ? { id: 'a11y.labels', r: 'fail', ev: `${count} form control(s) without a label` } : { id: 'a11y.labels', r: 'pass' };
    },
  },
  {
    id: 'a11y.skip_link',
    run: (ctx): CheckResult => {
      if (ctx.axe === undefined) return { id: 'a11y.skip_link', r: 'na' };
      // axe's own "bypass" rule fails exactly when the page gives no way to skip repeated content.
      const count = ctx.axe.byRule['bypass'] ?? 0;
      return count > 0 ? { id: 'a11y.skip_link', r: 'fail' } : { id: 'a11y.skip_link', r: 'pass' };
    },
  },
  {
    id: 'a11y.keyboard',
    run: (ctx): CheckResult => {
      if (ctx.html === undefined && ctx.cssTexts === undefined) return { id: 'a11y.keyboard', r: 'na' };
      const haystack = [ctx.html ?? '', ...(ctx.cssTexts ?? [])].join('\n');
      const hasNegativeTabindex = TABINDEX_NEGATIVE.test(ctx.html ?? '');
      const hasOutlineNone = OUTLINE_NONE.test(haystack);
      // Heuristic (DESIGN §5.3): neither signal alone is conclusive (tabindex="-1" is often
      // legitimate for programmatic focus; outline:none is often paired with a custom focus style
      // we can't detect statically), so this only fires -- as a soft `warn`, not a `fail` -- when
      // both appear together, which is the combination most likely to actually trap keyboard users.
      return hasNegativeTabindex && hasOutlineNone
        ? { id: 'a11y.keyboard', r: 'warn', ev: 'tabindex="-1" alongside outline:none' }
        : { id: 'a11y.keyboard', r: 'pass' };
    },
  },
  {
    id: 'a11y.lighthouse',
    run: (ctx): CheckResult => {
      if (!ctx.lighthouse) return { id: 'a11y.lighthouse', r: 'na' };
      return { id: 'a11y.lighthouse', r: 'pass', ev: `${ctx.lighthouse.accessibility}/100` };
    },
  },
];
