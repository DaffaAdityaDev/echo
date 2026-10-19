package consolidation

import (
	"testing"

	chatmodel "echo-backend/internal/models/chat"

	"github.com/stretchr/testify/assert"
)

func turnMsg(turn, tokens int) *chatmodel.Message {
	return &chatmodel.Message{TurnNumber: turn, TokenCount: tokens, Content: "c"}
}

func TestSummarizableWindow_AllFitPrunesThroughLastLoadedTurn(t *testing.T) {
	t.Parallel()

	loaded := []*chatmodel.Message{turnMsg(1, 10), turnMsg(1, 10), turnMsg(2, 10), turnMsg(25, 10)}
	got, pruneThrough := summarizableWindow(loaded, 20, 1000)
	assert.Len(t, got, 3)
	assert.Equal(t, 20, pruneThrough, "every loaded message up to the prune limit was summarized")
}

func TestSummarizableWindow_BudgetCutStopsBeforeUnsummarizedTurn(t *testing.T) {
	t.Parallel()

	loaded := []*chatmodel.Message{turnMsg(1, 40), turnMsg(1, 40), turnMsg(2, 40), turnMsg(3, 40)}
	got, pruneThrough := summarizableWindow(loaded, 20, 100)
	assert.Len(t, got, 2)
	assert.Equal(t, 1, pruneThrough, "messages beyond the payload budget must not be pruned")
}

func TestSummarizableWindow_DropsPartiallyIncludedTurn(t *testing.T) {
	t.Parallel()

	loaded := []*chatmodel.Message{turnMsg(1, 40), turnMsg(2, 40), turnMsg(2, 40), turnMsg(3, 40)}
	got, pruneThrough := summarizableWindow(loaded, 20, 100)
	assert.Len(t, got, 1, "a turn split by the budget must stay out of the summary")
	assert.Equal(t, 1, pruneThrough)
}

func TestSummarizableWindow_LoadLimitLeavesLastTurnUnpruned(t *testing.T) {
	t.Parallel()

	loaded := make([]*chatmodel.Message, 0, summarizeLoadLimit)
	for i := range summarizeLoadLimit {
		loaded = append(loaded, turnMsg(i/2+1, 1))
	}
	lastTurn := loaded[len(loaded)-1].TurnNumber

	got, pruneThrough := summarizableWindow(loaded, lastTurn+50, 1_000_000)
	assert.Equal(t, lastTurn-1, pruneThrough, "the last loaded turn may continue past the load limit")
	assert.Len(t, got, summarizeLoadLimit-2)
}

func TestSummarizableWindow_SingleOversizedTurnSummarizesNothing(t *testing.T) {
	t.Parallel()

	loaded := []*chatmodel.Message{turnMsg(1, 500), turnMsg(1, 500), turnMsg(2, 10)}
	got, pruneThrough := summarizableWindow(loaded, 20, 100)
	assert.Empty(t, got)
	assert.Zero(t, pruneThrough)
}

func TestSummarizableWindow_NothingOldEnough(t *testing.T) {
	t.Parallel()

	got, pruneThrough := summarizableWindow([]*chatmodel.Message{turnMsg(25, 10)}, 20, 1000)
	assert.Empty(t, got)
	assert.Zero(t, pruneThrough)
}
