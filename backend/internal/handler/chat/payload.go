package chat

// buildChatAgentPayload assembles the mission payload forwarded to the agent.
// Extracted as a pure function so the contract (tenant propagation, prompt
// template resolution, features default) is unit-testable.
func buildChatAgentPayload(args payloadArgs) map[string]interface{} {
	payload := map[string]interface{}{
		"user_id":          args.userID,
		"message":          args.message,
		"model":            args.model,
		"history":          args.history,
		"provider_config":  args.providerConfig,
		"strategy_version": args.strategyVersion,
		"session_id":       args.sessionID,
	}

	if args.features == nil {
		payload["features"] = []string{}
	} else {
		payload["features"] = args.features
	}
	if len(args.skills) > 0 {
		payload["skills"] = args.skills
	}
	if len(args.config) > 0 {
		payload["config"] = args.config
	}
	if args.promptTemplateName != "" {
		payload["prompt_template"] = args.promptTemplateName
	}
	payload["tenant_id"] = args.tenantID

	return payload
}

type payloadArgs struct {
	userID             string
	message            string
	model              string
	history            []HistoryMessage
	providerConfig     map[string]interface{}
	strategyVersion    string
	sessionID          string
	features           []string
	skills             []string
	config             map[string]interface{}
	tenantID           string
	promptTemplateName string
}
