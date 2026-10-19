package config

import (
	"fmt"
	"log/slog"
	"strings"

	cfgConst "echo-backend/internal/constants/config"
	domainconst "echo-backend/internal/constants/domain"
	envconst "echo-backend/internal/constants/env"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/models/config"
)

type secretCheck struct {
	envVar      string
	value       string
	devDefault  string
	placeholder string
}

// ValidateSecrets fails startup when any secret used to sign or accept tokens
// is empty or still set to a known development default. In production it also
// refuses the .env.example placeholders, secrets shorter than MinSecretLength
// and an ENCRYPTION_KEY that is not exactly EncryptionKeyLength bytes; other
// environments only log a warning for those so local setups keep working.
func ValidateSecrets(c *cfgmodel.Config) error {
	production := c.Environment == domainconst.Production
	checks := []secretCheck{
		{envconst.JWTSecret, c.JWTSecret, cfgConst.DefaultJWTSecret, cfgConst.PlaceholderJWTSecret},
		{envconst.InternalAuthToken, c.InternalAuthToken, cfgConst.DefaultInternalAuthToken, cfgConst.PlaceholderInternalAuthToken},
		{envconst.ServiceJWTSecret, c.ServiceJWTSecret, cfgConst.DefaultServiceJWTSecret, cfgConst.PlaceholderServiceJWTSecret},
	}
	for _, chk := range checks {
		if err := validateSecret(chk, production); err != nil {
			return err
		}
	}
	return enforceStrength(envconst.EncryptionKey, encryptionKeyWeakness(c.EncryptionKey), production)
}

func validateSecret(chk secretCheck, production bool) error {
	value := strings.TrimSpace(chk.value)
	if value == "" {
		return fmt.Errorf("security: %s must not be empty", chk.envVar)
	}
	if value == chk.devDefault {
		return fmt.Errorf("security: %s is still set to the known development default %q — set a strong secret before starting the server", chk.envVar, chk.devDefault)
	}
	return enforceStrength(chk.envVar, secretWeakness(value, chk.placeholder), production)
}

func secretWeakness(value, placeholder string) string {
	if value == placeholder {
		return "is still set to the .env.example placeholder"
	}
	if len(value) < cfgConst.MinSecretLength {
		return fmt.Sprintf("must be at least %d characters", cfgConst.MinSecretLength)
	}
	return ""
}

func encryptionKeyWeakness(key string) string {
	if key == cfgConst.PlaceholderEncryptionKey {
		return "is still set to the .env.example placeholder"
	}
	if len(key) != cfgConst.EncryptionKeyLength {
		return fmt.Sprintf("must be exactly %d bytes for AES-256", cfgConst.EncryptionKeyLength)
	}
	return ""
}

// enforceStrength turns a non-empty weakness into a startup error in
// production and into a warning elsewhere.
func enforceStrength(envVar, weakness string, production bool) error {
	if weakness == "" {
		return nil
	}
	if production {
		return fmt.Errorf("security: %s %s", envVar, weakness)
	}
	slog.Warn(msgconst.WarnWeakSecret, msgconst.ComponentKey, msgconst.ComponentConfig, msgconst.KeyKey, envVar, msgconst.KeyReason, weakness)
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
