package chat

import (
	"encoding/json"
	"testing"

	"github.com/redis/go-redis/v9"

	agentmodel "echo-backend/internal/models/agent"
)

func xmsg(raw string) redis.XMessage {
	return redis.XMessage{ID: "1-0", Values: map[string]interface{}{"p": raw}}
}

func TestScanMissionStream_AccumulatesContentAndSteps(t *testing.T) {
	entries := []redis.XMessage{
		xmsg(`{"type":"content","content":"Hello "}`),
		xmsg(`{"type":"reasoning","content":"Let me search."}`),
		xmsg(`{"type":"tool_call","toolName":"web_search","toolInput":{"query":"x"}}`),
		xmsg(`{"type":"content","content":"world"}`),
		xmsg(`{"type":"tool_result","toolName":"web_search","content":"results"}`),
		xmsg(`{"type":"usage","usage":{"completionTokens":42}}`),
		xmsg(`{"type":"mission_completed","missionId":"m-1"}`),
	}

	acc, completed, terminalSeen := scanMissionStream(entries)
	if !terminalSeen {
		t.Fatal("expected terminalSeen=true")
	}
	if !completed {
		t.Fatal("expected completed=true for mission_completed terminal")
	}
	if acc.content.String() != "Hello world" {
		t.Fatalf("unexpected content %q", acc.content.String())
	}
	if acc.completionTokens != 42 {
		t.Fatalf("unexpected completion tokens %d", acc.completionTokens)
	}

	var steps []agentmodel.ThoughtStep
	if err := json.Unmarshal(acc.stepsJSON(), &steps); err != nil {
		t.Fatalf("failed to unmarshal steps: %v", err)
	}
	if len(steps) != 3 {
		t.Fatalf("expected 3 steps, got %d: %+v", len(steps), steps)
	}
	if steps[0].Type != "reasoning" || steps[0].Content != "Let me search." {
		t.Fatalf("unexpected first step: %+v", steps[0])
	}
	if steps[1].Type != "tool_call" || steps[1].ToolName != "web_search" {
		t.Fatalf("unexpected second step: %+v", steps[1])
	}
	if steps[2].Type != "tool_result" || steps[2].Content != "results" {
		t.Fatalf("unexpected third step: %+v", steps[2])
	}
}

func TestScanMissionStream_ErrorTerminalIsInterrupted(t *testing.T) {
	entries := []redis.XMessage{
		xmsg(`{"type":"content","content":"partial"}`),
		xmsg(`{"type":"error","content":"agent crashed"}`),
	}

	acc, completed, terminalSeen := scanMissionStream(entries)
	if !terminalSeen {
		t.Fatal("expected terminalSeen=true")
	}
	if completed {
		t.Fatal("expected completed=false for error terminal")
	}
	if acc.content.String() != "partialagent crashed" {
		t.Fatalf("unexpected content %q", acc.content.String())
	}
}

func TestScanMissionStream_NoTerminal(t *testing.T) {
	entries := []redis.XMessage{
		xmsg(`{"type":"content","content":"partial"}`),
	}

	_, completed, terminalSeen := scanMissionStream(entries)
	if terminalSeen {
		t.Fatal("expected terminalSeen=false")
	}
	if completed {
		t.Fatal("expected completed=false")
	}
}

func TestTerminalType(t *testing.T) {
	cases := []struct {
		raw  string
		want string
	}{
		{`{"type":"mission_completed"}`, "mission_completed"},
		{`{"type":"error"}`, "error"},
		{`{"type":"content"}`, ""},
		{"not json", ""},
	}
	for _, tc := range cases {
		if got := terminalType(tc.raw); got != tc.want {
			t.Errorf("terminalType(%q) = %q, want %q", tc.raw, got, tc.want)
		}
	}
}
