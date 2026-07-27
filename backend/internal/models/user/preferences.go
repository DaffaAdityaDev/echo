package usermodel

type UserPreferences struct {
	UserID         int      `json:"user_id" example:"1"`
	DefaultMode    string   `json:"default_mode" example:"agent"`
	DefaultModel   string   `json:"default_model" example:"gpt-4o"`
	DefaultFeatures []string `json:"default_features" example:"web-browsing,code-interpreter"`
	DefaultSkills  []string `json:"default_skills" example:"python,research"`
	ProviderType   string   `json:"provider_type" example:"opencode-go"`
	APIKey         string   `json:"api_key,omitempty" example:""`
	HasAPIKey      bool     `json:"has_api_key"`
	BaseURL        string   `json:"base_url" example:"https://opencode.ai/zen/go/v1"`
}
