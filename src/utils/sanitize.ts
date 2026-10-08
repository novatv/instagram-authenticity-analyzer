/** Remove control characters, trim and cap length. Safe for display and analysis. */
export function sanitizeText(value: unknown, maxLen = 1000): string {
  if (value === null || value === undefined) return "";
  const s = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .trim();
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}

export function sanitizeUsername(value: unknown): string | null {
  const s = sanitizeText(value, 60).replace(/^@/, "").toLowerCase();
  if (!s || !/^[a-z0-9._]{1,30}$/.test(s)) return null;
  return s;
}

export function toNumber(value: unknown): number | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const s = String(value).replace(/[,\s]/g, "");
  if (!/^-?\d+(\.\d+)?$/.test(s)) return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

export function toBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (value === null || value === undefined || value === "") return undefined;
  const s = String(value).trim().toLowerCase();
  if (["1", "true", "yes", "y", "si", "sí"].includes(s)) return true;
  if (["0", "false", "no", "n"].includes(s)) return false;
  return undefined;
}

export function toIsoDate(value: unknown): string | undefined {
  if (value === null || value === undefined || value === "") return undefined;
  if (typeof value === "number") {
    const ms = value > 1e12 ? value : value * 1000; // seconds vs ms
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  const s = String(value).trim();
  if (/^\d{9,13}$/.test(s)) return toIsoDate(Number(s));
  const t = Date.parse(s);
  return Number.isFinite(t) ? new Date(t).toISOString() : undefined;
}
