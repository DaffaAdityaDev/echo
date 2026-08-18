package config

import (
	cfgConst "echo-backend/internal/constants/config"
	domainconst "echo-backend/internal/constants/domain"
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

// ValidateTier fails startup when DEFAULT_USER_TIER is set to a value the
// users.tier CHECK constraint would reject. The value lands directly in the
// column at registration, so a misconfigured value would make every signup
// fail with 500 at runtime instead of failing fast at boot.
func ValidateTier(c *cfgmodel.Config) error {
	if c.DefaultUserTier != domainconst.NormalizeTier(c.DefaultUserTier) {
		return fmt.Errorf("config: %s=%q must be one of %q or %q", envconst.DefaultUserTier, c.DefaultUserTier, domainconst.TierFree, domainconst.TierPro)
	}
	return nil
}
