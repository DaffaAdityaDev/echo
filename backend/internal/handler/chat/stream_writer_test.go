package chat

import (
	"encoding/json"
	"testing"

	domainconst "echo-backend/internal/constants/domain"
)

func packetFromJSON(t *testing.T, raw string) AgentSSEPacket {
	t.Helper()
	var p AgentSSEPacket
	if err := json.Unmarshal([]byte(raw), &p); err != nil {
		t.Fatalf("unmarshal packet: %v", err)
	}
	return p
}

func TestStreamContentApplyPacketContent(t *testing.T) {
	sc := &streamContent{}
	sc.applyPacket(packetFromJSON(t, `{"type":"content","content":"Hel"}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"reasoning","content":"think"}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"content","content":"lo"}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"tool_call","toolName":"web_search","toolInput":{"q":"x"}}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"tool_result","toolName":"web_search","content":"results"}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"usage","usage":{"promptTokens":10,"completionTokens":7,"totalTokens":17}}`))

	if got := sc.content.String(); got != "Hello" {
		t.Errorf("content = %q, want %q", got, "Hello")
	}
	if got := sc.thinking.String(); got != "think" {
		t.Errorf("thinking = %q, want %q", got, "think")
	}
	if len(sc.toolCalls) != 1 || sc.toolCalls[0].ToolName != "web_search" {
		t.Errorf("toolCalls = %+v, want one web_search call", sc.toolCalls)
	}
	if len(sc.toolResults) != 1 || sc.toolResults[0].Content != "results" {
		t.Errorf("toolResults = %+v, want one web_search result", sc.toolResults)
	}
	if sc.completionTokens != 7 {
		t.Errorf("completionTokens = %d, want 7", sc.completionTokens)
	}
}

func TestStreamContentErrorPacketNotPollutingContent(t *testing.T) {
	sc := &streamContent{}
	sc.applyPacket(packetFromJSON(t, `{"type":"content","content":"partial answer"}`))
	sc.applyPacket(packetFromJSON(t, `{"type":"error","content":"Monthly usage limit reached","code":"USAGE_LIMIT","detail":"raw body"}`))

	if got := sc.content.String(); got != "partial answer" {
		t.Errorf("content = %q, want partial content only (error must not be appended)", got)
	}
	if sc.streamErr == nil {
		t.Fatal("streamErr not recorded")
	}
	if sc.streamErr.Code != "USAGE_LIMIT" || sc.streamErr.Content != "Monthly usage limit reached" {
		t.Errorf("streamErr = %+v, want code USAGE_LIMIT with provider message", sc.streamErr)
	}
}

func TestStreamContentFinalStatus(t *testing.T) {
	t.Run("error packet wins over completion", func(t *testing.T) {
		sc := &streamContent{}
		sc.applyPacket(packetFromJSON(t, `{"type":"turn_complete"}`))
		sc.applyPacket(packetFromJSON(t, `{"type":"error","content":"rate limited","code":"RATE_LIMIT"}`))
		if got := sc.finalStatus(); got != domainconst.StatusError {
			t.Errorf("finalStatus = %q, want %q", got, domainconst.StatusError)
		}
	})

	t.Run("turn_complete finalizes as complete", func(t *testing.T) {
		sc := &streamContent{}
		sc.applyPacket(packetFromJSON(t, `{"type":"content","content":"done"}`))
		sc.applyPacket(packetFromJSON(t, `{"type":"turn_complete"}`))
		if got := sc.finalStatus(); got != domainconst.StatusComplete {
			t.Errorf("finalStatus = %q, want %q", got, domainconst.StatusComplete)
		}
	})

	t.Run("no terminal packet finalizes as interrupted", func(t *testing.T) {
		sc := &streamContent{}
		sc.applyPacket(packetFromJSON(t, `{"type":"content","content":"partial"}`))
		if got := sc.finalStatus(); got != domainconst.StatusInterrupted {
			t.Errorf("finalStatus = %q, want %q", got, domainconst.StatusInterrupted)
		}
	})

	t.Run("empty error packet is ignored", func(t *testing.T) {
		sc := &streamContent{}
		sc.applyPacket(packetFromJSON(t, `{"type":"error"}`))
		if got := sc.finalStatus(); got != domainconst.StatusInterrupted {
			t.Errorf("finalStatus = %q, want %q", got, domainconst.StatusInterrupted)
		}
	})
}
