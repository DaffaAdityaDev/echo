export interface ParsedXmlToolCall {
  name: string;
  args: Record<string, unknown>;
}

// Generic protocol tags that are never legitimate in an assistant's final
// answer, independent of which tools are currently enabled.
const PROTOCOL_TAG_NAMES = ["dsml", "tool_call", "tool_calls", "invoke", "parameter", "user_objective", "function"];

function escapeRegExp(name: string): string {
  return name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * True when content contains markup belonging to the tool-call protocol —
 * either a generic protocol tag (<tool_call>, <parameter>, <user_objective>,
 * <function=...>, ...) or a tag matching one of the known tool names. Used to
 * decide whether unparseable XML-ish content should escalate to recovery
 * instead of being treated as ordinary text: "<support@example.com>", "a<b"
 * or inline HTML are NOT protocol markup and must not escalate.
 */
export function hasProtocolMarkup(content: string, knownToolNames: Set<string>): boolean {
  const names = [...PROTOCOL_TAG_NAMES, ...knownToolNames];
  return new RegExp(`</?(?:${names.map(escapeRegExp).join("|")})[\\s\\S]*?>`).test(content);
}

function parseArgs(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (!trimmed) return {};

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    // Fall through to the brace-stripped attempt below.
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed.slice(1, -1)) as unknown;
      return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
    } catch {
      // Unparseable body — degrade to empty args.
    }
  }

  return {};
}

function parseLegacyFunctionCall(content: string): ParsedXmlToolCall | null {
  const funcMatch = content.match(/<function=(.*?)>/);
  if (!funcMatch) return null;

  const name = funcMatch[1].trim();
  const args: Record<string, unknown> = {};
  const paramRegex = /<parameter=(.*?)>\s*([\s\S]*?)\s*<\/parameter>/g;
  let match = paramRegex.exec(content);
  while (match !== null) {
    let value: string | boolean = match[2].trim();
    if (value === "false") value = false;
    if (value === "true") value = true;
    args[match[1].trim()] = value;
    match = paramRegex.exec(content);
  }
  return { name, args };
}

/**
 * Extract a tool call written as raw XML in assistant content, e.g.
 * `<write_todos>{"todos":[]}</write_todos>` or the legacy
 * `<function=NAME><parameter=K>V</parameter></function>` form.
 *
 * Returns the FIRST match in document order, preferring the legacy
 * `<function=...>` syntax when present. Known tool names are matched
 * case-sensitively; unknown tags yield null.
 */
export function parseXmlToolCall(content: string, knownToolNames: Set<string>): ParsedXmlToolCall | null {
  const legacy = parseLegacyFunctionCall(content);
  if (legacy) return legacy;

  const candidates: Array<{ index: number; result: ParsedXmlToolCall }> = [];

  for (const name of knownToolNames) {
    const escaped = escapeRegExp(name);

    const full = new RegExp(`<${escaped}>([\\s\\S]*?)<\\/${escaped}>`).exec(content);
    if (full) {
      candidates.push({ index: full.index, result: { name, args: parseArgs(full[1]) } });
      continue;
    }

    const selfClosing = new RegExp(`<${escaped}\\s*\\/>`).exec(content);
    if (selfClosing) {
      candidates.push({ index: selfClosing.index, result: { name, args: {} } });
      continue;
    }

    const bare = new RegExp(`<${escaped}>`).exec(content);
    if (bare) {
      candidates.push({ index: bare.index, result: { name, args: {} } });
    }
  }

  candidates.sort((a, b) => a.index - b.index);
  return candidates[0]?.result ?? null;
}
