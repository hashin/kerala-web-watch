import { t, type Locale } from '../i18n';
import type { SiteView } from './data';

/** ADR-029: a college is government, government-aided, or not yet confirmed by an official document. */
export type CollegeSection = 'government' | 'aided' | 'unconfirmed';

export const SECTIONS: CollegeSection[] = ['government', 'aided', 'unconfirmed'];

export function collegeSection(site: Pick<SiteView, 'tier' | 'management'>): CollegeSection | null {
  if (site.tier !== 'college') return null;
  return site.management ?? 'unconfirmed';
}

export function collegesBySection(sites: SiteView[]): Record<CollegeSection, SiteView[]> {
  const out: Record<CollegeSection, SiteView[]> = { government: [], aided: [], unconfirmed: [] };
  for (const site of sites) {
    const section = collegeSection(site);
    if (section) out[section].push(site);
  }
  for (const list of Object.values(out)) list.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export interface CollegeText {
  section: CollegeSection;
  label: string;
  meaning: string;
  seeAll: string;
  href: string;
}

/** The only route by which a college's management reaches a page (ADR-026): a label is never
 * returned without the sentence that says what it means. */
export function collegeText(section: CollegeSection, locale: Locale): CollegeText {
  // Section pages exist in English only (like /kinds/ and /districts/); /ml/ covers site pages.
  return {
    section,
    label: t(locale, `college.${section}.label`),
    meaning: t(locale, `college.${section}.meaning`),
    seeAll: t(locale, `college.${section}.seeAll`),
    href: section === 'unconfirmed' ? '/colleges/' : `/colleges/${section}/`,
  };
}

export function collegeManagementText(site: Pick<SiteView, 'tier' | 'management'>, locale: Locale): CollegeText | null {
  const section = collegeSection(site);
  return section ? collegeText(section, locale) : null;
}
