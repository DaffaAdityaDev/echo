export function formatContentSize(length: number): string {
  if (length >= 1_000_000) return `${(length / 1_000_000).toFixed(1)} MB`;
  if (length >= 1_000) return `${Math.round(length / 1_000)} KB`;
  return `${length} chars`;
}

export function formatCompactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(0)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return `${value}`;
}
