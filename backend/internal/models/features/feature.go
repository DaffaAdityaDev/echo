package featuresmodel

import (
	"encoding/json"
	"time"
)

type Feature struct {
	ID              string          `json:"id"`
	Name            string          `json:"name"`
	Description     string          `json:"description"`
	TierRequirement string          `json:"tier_requirement"`
	UISchema        json.RawMessage `json:"ui_schema"`
	Status          string          `json:"status"`
	CreatedAt       time.Time       `json:"created_at"`
	UpdatedAt       time.Time       `json:"updated_at"`
}
