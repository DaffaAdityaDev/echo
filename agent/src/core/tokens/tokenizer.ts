import { get_encoding } from "@dqbd/tiktoken";

const ENCODING = "o200k_base" as const;

let encoding: ReturnType<typeof get_encoding> | null = null;

export function countTokens(text: string): number {
  if (!encoding) {
    encoding = get_encoding(ENCODING);
  }
  return encoding.encode(text).length;
}
