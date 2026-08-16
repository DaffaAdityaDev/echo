package chat

import (
	"context"
	"strings"

	httpxconst "echo-backend/internal/constants/httpx"

	"github.com/gofiber/fiber/v3"
	"go.opentelemetry.io/otel/trace"
)

// withRemoteTraceContext attaches the incoming W3C traceparent header to the
// request context so the agent's downstream spans inherit the caller's trace.
func withRemoteTraceContext(ctx context.Context, c fiber.Ctx) context.Context {
	tpHeader := c.Get(httpxconst.HeaderTraceparent)
	if sc, ok := parseTraceparent(tpHeader); ok {
		return trace.ContextWithRemoteSpanContext(ctx, sc)
	}
	return ctx
}

func parseTraceparent(tp string) (trace.SpanContext, bool) {
	if !strings.HasPrefix(tp, "00-") {
		return trace.SpanContext{}, false
	}
	parts := strings.Split(tp, "-")
	if len(parts) < 3 {
		return trace.SpanContext{}, false
	}
	traceID, err := trace.TraceIDFromHex(parts[1])
	if err != nil {
		return trace.SpanContext{}, false
	}
	spanID, err := trace.SpanIDFromHex(parts[2])
	if err != nil {
		return trace.SpanContext{}, false
	}
	return trace.NewSpanContext(trace.SpanContextConfig{
		TraceID:    traceID,
		SpanID:     spanID,
		TraceFlags: trace.FlagsSampled,
		Remote:     true,
	}), true
}
