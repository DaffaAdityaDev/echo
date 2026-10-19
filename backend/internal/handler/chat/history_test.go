package chat

import (
	"reflect"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
	chatmodel "echo-backend/internal/models/chat"
)

func TestBuildAgentHistorySkipsEmptyAssistantAndStepRoles(t *testing.T) {
	dbMessages := []*chatmodel.Message{
		{Role: domainconst.MessageRoleUser, Content: "first question"},
		{Role: domainconst.MessageRoleAssistant, Content: ""},
		{Role: domainconst.MessageRoleUser, Content: "second question"},
		{Role: "tool_call", Content: "{}"},
		{Role: domainconst.MessageRoleAssistant, Content: "  \n"},
		{Role: domainconst.MessageRoleUser, Content: "third question"},
		{Role: domainconst.MessageRoleAssistant, Content: "partial answer"},
	}

	got := buildAgentHistory("", dbMessages)

	want := []HistoryMessage{
		{Role: domainconst.MessageRoleUser, Content: "first question"},
		{Role: domainconst.MessageRoleUser, Content: "second question"},
		{Role: domainconst.MessageRoleUser, Content: "third question"},
		{Role: domainconst.MessageRoleAssistant, Content: "partial answer"},
	}
	if !reflect.DeepEqual(got, want) {
		t.Errorf("history = %+v, want %+v", got, want)
	}
}

func TestBuildAgentHistoryPrependsContextSummary(t *testing.T) {
	got := buildAgentHistory("earlier work", []*chatmodel.Message{
		{Role: domainconst.MessageRoleUser, Content: "hi"},
	})
	if len(got) != 2 {
		t.Fatalf("len(history) = %d, want 2", len(got))
	}
	if got[0].Role != domainconst.MessageRoleSystem {
		t.Errorf("first role = %q, want system", got[0].Role)
	}
	if got[0].Content != "Context summary of consolidated previous turns:\nearlier work" {
		t.Errorf("summary content = %q", got[0].Content)
	}
}
