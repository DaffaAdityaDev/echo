package observability

import (
	"context"
	"fmt"

	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/exporters/otlp/otlptrace/otlptracegrpc"
	"go.opentelemetry.io/otel/sdk/resource"
	sdktrace "go.opentelemetry.io/otel/sdk/trace"
	semconv "go.opentelemetry.io/otel/semconv/v1.4.0"
	"go.opentelemetry.io/otel/trace"
)

var Tracer trace.Tracer

func init() {
	Tracer = otel.Tracer("agent-harness-tracer")
}

// InitTracer configures a connection to the self-hosted OTel Collector
func InitTracer(ctx context.Context, collectorAddr string) (*sdktrace.TracerProvider, error) {
	exporter, err := otlptracegrpc.New(ctx,
		otlptracegrpc.WithInsecure(),
		otlptracegrpc.WithEndpoint(collectorAddr),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create OTLP trace exporter: %w", err)
	}

	res, err := resource.New(ctx,
		resource.WithAttributes(
			semconv.ServiceNameKey.String("golang-agent-coordinator"),
			attribute.String("environment", "production-onprem"),
		),
	)
	if err != nil {
		return nil, fmt.Errorf("failed to create resource: %w", err)
	}

	tp := sdktrace.NewTracerProvider(
		sdktrace.WithSampler(sdktrace.AlwaysSample()),
		sdktrace.WithBatcher(exporter),
		sdktrace.WithResource(res),
	)
	otel.SetTracerProvider(tp)
	Tracer = otel.Tracer("agent-harness-tracer")

	return tp, nil
}

// TrackAgentTurn monitors cognitive loops inside Go routine execution
func TrackAgentTurn(ctx context.Context, sessionID string, turnIndex int, model string) (context.Context, trace.Span) {
	ctx, span := Tracer.Start(ctx, fmt.Sprintf("AgentTurn_#%d", turnIndex),
		trace.WithAttributes(
			attribute.String("agent.session_id", sessionID),
			attribute.Int("agent.turn", turnIndex),
			attribute.String("llm.model", model),
		),
	)
	return ctx, span
}
