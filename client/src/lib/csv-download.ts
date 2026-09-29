/** Escape a cell for CSV, including spreadsheet formula injection. */
export function escapeCsvCell(value: unknown): string {
  let str = String(value ?? '');
  if (/^[=+\-@\t\r\n]/.test(str)) {
    str = `'${str}`;
  }
  return `"${str.replace(/"/g, '""')}"`;
}

/** Download a CSV built from row arrays. */
export function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(escapeCsvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoke on a timer so the browser has finished reading the blob first.
  // Revoking immediately can produce an empty download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
