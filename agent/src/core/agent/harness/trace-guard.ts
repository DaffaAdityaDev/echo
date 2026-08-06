const FAKE_TRACE_PATTERNS: RegExp[] = [
  /\bTool Action:\s*[A-Za-z_]+/i,
  /\bObservation:\s*[A-Za-z_]+/i,
  /\bSearch results for\s*"/i,
];

export function isFakeToolTrace(content: string): boolean {
  if (!content) return false;
  return FAKE_TRACE_PATTERNS.some((pattern) => pattern.test(content));
}
