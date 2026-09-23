import { CHECKS } from '../../../audit/dist/checks/registry.js';
import type { Category, CheckId, CheckMeta } from '../../../audit/dist/checks/types.js';

export interface CategoryGroup {
  category: Category;
  label: string;
  checks: { id: CheckId; meta: CheckMeta }[];
}

/** Availability first (DESIGN §5.4 calls it "a gate, not a component"), then the six scored
 * categories in the same order as ADR-006's weight table and CategoryBars.astro. */
const CATEGORY_ORDER: Category[] = ['availability', 'security', 'accessibility', 'content', 'gigw', 'performance', 'identity'];

export const CATEGORY_LABELS: Record<Category, string> = {
  availability: 'Availability',
  security: 'Security',
  accessibility: 'Accessibility',
  content: 'Content & maintenance',
  gigw: 'Government guidelines (GIGW)',
  performance: 'Performance & mobile',
  identity: 'Identity & hygiene',
};

/** Every check in `CHECKS`, grouped by category in a fixed display order, each group sorted by
 * id -- the methodology page's own catalogue table. Takes `checks` as a parameter (defaulting to
 * the real registry) so a test can assert every id in a given `CHECKS`-shaped object appears
 * exactly once, without depending on the ~90-entry registry's exact current contents. */
export function checksByCategory(checks: Record<CheckId, CheckMeta> = CHECKS): CategoryGroup[] {
  const ids = (Object.keys(checks) as CheckId[]).sort((a, b) => a.localeCompare(b));
  return CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    checks: ids.filter((id) => checks[id].category === category).map((id) => ({ id, meta: checks[id] })),
  }));
}
