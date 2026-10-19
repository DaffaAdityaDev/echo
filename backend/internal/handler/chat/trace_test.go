package chat

import (
	"context"
	"testing"

	"go.opentelemetry.io/otel/trace"
)

func TestAgentTraceparentOmittedWithoutTraceContext(t *testing.T) {
	if tp, ok := agentTraceparent(context.Background()); ok {
		t.Errorf("expected no traceparent, got %q", tp)
	}
}

func TestAgentTraceparentForwardsIncomingContext(t *testing.T) {
	const incoming = "00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01"
	sc, ok := parseTraceparent(incoming)
	if !ok {
		t.Fatalf("parseTraceparent(%q) failed", incoming)
	}
	ctx := trace.ContextWithRemoteSpanContext(context.Background(), sc)

	tp, ok := agentTraceparent(ctx)
	if !ok {
		t.Fatal("expected traceparent")
	}
	if tp != incoming {
		t.Errorf("traceparent = %q, want %q", tp, incoming)
	}
}
