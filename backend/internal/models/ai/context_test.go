package aitype

import "testing"

func TestContextWindowFor(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name         string
		providerType ProviderType
		modelID      string
		want         int
	}{
		{name: "opencode-go deepseek family", providerType: ProviderOpenCode, modelID: "deepseek-v4-flash", want: 1_048_576},
		{name: "opencode-go prefixed id", providerType: ProviderOpenCode, modelID: "opencode-go/deepseek-v4", want: 1_048_576},
		{name: "opencode-go fallback", providerType: ProviderOpenCode, modelID: "unknown-model", want: 1_000_000},
		{name: "anthropic claude-4", providerType: ProviderAnthropic, modelID: "claude-4-sonnet", want: 1_000_000},
		{name: "anthropic claude-3-5", providerType: ProviderAnthropic, modelID: "claude-3-5-sonnet-20241022", want: 200_000},
		{name: "anthropic fallback", providerType: ProviderAnthropic, modelID: "claude-2", want: 200_000},
		{name: "openai gpt-5", providerType: ProviderOpenAI, modelID: "gpt-5", want: 400_000},
		{name: "openai o-series", providerType: ProviderOpenAI, modelID: "o4-mini", want: 200_000},
		{name: "openai gpt-4o", providerType: ProviderOpenAI, modelID: "gpt-4o", want: 128_000},
		{name: "openai fallback", providerType: ProviderOpenAI, modelID: "custom-vendor-model", want: 128_000},
		{name: "lm-studio unknown", providerType: ProviderLMStudio, modelID: "qwen-14b", want: 0},
		{name: "case insensitive", providerType: ProviderOpenAI, modelID: "GPT-4O", want: 128_000},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			if got := ContextWindowFor(tt.providerType, tt.modelID); got != tt.want {
				t.Fatalf("ContextWindowFor(%s, %s) = %d, want %d", tt.providerType, tt.modelID, got, tt.want)
			}
		})
	}
}
