// Package domain centralizes magic values shared across layers: environment
// names, account roles, message roles, statuses, and signing algorithms.
package domain

const (
	Production      = "production"
	Development     = "development"
	SigningAlgHS256 = "HS256"
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
	StatusDeleted     = "deleted"
	StatusArchived    = "archived"
	StatusInterrupted = "interrupted"
	StatusRevoked     = "revoked"
)
