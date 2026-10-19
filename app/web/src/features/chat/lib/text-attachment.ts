export const MAX_ATTACHMENT_BYTES = 256 * 1024;

const TEXT_MIME_TYPES = new Set([
  "application/json",
  "application/xml",
  "application/yaml",
  "application/x-yaml",
  "application/javascript",
  "application/typescript",
  "application/x-sh",
  "application/sql",
]);

const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "markdown",
  "csv",
  "tsv",
  "json",
  "jsonl",
  "yaml",
  "yml",
  "toml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "go",
  "rs",
  "java",
  "kt",
  "rb",
  "php",
  "c",
  "h",
  "cpp",
  "hpp",
  "cs",
  "sh",
  "sql",
  "log",
  "ini",
  "env",
]);

export interface TextAttachment {
  name: string;
  content: string;
}

export type AttachmentCheck = { ok: true } | { ok: false; reason: string };

interface FileLike {
  name: string;
  type: string;
  size: number;
}

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");

  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

function isTextFile(file: FileLike): boolean {
  if (file.type.startsWith("text/") || TEXT_MIME_TYPES.has(file.type)) return true;

  return TEXT_EXTENSIONS.has(extensionOf(file.name));
}

export function checkTextAttachment(file: FileLike): AttachmentCheck {
  if (!isTextFile(file)) {
    return { ok: false, reason: `"${file.name}" is not a supported text file.` };
  }

  if (file.size > MAX_ATTACHMENT_BYTES) {
    return { ok: false, reason: `"${file.name}" exceeds the ${MAX_ATTACHMENT_BYTES / 1024} KB attachment limit.` };
  }

  return { ok: true };
}

export function composeMessage(input: string, attachment: TextAttachment | null): string {
  if (!attachment) return input;

  const block = `[Attached File: ${attachment.name}]\n${attachment.content}`;

  return input.trim() ? `${input}\n\n${block}` : block;
}
