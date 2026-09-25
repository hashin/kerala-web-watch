import assert from 'node:assert/strict';
import { test } from 'node:test';
import { parseCollegiateTable, parseDteTable } from './colleges.js';

// Fixture shape copied from a real fetch of dtekerala.gov.in's engineering and polytechnic
// institutiondetail pages (2026-09-25): both a "http//host" typo (missing colon) and a
// "http://http://host" typo (the whole scheme pasted twice) show up across real rows, plus a
// domain-level typo ("www,carmelpoly.in") that no mechanical scheme fix can safely repair.
const DTE_FIXTURE = `
<table class="table table-bordered">
  <thead><tr><th>SL No</th><th>Name</th><th>Established</th><th>Website</th></tr></thead>
  <tbody>
    <tr>
      <td>1</td>
      <td>Government Engineering College Idukki</td>
      <td>2000</td>
      <td><a href="http//gecidukki.ac.in" target="_blank"><b>http//gecidukki.ac.in</b></a></td>
    </tr>
    <tr>
      <td>2</td>
      <td>Government Engineering College Kozhikode</td>
      <td>1999</td>
      <td><a href="http://geckkd.ac.in" target="_blank"><b>http://geckkd.ac.in</b></a></td>
    </tr>
    <tr>
      <td>3</td>
      <td>An institute with no website on file</td>
      <td>2010</td>
      <td></td>
    </tr>
    <tr>
      <td>4</td>
      <td>Government Polytechnic College Mananthavady</td>
      <td>1980</td>
      <td><a href="http://http://gptcmdy.ac.in/" target="_blank"><b>http://http://gptcmdy.ac.in/</b></a></td>
    </tr>
    <tr>
      <td>5</td>
      <td>Carmel Polytechnic College, Alappuzha</td>
      <td>1990</td>
      <td><a href="http://www,carmelpoly.in" target="_blank"><b>http://www,carmelpoly.in</b></a></td>
    </tr>
  </tbody>
</table>
`;

test('parseDteTable repairs a source row missing the URL scheme colon', () => {
  const rows = parseDteTable(DTE_FIXTURE);
  const idukki = rows.find((r) => r.name === 'Government Engineering College Idukki');
  assert.equal(idukki?.url, 'http://gecidukki.ac.in');
});

test('parseDteTable keeps a well-formed row untouched', () => {
  const rows = parseDteTable(DTE_FIXTURE);
  const kozhikode = rows.find((r) => r.name === 'Government Engineering College Kozhikode');
  assert.equal(kozhikode?.url, 'http://geckkd.ac.in');
});

test('parseDteTable skips a row with no website link', () => {
  const rows = parseDteTable(DTE_FIXTURE);
  assert.equal(rows.some((r) => r.name === 'An institute with no website on file'), false);
});

test('parseDteTable collapses a source row with the scheme pasted twice', () => {
  const rows = parseDteTable(DTE_FIXTURE);
  const mananthavady = rows.find((r) => r.name === 'Government Polytechnic College Mananthavady');
  assert.equal(mananthavady?.url, 'http://gptcmdy.ac.in/');
});

test('parseDteTable passes a domain-level typo through unchanged rather than guessing a fix', () => {
  // "www,carmelpoly.in" (comma for dot) is syntactically a valid URL per WHATWG rules, so it isn't
  // caught by isAbsoluteHttpUrl -- and shouldn't be silently rewritten, either: which domain the
  // source actually meant isn't ours to guess. It surfaces as an unreachable candidate during the
  // normal curation resolve-check instead, same as any other dead link.
  const rows = parseDteTable(DTE_FIXTURE);
  const carmel = rows.find((r) => r.name === 'Carmel Polytechnic College, Alappuzha');
  assert.equal(carmel?.url, 'http://www,carmelpoly.in');
});

// Fixture shape copied from a real fetch of collegiateedu.kerala.gov.in/?page_id=223 (2026-09-25):
// most rows' link is a bare "/" back to the directorate homepage, not a real per-college site.
const COLLEGIATE_FIXTURE = `
<table class='table table-striped table-bordered table-responsive table-hover'>
  <tr style='background:#34D293'><td>Sl No</td><td>College Name</td><td>Email</td></tr>
  <tr><td>1</td><td><a href='/' target='_blank'>Government Arts College Thycadu</a></td><td>x@example.com</td><tr>
  <tr><td>2</td><td><a href='/dcekerala/nedumangad/' target='_blank'>Government College Nedumangad</a></td><td>y@example.com</td><tr>
</table>
`;

test('parseCollegiateTable drops rows whose link is just "/" (no real college site)', () => {
  const rows = parseCollegiateTable(COLLEGIATE_FIXTURE);
  assert.equal(rows.some((r) => r.name === 'Government Arts College Thycadu'), false);
});

test('parseCollegiateTable resolves a real subpage against the directorate domain', () => {
  const rows = parseCollegiateTable(COLLEGIATE_FIXTURE);
  const nedumangad = rows.find((r) => r.name === 'Government College Nedumangad');
  assert.equal(nedumangad?.url, 'https://collegiateedu.kerala.gov.in/dcekerala/nedumangad/');
});
