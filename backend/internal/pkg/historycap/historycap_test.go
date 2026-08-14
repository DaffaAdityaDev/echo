package historycap

import (
	"strings"
	"testing"

	chatmodel "echo-backend/internal/models/chat"
)

func msg(content string, tokens int, turn int) *chatmodel.Message {
	return &chatmodel.Message{Content: content, TokenCount: tokens, TurnNumber: turn}
}

func TestCap_KeepNewest_AllFits(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg("a", 10, 1), msg("b", 20, 2), msg("c", 30, 3)}
	out := Cap(in, 50000, 100000, true)
	if len(out) != 3 {
		t.Fatalf("expected 3 messages, got %d", len(out))
	}
	if out[0].Content != "a" || out[2].Content != "c" {
		t.Fatalf("chronological order not preserved: %+v", out)
	}
}

func TestCap_KeepNewest_DropsOldestBeyondTokenCap(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg("oldest", 40, 1), msg("mid", 30, 2), msg("newest", 20, 3)}
	out := Cap(in, 50, 100000, true)
	if len(out) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(out))
	}
	if out[0].Content != "mid" || out[1].Content != "newest" {
		t.Fatalf("expected newest two, got %+v", out)
	}
}

func TestCap_KeepOldest_DropsNewestBeyondTokenCap(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg("oldest", 20, 1), msg("mid", 30, 2), msg("newest", 40, 3)}
	out := Cap(in, 50, 100000, false)
	if len(out) != 2 {
		t.Fatalf("expected 2 messages, got %d", len(out))
	}
	if out[0].Content != "oldest" || out[1].Content != "mid" {
		t.Fatalf("expected oldest two, got %+v", out)
	}
}

func TestCap_KeepsFirstHugeMessageTruncated(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg(strings.Repeat("x", 5000), 1_100_000, 1)}
	out := Cap(in, 50000, 1000, true)
	if len(out) != 1 {
		t.Fatalf("expected 1 message kept, got %d", len(out))
	}
	if len(out[0].Content) != 1000+len("\n...[truncated]") {
		t.Fatalf("expected content truncated to 1000 chars + marker, got %d", len(out[0].Content))
	}
}

func TestCap_Empty(t *testing.T) {
	t.Parallel()

	if out := Cap(nil, 50000, 100000, true); len(out) != 0 {
		t.Fatalf("expected empty, got %d", len(out))
	}
}

func TestCap_TruncatedMessageChargesTruncatedEstimate(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg("older", 100, 1), msg(strings.Repeat("x", 5000), 1_100_000, 2)}
	out := Cap(in, 5000, 1000, true)
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

func TestCap_ZeroConfigUsesDefaults(t *testing.T) {
	t.Parallel()

	in := []*chatmodel.Message{msg("small", 5, 1)}
	if out := Cap(in, 0, 0, true); len(out) != 1 {
		t.Fatalf("expected 1 message, got %d", len(out))
	}
}

func TestCap_KeepOldest_GiantMessagesStayWithinBudget(t *testing.T) {
	t.Parallel()

	giant := msg(strings.Repeat("x", 1_000_000), 1_000_000, 1)
	in := []*chatmodel.Message{giant, msg(strings.Repeat("y", 1_000_000), 1_000_000, 2), msg(strings.Repeat("z", 1_000_000), 1_000_000, 3)}
	out := Cap(in, 50000, 100000, false)

	total := 0
	for _, m := range out {
		total += len(m.Content) / 4
		if len(m.Content) > 100000+len("\n...[truncated]") {
			t.Fatalf("content not truncated: %d chars", len(m.Content))
		}
	}
	if total > 50000 {
		t.Fatalf("payload estimate %d exceeds budget 50000", total)
	}
	if len(out) == 0 {
		t.Fatal("expected at least one message kept")
	}
	if out[0].TurnNumber != 1 {
		t.Fatalf("expected oldest message kept first, got turn %d", out[0].TurnNumber)
	}
}
