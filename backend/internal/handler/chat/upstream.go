package chat

import (
	"io"
	"net/http"
	"net/url"
)

const upstreamErrorBodyLimit = 64 << 10

// agentMissionURL builds the agent's mission endpoint with the mode passed as
// an escaped query parameter, so a user-supplied mode cannot inject extra
// query parameters.
func agentMissionURL(agentBaseURL, mode string) string {
	query := url.Values{}
	query.Set("mode", mode)
	return agentBaseURL + "/api/v1/generate-mission?" + query.Encode()
}

// upstreamFailureStatus maps a non-OK agent status to the status returned to
// the client. Client-input rejections (400, 404, 409, ...) pass through; auth
// failures and server errors are gateway failures, because an agent 401/403
// concerns the internal token and must not log the user out.
func upstreamFailureStatus(agentStatus int) int {
	isClientError := agentStatus >= http.StatusBadRequest && agentStatus < http.StatusInternalServerError
	isAuthError := agentStatus == http.StatusUnauthorized || agentStatus == http.StatusForbidden || agentStatus == http.StatusProxyAuthRequired
	if isClientError && !isAuthError {
		return agentStatus
	}
	return http.StatusBadGateway
}

// readUpstreamError reads at most upstreamErrorBodyLimit bytes of a failed
// agent response for the client error detail and closes the body.
func readUpstreamError(resp *http.Response) (string, error) {
	defer func() { _ = resp.Body.Close() }()
	body, err := io.ReadAll(io.LimitReader(resp.Body, upstreamErrorBodyLimit))
	return string(body), err
}
