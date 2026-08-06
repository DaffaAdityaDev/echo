package chat

import (
	"testing"

	chatmodel "echo-backend/internal/models/chat"
)

func msg(content string, tokens int) *chatmodel.Message {
	return &chatmodel.Message{Content: content, TokenCount: tokens}
}

func TestCapHistory_AllFits(t *testing.T) {
	in := []*chatmodel.Message{msg("a", 10), msg("b", 20), msg("c", 30)}
	out := capHistory(in, 50000, 100000)
	if len(out) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(out))
	}
	if out[0].Content != "a" || out[2].Content != "c" {
		t.Fatalf("chronological order not preserved: %+v", out)
	}
}

func TestCapHistory_DropsOldestBeyondTokenCap(t *testing.T) {
	in := []*chatmodel.Message{msg("oldest", 40), msg("mid", 30), msg("newest", 20)}
	out := capHistory(in, 50, 100000)
	if len(out) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(out))
	}
	if out[0].Content != "mid" || out[1].Content != "newest" {
		t.Fatalf("expected newest two, got %+v", out)
	}
}

func TestCapHistory_KeepsFirstHugeMessageTruncated(t *testing.T) {
	big := make([]byte, 5000)
	for i := range big {
		big[i] = 'x'
	}
	in := []*chatmodel.Message{msg(string(big), 1_100_000)}
	out := capHistory(in, 50000, 1000)
	if len(out) != 1 {
		t.Fatalf("expected 1 message kept, got %d", len(out))
	}
	if len(out[0].Content) != 1000+len("\n...[truncated]") {
		t.Fatalf("expected content truncated to 1000 chars + marker, got %d", len(out[0].Content))
	}
}

func TestCapHistory_Empty(t *testing.T) {
	out := capHistory(nil, 50000, 100000)
	if len(out) != 0 {
		t.Fatalf("expected empty, got %d", len(out))
	}
}

func TestCapHistory_TruncatedMessageChargesTruncatedEstimate(t *testing.T) {
	big := make([]byte, 5000)
	for i := range big {
		big[i] = 'x'
	}
	in := []*chatmodel.Message{msg("older", 100), msg(string(big), 1_100_000)}
	out := capHistory(in, 5000, 1000)
	if len(out) != 2 {
		t.Fatalf("expected 2 messages kept, got %d (oversized message should not evict older ones)", len(out))
	}
	if out[0].Content != "older" {
		t.Fatalf("expected older message preserved, got %q", out[0].Content)
	}
	if len(out[1].Content) != 1000+len("\n...[truncated]") {
		t.Fatalf("expected oversized content truncated, got %d", len(out[1].Content))
	}
}

func TestCapHistory_ZeroConfigUsesDefaults(t *testing.T) {
	in := []*chatmodel.Message{msg("small", 5)}
	out := capHistory(in, 0, 0)
	if len(out) != 1 {
		t.Fatalf("expected 1 message, got %d", len(out))
	}
}
