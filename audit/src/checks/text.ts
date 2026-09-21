import { decodeEntities } from '../light.js';

const HEAD = /<head\b[^>]*>[\s\S]*?<\/head>/gi;
const SCRIPT_OR_STYLE = /<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG = /<[^>]+>/g;

/**
 * A rough visible-text approximation for checks that need one before WP3.5's Playwright runner can
 * supply real rendered text (`ctx.text`): strips `<head>` (title/meta are never rendered body
 * text), script/style bodies, and remaining tags, decodes entities, and collapses whitespace. Good
 * enough to compare against DESIGN §5.3's own length thresholds (`avail.blank`'s 80 characters,
 * `avail.under_construction`'s 400) -- it is not a real HTML parser, so callers should prefer
 * `ctx.text` once it exists and fall back to this only when it doesn't.
 */
export function visibleText(html: string): string {
  return decodeEntities(html.replace(HEAD, ' ').replace(SCRIPT_OR_STYLE, ' ').replace(TAG, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}
