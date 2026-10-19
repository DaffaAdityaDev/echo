package consolidation

import (
	"errors"

	chatmodel "echo-backend/internal/models/chat"
	"echo-backend/internal/pkg/historycap"
)

// summarizeLoadLimit caps the messages loaded for one consolidation pass so a
// huge session never pulls its entire history into memory.
const summarizeLoadLimit = 200

var ErrSessionNotFound = errors.New("session not found")

// summarizableWindow selects the oldest messages that fit the payload budget
// and returns them with the last turn they fully cover. Pruning must stop at
// that turn: deleting anything past it would drop messages the summary never
// saw. A turn only partially inside the window is excluded from the summary
// and kept in the session for the next pass.
func summarizableWindow(loaded []*chatmodel.Message, pruneLimitTurn, payloadBudget int) ([]*chatmodel.Message, int) {
	candidates := messagesUpToTurn(loaded, pruneLimitTurn)
	if len(candidates) == 0 {
		return nil, 0
	}

	capped := historycap.Cap(candidates, payloadBudget, payloadBudget*2, false)
	pruneThroughTurn := min(pruneLimitTurn, firstUncoveredTurn(loaded, len(capped))-1)

	summarized := messagesUpToTurn(capped, pruneThroughTurn)
	if len(summarized) == 0 {
		return nil, 0
	}
	return summarized, pruneThroughTurn
}

// firstUncoveredTurn returns the turn of the first message outside the
// covered prefix of loaded. When every loaded message is covered but the load
// hit its limit, the last loaded turn may continue beyond the window, so it
// counts as uncovered.
func firstUncoveredTurn(loaded []*chatmodel.Message, covered int) int {
	if covered < len(loaded) {
		return loaded[covered].TurnNumber
	}
	last := loaded[len(loaded)-1].TurnNumber
	if len(loaded) >= summarizeLoadLimit {
		return last
	}
	return last + 1
}

// messagesUpToTurn returns the leading messages whose turn is at most
// maxTurn. Input is ordered by turn ascending, so the result is a prefix.
func messagesUpToTurn(messages []*chatmodel.Message, maxTurn int) []*chatmodel.Message {
	end := 0
	for end < len(messages) && messages[end].TurnNumber <= maxTurn {
		end++
	}
	return messages[:end]
}
