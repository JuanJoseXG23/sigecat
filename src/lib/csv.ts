/**
 * Archivos CSV que Excel en español abre bien: separador punto y coma (la coma es el separador
 * decimal en Colombia) y BOM para que se vean las tildes.
 */

/** Celda entre comillas; neutraliza fórmulas para evitar inyección en hojas de cálculo. */
export function csvCell(value: string | number | undefined | null): string {
  const text = String(value ?? '').replace(/"/g, '""')
  return `"${/^[=+\-@\t\r]/.test(text) ? `'${text}` : text}"`
}

export function toCsv(headers: string[], rows: (string | number | undefined | null)[][]): string {
  return [headers, ...rows].map((row) => row.map(csvCell).join(';')).join('\r\n')
}

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: (string | number | undefined | null)[][],
): void {
  const blob = new Blob(['﻿', toCsv(headers, rows)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}
