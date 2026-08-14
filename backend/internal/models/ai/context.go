package aitype

import "strings"

// ContextWindowFor resolves the maximum context length (in tokens) for a
// model. Model listings from providers do not expose context windows, so this
// curated resolver is the single source of truth for capping payloads and
// skip thresholds across the system. It returns 0 when the window is unknown
// (e.g. a custom LM Studio model), signalling callers to fall back to
// conservative defaults.
func ContextWindowFor(providerType ProviderType, modelID string) int {
	id := strings.ToLower(modelID)
	prefix := string(providerType) + "/"

	// The provider /models listing may return bare ids (opencode-go lists
	// ids without the prefix); match on the bare model name as well.
	id = strings.TrimPrefix(id, prefix)

	switch providerType {
	case ProviderOpenCode:
		switch {
		case strings.Contains(id, "deepseek"):
			return 1_048_576
		default:
			return 1_000_000
		}
	case ProviderAnthropic:
		switch {
		case strings.Contains(id, "claude-4"):
			return 1_000_000
		case strings.Contains(id, "claude-3-5") || strings.Contains(id, "claude-3.5"):
			return 200_000
		default:
			return 200_000
		}
	case ProviderOpenAI:
		switch {
		case strings.Contains(id, "gpt-5"):
			return 400_000
		case strings.Contains(id, "o1") || strings.Contains(id, "o3") || strings.Contains(id, "o4"):
			return 200_000
		case strings.Contains(id, "gpt-4o"):
			return 128_000
		default:
			return 128_000
		}
	case ProviderLMStudio:
		// Local models vary wildly; treat as unknown so callers use
		// conservative fallbacks.
		return 0
	default:
		return 0
	}
}
