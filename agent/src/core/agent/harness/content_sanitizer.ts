const OPENING_TAG = (names: string[]) => new RegExp(`<(?:${names.join("|")})\\b[^>]*>`, "gi");
const CLOSING_TAG = (name: string) => new RegExp(`</${name}\\s*>`, "gi");

const PROTOCOL_PATTERNS: RegExp[] = [
  /<dsml>[\s\S]*?<\/dsml>/gi,
  /<\/?dsml\b[^>]*>/gi,
  /<tool_calls>[\s\S]*?<\/tool_calls>/gi,
  /<\/?tool_calls\b[^>]*>/gi,
  /<invoke\b[^>]*>[\s\S]*?<\/invoke>/gi,
  /<invoke\b[^>]*\/>/gi,
  /<parameter\b[^>]*>[\s\S]*?<\/parameter>/gi,
  /<parameter\b[^>]*\/>/gi,
  /<user_objective>[\s\S]*?<\/user_objective>/gi,
  /<\/?user_objective\b[^>]*>/gi,
  /<\/(?:dsml|tool_calls|invoke|parameter)\s*>/gi,
];

const DEFAULT_KNOWN_TOOLS = ["write_todos", "delegate_task", "web_search"];

// Upper bound for how long a trailing partial tag is held across chunks. A
// held tail that never closes in this many characters is not a split tag (e.g.
// a code comparison "a < b"): release it as plain text instead of waiting on a
// ">" that may never arrive.
const MAX_HOLD_LENGTH = 128;

/**
 * Strips LLM tool-call protocol markup (fake tool traces, DSML invoke blocks,
 * echoed <user_objective> delimiters) from streamed content BEFORE it reaches
 * the client, so raw protocol syntax never appears in visible output or stored
 * messages. Holds back any incomplete trailing tag so blocks split across
 * stream chunks are still removed.
 */
export class ContentSanitizer {
  private buffer = "";
  private readonly names: string[];

  constructor(knownToolNames: string[] = []) {
    this.names = [...new Set([...knownToolNames, ...DEFAULT_KNOWN_TOOLS])];
  }

  sanitize(chunk: string): string {
    this.buffer += chunk;
    return this.process();
  }

  flush(): string {
    const out = this.strip(this.buffer);
    this.buffer = "";
    return out;
  }

  private process(): string {
    const text = this.buffer;
    const opening = OPENING_TAG(this.names);
    let holdFrom = -1;

    let m: RegExpExecArray | null = opening.exec(text);
    while (m) {
      if (m[0].endsWith("/>")) {
        m = opening.exec(text);
        continue; // self-closing — complete
      }
      const nameMatch = m[0].match(/<(\w+)/);
      if (!nameMatch) {
        m = opening.exec(text);
        continue;
      }
      const closer = CLOSING_TAG(nameMatch[1]);
      closer.lastIndex = m.index + m[0].length;
      if (!closer.exec(text)) {
        holdFrom = holdFrom === -1 ? m.index : Math.min(holdFrom, m.index);
      }
      m = opening.exec(text);
    }

    // Hold back a trailing partial tag (e.g. a bare "<" or "<write_todos"
    // split mid-tag by a chunk boundary) so it is not emitted half-open.
    // Once anything is held, never emit past the earliest unresolved "<".
    const lastOpen = text.lastIndexOf("<");
    if (lastOpen >= 0) {
      const tail = text.slice(lastOpen);
      if (tail === "<" || (/^<\/?[a-z_]/.test(tail) && !tail.includes(">"))) {
        holdFrom = holdFrom === -1 ? lastOpen : Math.min(holdFrom, lastOpen);
      }
    }

    if (holdFrom === -1) {
      this.buffer = "";
      return this.strip(text);
    }

    // Bound the hold window. A tail held for more than MAX_HOLD_LENGTH
    // characters without a closing ">" is not a split tag — flush it as text.
    if (holdFrom === 0 && this.buffer.length > MAX_HOLD_LENGTH) {
      this.buffer = "";
      return this.strip(text);
    }

    const ready = text.slice(0, holdFrom);
    this.buffer = text.slice(holdFrom);
    return this.strip(ready);
  }

  private strip(text: string): string {
    let out = text;
    for (const re of PROTOCOL_PATTERNS) {
      out = out.replace(re, "");
    }
    for (const name of this.names) {
      out = out.replace(new RegExp(`<${name}>[\\s\\S]*?<\\/${name}>`, "gi"), "");
      out = out.replace(new RegExp(`</?${name}\\b[^>]*>`, "gi"), "");
    }
    // Remove a dangling partial tag that never closed (e.g. "<write_todos").
    // Restricted to known tag names so legitimate text like "a < b" is kept.
    const names = this.names.join("|");
    return out.replace(new RegExp(`</?(?:${names})\\b[^>]*$`, "i"), "");
  }
}
