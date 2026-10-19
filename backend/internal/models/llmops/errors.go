package llmopsmodel

import "errors"

var (
	ErrTemplateNameRequired = errors.New("template name cannot be empty")
	ErrTemplateNameTaken    = errors.New("template name already exists")
	ErrTemplateNotFound     = errors.New("prompt template not found")
	ErrVersionNotFound      = errors.New("prompt version not found")
	ErrVersionRolledBack    = errors.New("prompt version is rolled back")
)
