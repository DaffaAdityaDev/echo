import type { PlaygroundResult } from "../types"

export function finalizeModel(
  completed: Map<string, PlaygroundResult>,
  model: string,
  fields: Partial<PlaygroundResult>,
  state: {
    streamingContent: Record<string, string>
    streamingReasoning: Record<string, string>
  },
  setState: {
    setStreamingContent: (c: Record<string, string>) => void
    setStreamingReasoning: (r: Record<string, string>) => void
    setResults: (r: PlaygroundResult[] | null) => void
  },
): void {
  const sc = { ...state.streamingContent }
  delete sc[model]
  setState.setStreamingContent(sc)
  const sr = { ...state.streamingReasoning }
  delete sr[model]
  setState.setStreamingReasoning(sr)
  completed.set(model, { model, content: "", latency_ms: 0, tokens: 0, ...fields })
  setState.setResults(Array.from(completed.values()))
}
