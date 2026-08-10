package aitype

// ModelInfo describes an AI model in the catalog.
type ModelInfo struct {
	// ID is the model ID used in requests.
	ID string `json:"id" example:"gpt-4o"`
	// Name is the display name.
	Name string `json:"name,omitempty" example:"GPT-4o"`
	// ProviderType is the LLM provider.
	ProviderType ProviderType `json:"provider_type" example:"openai"`
	// ProviderName is the provider display name.
	ProviderName string `json:"provider_name" example:"OpenAI"`
	// SupportsMultimodal reports whether the model accepts image inputs.
	SupportsMultimodal bool `json:"supports_multimodal" example:"true"`
}
