package config

import (
	"strings"
	"testing"

	cfgConst "echo-backend/internal/constants/config"
	domainconst "echo-backend/internal/constants/domain"
	cfgmodel "echo-backend/internal/models/config"
)

func strongConfig(environment string) *cfgmodel.Config {
	return &cfgmodel.Config{
		Environment:       environment,
		JWTSecret:         strings.Repeat("j", cfgConst.MinSecretLength),
		InternalAuthToken: strings.Repeat("i", cfgConst.MinSecretLength),
		ServiceJWTSecret:  strings.Repeat("s", cfgConst.MinSecretLength),
		EncryptionKey:     strings.Repeat("e", cfgConst.EncryptionKeyLength),
	}
}

func TestValidateSecrets(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name    string
		mutate  func(c *cfgmodel.Config)
		env     string
		wantErr bool
	}{
		{name: "strong secrets pass in production", mutate: func(*cfgmodel.Config) {}, env: domainconst.Production},
		{name: "hardcoded default fails in development", mutate: func(c *cfgmodel.Config) { c.JWTSecret = cfgConst.DefaultJWTSecret }, env: "development", wantErr: true},
		{name: "empty secret fails in development", mutate: func(c *cfgmodel.Config) { c.ServiceJWTSecret = " " }, env: "development", wantErr: true},
		{name: "placeholder fails in production", mutate: func(c *cfgmodel.Config) { c.ServiceJWTSecret = cfgConst.PlaceholderServiceJWTSecret }, env: domainconst.Production, wantErr: true},
		{name: "placeholder only warns in development", mutate: func(c *cfgmodel.Config) { c.ServiceJWTSecret = cfgConst.PlaceholderServiceJWTSecret }, env: "development"},
		{name: "short secret fails in production", mutate: func(c *cfgmodel.Config) { c.InternalAuthToken = "short-token" }, env: domainconst.Production, wantErr: true},
		{name: "short secret only warns in development", mutate: func(c *cfgmodel.Config) { c.InternalAuthToken = "short-token" }, env: "development"},
		{name: "empty encryption key fails in production", mutate: func(c *cfgmodel.Config) { c.EncryptionKey = "" }, env: domainconst.Production, wantErr: true},
		{name: "wrong-length encryption key fails in production", mutate: func(c *cfgmodel.Config) { c.EncryptionKey = "too-short" }, env: domainconst.Production, wantErr: true},
		{name: "placeholder encryption key fails in production", mutate: func(c *cfgmodel.Config) { c.EncryptionKey = cfgConst.PlaceholderEncryptionKey }, env: domainconst.Production, wantErr: true},
		{name: "empty encryption key only warns in development", mutate: func(c *cfgmodel.Config) { c.EncryptionKey = "" }, env: "development"},
	}

	for _, tt := range tests {
		tt := tt
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			cfg := strongConfig(tt.env)
			tt.mutate(cfg)
			err := ValidateSecrets(cfg)
			if tt.wantErr && err == nil {
				t.Fatal("expected an error")
			}
			if !tt.wantErr && err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}
}
