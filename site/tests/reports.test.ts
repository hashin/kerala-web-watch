import { describe, expect, it } from 'vitest';
import { reportKpis, type ReportNumbers } from '../src/lib/reports';

const NOW: ReportNumbers = { sites: 1567, deep_audited: 299, down: 114, hijacked: 1, broken: 132, healthy: 5, median_score: 54 };
const byLabel = (kpis: ReturnType<typeof reportKpis>, label: string) => kpis.find((k) => k.label === label)!;

describe('reportKpis', () => {
  it('shows this month numbers with Indian digit grouping', () => {
    const k = reportKpis({ ...NOW, sites: 150000 }, null);
    expect(byLabel(k, 'Sites tracked').value).toBe('1,50,000');
  });

  it('adds down, hijacked and broken into one headline number', () => {
    expect(byLabel(reportKpis(NOW, null), 'Down or broken').value).toBe('247');
  });

  it('has no change lines for the first ever report', () => {
    expect(reportKpis(NOW, null).map((k) => k.delta)).toEqual([null, null, null, null, null]);
  });

  it('turns a month-over-month change into a compare-with-last-month line', () => {
    const k = reportKpis(NOW, { sites: 67, deep_audited: 0, down: -5, hijacked: 0, broken: 3, healthy: 5, median_score: 2 });
    expect(byLabel(k, 'Sites tracked').delta).toEqual({ text: '▲ 67', tone: 'good' });
    expect(byLabel(k, 'Deep-audited').delta).toEqual({ text: 'no change', tone: 'flat' });
    expect(byLabel(k, 'Healthy').delta).toEqual({ text: '▲ 5', tone: 'good' });
    expect(byLabel(k, 'Median score').delta).toEqual({ text: '▲ 2', tone: 'good' });
  });

  it('nets the three broken statuses, and counts a rise as bad news', () => {
    const rose = reportKpis(NOW, { down: 10, hijacked: 1, broken: 4 });
    expect(byLabel(rose, 'Down or broken').delta).toEqual({ text: '▲ 15', tone: 'bad' });
    const fell = reportKpis(NOW, { down: -10, hijacked: 0, broken: 4 });
    expect(byLabel(fell, 'Down or broken').delta).toEqual({ text: '▼ 6', tone: 'good' });
  });

  it('skips the median line when there is no median (nothing deep-audited yet)', () => {
    const k = reportKpis({ ...NOW, median_score: null }, { median_score: null });
    expect(byLabel(k, 'Median score').value).toBe('—');
    expect(byLabel(k, 'Median score').delta).toBeNull();
  });

  it('a change of zero from a previous median of zero is still a comparison', () => {
    expect(byLabel(reportKpis({ ...NOW, median_score: 0 }, { median_score: 0 }), 'Median score').delta).toEqual({ text: 'no change', tone: 'flat' });
  });
});
