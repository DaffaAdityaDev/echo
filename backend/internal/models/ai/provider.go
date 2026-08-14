package aitype

type ProviderType string

const (
	ProviderOpenAI    ProviderType = "openai"
	ProviderAnthropic ProviderType = "anthropic"
	ProviderLMStudio  ProviderType = "lm-studio"
	ProviderOpenCode  ProviderType = "opencode-go"
)

var ValidProviders = []ProviderType{ProviderOpenAI, ProviderAnthropic, ProviderLMStudio, ProviderOpenCode}

func IsValidProvider(s string) bool {
	for _, p := range ValidProviders {
		if string(p) == s {
			return true
		}
	}
	return false
}

type ProviderConfig struct {
	Type    ProviderType `json:"type" example:"openai"`
	BaseURL string       `json:"base_url" example:"https://api.openai.com/v1"`
	APIKey  string       `json:"api_key,omitempty" example:"sk-xxxxxxxxxxxxxxxx"`
	Model   string       `json:"model" example:"gpt-4o"`
	// MaxContextTokens is the model's maximum context length in tokens; 0
	// means unknown. Carried through provider maps so consolidation can size
	// its skip threshold and payload budget to the actual model.
	MaxContextTokens int `json:"max_context_tokens,omitempty" example:"128000"`
}
