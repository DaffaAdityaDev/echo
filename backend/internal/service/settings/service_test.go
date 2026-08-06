package settings

import "testing"

func TestResolvePromptTemplateName(t *testing.T) {
	t.Parallel()

	raw := []byte(`{"tenant-alpha": "support:v2", "default": "support:v1"}`)

	tests := []struct {
		name     string
		raw      []byte
		tenantID string
		fallback string
		want     string
	}{
		{name: "per-tenant mapping wins", raw: raw, tenantID: "tenant-alpha", fallback: "env-template", want: "support:v2"},
		{name: "default mapping wins for unknown tenant", raw: raw, tenantID: "tenant-beta", fallback: "env-template", want: "support:v1"},
		{name: "env fallback used when no mapping", raw: nil, tenantID: "tenant-beta", fallback: "env-template", want: "env-template"},
		{name: "empty raw and no fallback yields empty", raw: nil, tenantID: "tenant-beta", fallback: "", want: ""},
		{name: "empty object falls through to fallback", raw: []byte("{}"), tenantID: "tenant-beta", fallback: "env-template", want: "env-template"},
		{name: "invalid json treated as empty mapping", raw: []byte("not-json"), tenantID: "tenant-beta", fallback: "env-template", want: "env-template"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()
			got := ResolvePromptTemplateName(tt.raw, tt.tenantID, tt.fallback)
			if got != tt.want {
				t.Errorf("ResolvePromptTemplateName(%q, %q, %q) = %q, want %q", tt.raw, tt.tenantID, tt.fallback, got, tt.want)
			}
		})
	}
}
