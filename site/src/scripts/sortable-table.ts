// Progressive enhancement: without JS the table stays in the report's own order; with it, each
// column header becomes a button that sorts the rows on this page. First-party, bundled by Astro.
function textOf(row: HTMLTableRowElement, index: number): string {
  const cell = row.cells[index];
  return (cell?.dataset.sort ?? cell?.textContent ?? '').trim();
}

function enhance(table: HTMLTableElement): void {
  const body = table.tBodies[0];
  if (!body) return;
  const headers = [...table.querySelectorAll<HTMLTableCellElement>('thead th')];
  headers.forEach((th, index) => {
    const label = th.textContent?.trim() ?? '';
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    th.textContent = '';
    th.appendChild(button);
    button.addEventListener('click', () => {
      const ascending = th.getAttribute('aria-sort') !== 'ascending';
      headers.forEach((other) => other.removeAttribute('aria-sort'));
      th.setAttribute('aria-sort', ascending ? 'ascending' : 'descending');
      const rows = [...body.rows].sort((a, b) => {
        const x = textOf(a, index);
        const y = textOf(b, index);
        const numeric = Number(x) - Number(y);
        const order = Number.isNaN(numeric) ? x.localeCompare(y) : numeric;
        return ascending ? order : -order;
      });
      body.append(...rows);
    });
  });
}

document.querySelectorAll<HTMLTableElement>('table[data-sortable]').forEach(enhance);
