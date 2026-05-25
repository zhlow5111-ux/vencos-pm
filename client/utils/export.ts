// CSV Export utilities

function escapeCsvValue(val: string | number): string {
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

function toCsvRow(values: (string | number)[]): string {
  return values.map(escapeCsvValue).join(',');
}

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const bom = '\uFEFF'; // UTF-8 BOM for Excel Chinese support
  const csv = bom + [toCsvRow(headers), ...rows.map(toCsvRow)].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
