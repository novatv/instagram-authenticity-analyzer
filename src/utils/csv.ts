/**
 * Minimal RFC-4180-ish CSV parser: handles quoted fields, escaped quotes,
 * CRLF/LF, and auto-detects comma / semicolon / tab delimiters.
 */
export interface CsvResult {
  headers: string[];
  rows: Record<string, string>[];
}

export function detectDelimiter(firstLine: string): string {
  const candidates = [",", ";", "\t", "|"];
  let best = ",";
  let bestCount = -1;
  for (const c of candidates) {
    const count = firstLine.split(c).length - 1;
    if (count > bestCount) {
      best = c;
      bestCount = count;
    }
  }
  return best;
}

export function parseCsv(text: string, opts: { maxRows?: number; delimiter?: string } = {}): CsvResult {
  const clean = text.replace(/^﻿/, "");
  const firstLineEnd = clean.indexOf("\n");
  const delimiter = opts.delimiter ?? detectDelimiter(firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd));
  const maxRows = opts.maxRows ?? Infinity;

  const records: string[][] = [];
  let field = "";
  let record: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i] as string;
    if (inQuotes) {
      if (ch === '"') {
        if (clean[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') inQuotes = true;
    else if (ch === delimiter) {
      record.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && clean[i + 1] === "\n") i++;
      record.push(field);
      field = "";
      if (record.some((f) => f.trim() !== "")) records.push(record);
      record = [];
      if (records.length > maxRows) break;
    } else field += ch;
  }
  if (field !== "" || record.length) {
    record.push(field);
    if (record.some((f) => f.trim() !== "")) records.push(record);
  }
  if (records.length === 0) return { headers: [], rows: [] };
  const headers = (records[0] as string[]).map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  const rows: Record<string, string>[] = [];
  for (let r = 1; r < records.length && rows.length < maxRows; r++) {
    const rec = records[r] as string[];
    const obj: Record<string, string> = {};
    headers.forEach((h, i) => {
      obj[h] = (rec[i] ?? "").trim();
    });
    rows.push(obj);
  }
  return { headers, rows };
}
