package aitype

type ModelInfo struct {
	ID                 string       `json:"id" example:"gpt-4o"`
	Name               string       `json:"name,omitempty" example:"GPT-4o"`
	ProviderType       ProviderType `json:"provider_type" example:"openai"`
	ProviderName       string       `json:"provider_name" example:"OpenAI"`
	SupportsMultimodal bool         `json:"supports_multimodal" example:"true"`
}
