package config

import (
	cfgConst "echo-backend/internal/constants/config"
	envconst "echo-backend/internal/constants/env"
	"echo-backend/internal/models/config"
	"fmt"
	"strings"
)

// ValidateSecrets fails startup when any secret used to sign or accept tokens
// is empty or still set to a known development default. The defaults above
// exist for local convenience only; running with them in production is a
// critical security risk.
func ValidateSecrets(c *cfgmodel.Config) error {
	checks := []struct {
		envVar string
		value  string
		known  string
	}{
		{envconst.JWTSecret, c.JWTSecret, cfgConst.DefaultJWTSecret},
		{envconst.InternalAuthToken, c.InternalAuthToken, cfgConst.DefaultInternalAuthToken},
		{envconst.ServiceJWTSecret, c.ServiceJWTSecret, cfgConst.DefaultServiceJWTSecret},
	}
	for _, chk := range checks {
		value := strings.TrimSpace(chk.value)
		if value == "" {
			return fmt.Errorf("security: %s must not be empty", chk.envVar)
		}
		if value == chk.known {
			return fmt.Errorf("security: %s is still set to the known development default %q — set a strong secret before starting the server", chk.envVar, chk.known)
		}
	}
	return nil
}
