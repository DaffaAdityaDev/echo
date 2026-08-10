package chat

import "testing"

func baseArgs() payloadArgs {
	return payloadArgs{
		userID:          "1",
		message:         "halo",
		model:           "opencode-go/deepseek-v4-flash",
		history:         []HistoryMessage{{Role: "user", Content: "sebelumnya"}},
		providerConfig:  map[string]interface{}{"type": "opencode-go"},
		strategyVersion: "nlah:v1",
		sessionID:       "sess-123",
		tenantID:        "local",
	}
}

func TestBuildPayload_AlwaysIncludesTenantID(t *testing.T) {
	p := buildChatAgentPayload(baseArgs())
	if p["tenant_id"] != "local" {
		t.Fatalf("expected tenant_id=local, got %v", p["tenant_id"])
	}
}

func TestBuildPayload_OmitsPromptTemplateWhenEmpty(t *testing.T) {
	p := buildChatAgentPayload(baseArgs())
	if _, ok := p["prompt_template"]; ok {
		t.Fatalf("prompt_template should be absent when empty, got %v", p["prompt_template"])
	}
}

func TestBuildPayload_IncludesPromptTemplateWhenSet(t *testing.T) {
	args := baseArgs()
	args.promptTemplateName = "behavior_test"
	p := buildChatAgentPayload(args)
	if p["prompt_template"] != "behavior_test" {
		t.Fatalf("expected prompt_template=behavior_test, got %v", p["prompt_template"])
	}
}

func TestBuildPayload_FeaturesDefaultEmptyWhenNil(t *testing.T) {
	args := baseArgs()
	args.features = nil
	p := buildChatAgentPayload(args)
	feats, ok := p["features"].([]string)
	if !ok || len(feats) != 0 {
		t.Fatalf("expected features=[] when nil, got %#v", p["features"])
	}
}

func TestBuildPayload_PreservesFeaturesAndCoreKeys(t *testing.T) {
	args := baseArgs()
	args.features = []string{"web_search", "write_todos"}
	p := buildChatAgentPayload(args)
	if len(p["features"].([]string)) != 2 {
		t.Fatalf("expected 2 features, got %#v", p["features"])
	}
	for _, key := range []string{"user_id", "message", "model", "history", "provider_config", "strategy_version"} {
		if _, ok := p[key]; !ok {
			t.Fatalf("expected key %q to be present", key)
		}
	}
}

func TestBuildPayload_AlwaysIncludesSessionID(t *testing.T) {
	p := buildChatAgentPayload(baseArgs())
	if p["session_id"] != "sess-123" {
		t.Fatalf("expected session_id=sess-123, got %v", p["session_id"])
	}
}

func TestBuildPayload_OptionalKeysOnlyWhenProvided(t *testing.T) {
	args := baseArgs()
	args.skills = []string{"research"}
	args.config = map[string]interface{}{"memory": map[string]interface{}{"episodic": true}}
	p := buildChatAgentPayload(args)
	if p["session_id"] != "sess-123" {
		t.Fatalf("expected session_id, got %v", p["session_id"])
	}
	if len(p["skills"].([]string)) != 1 {
		t.Fatalf("expected skills, got %#v", p["skills"])
	}
	if _, ok := p["config"]; !ok {
		t.Fatal("expected config key")
	}

	plain := buildChatAgentPayload(baseArgs())
	if _, ok := plain["skills"]; ok {
		t.Fatal("skills should be absent when empty")
	}
	if _, ok := plain["config"]; ok {
		t.Fatal("config should be absent when empty")
	}
}
