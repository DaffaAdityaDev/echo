package agentmodel

import "encoding/json"

type ThoughtStep struct {
	Type      string          `json:"type"`
	Content   string          `json:"content,omitempty"`
	ToolName  string          `json:"toolName,omitempty"`
	ToolInput json.RawMessage `json:"toolInput,omitempty"`
}
