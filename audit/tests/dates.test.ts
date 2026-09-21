import { describe, expect, it } from 'vitest';
import { daysBetween, findAllDates, findCopyrightYear, findFirstDate, findLastUpdatedDate, findNewestNewsDate } from '../src/text/dates.js';

describe('findFirstDate', () => {
  it('parses dd-mm-yyyy', () => {
    expect(findFirstDate('Published on 05-03-2024 by the office')?.toISOString().slice(0, 10)).toBe('2024-03-05');
  });
  it('parses dd/mm/yyyy', () => {
    expect(findFirstDate('Published on 05/03/2024')?.toISOString().slice(0, 10)).toBe('2024-03-05');
  });
  it('parses yyyy-mm-dd', () => {
    expect(findFirstDate('Published on 2024-03-05')?.toISOString().slice(0, 10)).toBe('2024-03-05');
  });
  it('parses "d Month yyyy" in English', () => {
    expect(findFirstDate('Updated on 5 March 2024')?.toISOString().slice(0, 10)).toBe('2024-03-05');
  });
  it('parses "d Month yyyy" with a Malayalam month name', () => {
    expect(findFirstDate('5 മാർച്ച് 2024-ന് പുതുക്കി')?.toISOString().slice(0, 10)).toBe('2024-03-05');
  });
  it('returns null when no recognisable date is present', () => {
    expect(findFirstDate('There is no date on this page at all.')).toBeNull();
  });
  it('rejects an out-of-range date rather than silently normalising it', () => {
    expect(findFirstDate('Deadline: 32-13-2024')).toBeNull();
  });
});

describe('findAllDates', () => {
  it('finds every date in the text, in multiple formats', () => {
    const dates = findAllDates('First on 01-01-2020, then 2021-06-15, then 3 July 2022.');
    expect(dates.map((d) => d.toISOString().slice(0, 10)).sort()).toEqual(['2020-01-01', '2021-06-15', '2022-07-03']);
  });
  it('returns an empty array when nothing matches', () => {
    expect(findAllDates('no dates here')).toEqual([]);
  });
});

describe('findLastUpdatedDate', () => {
  it('finds a date near an English "last updated" marker', () => {
    expect(findLastUpdatedDate('Contact us. Last updated: 10-01-2023. Thank you.')?.toISOString().slice(0, 10)).toBe('2023-01-10');
  });
  it('finds a date near a Malayalam marker', () => {
    expect(findLastUpdatedDate('അവസാനം പുതുക്കിയത്: 15 സെപ്റ്റംബർ 2026.')?.toISOString().slice(0, 10)).toBe('2026-09-15');
  });
  it('does not treat a bare date elsewhere on the page as a last-updated date', () => {
    expect(findLastUpdatedDate('The office was founded on 01-01-1990 and has no update marker.')).toBeNull();
  });
  it('returns null when the marker is present but no date follows within the proximity window', () => {
    const farAway = `Last updated ${'x'.repeat(60)} 01-01-2020`;
    expect(findLastUpdatedDate(farAway)).toBeNull();
  });
});

describe('findNewestNewsDate', () => {
  it('returns the newest of several dated items in a news section', () => {
    const text = 'News and Announcements: 15-03-2019 old notice; 02-01-2018 older notice.';
    expect(findNewestNewsDate(text)?.toISOString().slice(0, 10)).toBe('2019-03-15');
  });
  it('returns null when no news/announcements/tenders section is detected at all', () => {
    expect(findNewestNewsDate('Just an ordinary page with a date 01-01-2020 on it.')).toBeNull();
  });
});

describe('findCopyrightYear', () => {
  it('finds a year after a © symbol', () => {
    expect(findCopyrightYear('© 2019 Department. All rights reserved.')).toBe(2019);
  });
  it('finds a year after the word "copyright"', () => {
    expect(findCopyrightYear('Copyright 2026, all rights reserved')).toBe(2026);
  });
  it('finds a year after "(c)"', () => {
    expect(findCopyrightYear('(c) 2022 Department')).toBe(2022);
  });
  it('returns null when no copyright marker is present', () => {
    expect(findCopyrightYear('This page mentions the year 2019 but no copyright marker.')).toBeNull();
  });
});

describe('daysBetween', () => {
  it('is symmetric and measured in whole days', () => {
    const a = new Date('2026-01-01T00:00:00.000Z');
    const b = new Date('2026-01-11T00:00:00.000Z');
    expect(daysBetween(a, b)).toBe(10);
    expect(daysBetween(b, a)).toBe(10);
  });
});
