// Package httpx centralizes custom HTTP header names and content types that
// the standard library does not already expose as constants.
package httpx

const (
	HeaderContentType    = "Content-Type"
	HeaderOrigin         = "Origin"
	HeaderAccept         = "Accept"
	HeaderXInternalToken = "X-Internal-Token"
	HeaderTraceparent    = "traceparent"
	HeaderAgentSessionID = "x-agent-session-id"
)

const (
	ContentTypeJSON            = "application/json"
	ContentTypeJSONCharsetUTF8 = "application/json; charset=utf-8"
	ContentTypeEventStream     = "text/event-stream"
	ContentTypeHTMLCharsetUTF8 = "text/html; charset=utf-8"
)
