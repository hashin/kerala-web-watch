/** A week-over-week change, ready to render: text like "▲ 12" and whether that is good or bad news. */
export interface Delta { text: string; tone: 'good' | 'bad' | 'flat' }

export interface RankRowData {
  name: string;
  href: string;
  sites: number;
  brokenPct: number;
  median: number | null;
  delta?: Delta | null;
  rank?: number;
}
