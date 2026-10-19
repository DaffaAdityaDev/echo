// Package historycap provides shared message capping for payloads forwarded
// to the agent (chat history and consolidation summarization). It prevents
// multi-MB payloads (e.g. 1M-context stress sessions) from exceeding the
// provider context window.
package historycap

import (
	"slices"
	"unicode/utf8"

	chatmodel "echo-backend/internal/models/chat"
)

// Cap truncates any message content beyond maxMsgChars bytes and keeps only
// the contiguous run of messages that fit within maxTokens. Input must be
// chronological (oldest first, as returned by the repository); output
// preserves that order.
// keepNewest keeps the newest messages (dropping older ones) — used for chat
// history; keepOldest keeps the oldest messages (dropping newer ones) — used
// for consolidation, which summarizes the old turns.
func Cap(messages []*chatmodel.Message, maxTokens int, maxMsgChars int, keepNewest bool) []*chatmodel.Message {
	if maxTokens <= 0 {
		maxTokens = 50000
	}
	if maxMsgChars <= 0 {
		maxMsgChars = 100000
	}

	start, end, step := len(messages)-1, -1, -1
	if !keepNewest {
		start, end, step = 0, len(messages), 1
	}

	var capped []*chatmodel.Message
	totalTokens := 0

	for i := start; i != end; i += step {
		m := messages[i]
		charge := m.TokenCount
		if len(m.Content) > maxMsgChars {
			m.Content = truncateUTF8(m.Content, maxMsgChars) + "\n...[truncated]"
			// Charge an estimate for the truncated content so one oversized
			// message does not silently evict every other message (the stored
			// TokenCount reflects the pre-truncation size).
			charge = len(m.Content) / 4
		}
		if totalTokens > 0 && totalTokens+charge > maxTokens {
			break
		}
		totalTokens += charge
		capped = append(capped, m)
	}

	if keepNewest {
		slices.Reverse(capped)
	}
	return capped
}

// truncateUTF8 cuts s to at most maxBytes without splitting a multi-byte rune.
func truncateUTF8(s string, maxBytes int) string {
	end := maxBytes
	for end > 0 && !utf8.RuneStart(s[end]) {
		end--
	}
	return s[:end]
}
