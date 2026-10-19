// Package domain centralizes magic values shared across layers: environment
// names, account roles, message roles, statuses, service subjects, and
// signing algorithms.
package domain

const (
	Production      = "production"
	Development     = "development"
	SigningAlgHS256 = "HS256"
)

// Account tiers. The users.tier column CHECK constraint and every tier
// normalization across the codebase must agree with this allowlist.
const (
	TierFree = "free"
	TierPro  = "pro"
)

// NormalizeTier maps any non-pro value (including empty and unknown tiers) to
// TierFree so callers can never accidentally grant pro access.
func NormalizeTier(tier string) string {
	if tier == TierPro {
		return TierPro
	}
	return TierFree
}

const (
	// AgentSubject is the required JWT "sub" claim for the internal
	// service-to-service token signed with ServiceJWTSecret.
	AgentSubject = "agent"
)

const (
	RoleUser           = "user"
	RoleAdmin          = "admin"
	RoleSuperAdmin     = "super-admin"
	RolePromptEngineer = "prompt_engineer"
	RoleProductManager = "product_manager"
	RoleAdminBisnis    = "admin_bisnis"
)

const (
	MessageRoleUser      = "user"
	MessageRoleAssistant = "assistant"
	MessageRoleSystem    = "system"
	MessageRoleTool      = "tool"
)

const (
	StatusActive      = "active"
	StatusComplete    = "complete"
	StatusStreaming   = "streaming"
	StatusError       = "error"
	StatusDeleted     = "deleted"
	StatusArchived    = "archived"
	StatusInterrupted = "interrupted"
	StatusRevoked     = "revoked"
)

// DefaultTenantID is the only tenant the backend serves. Users carry no tenant
// claim, so every authenticated request is scoped to it server-side; tenant
// values supplied by clients are never trusted.
const DefaultTenantID = "local"
