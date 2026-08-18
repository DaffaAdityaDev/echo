package chat

import (
	"context"
	"errors"
	"fmt"
	"log/slog"

	"echo-backend/internal/constants/db"
	msgconst "echo-backend/internal/constants/msg"
	"echo-backend/internal/handler/handlerutil"
	chatmodel "echo-backend/internal/models/chat"
	featuresvc "echo-backend/internal/service/features"

	"github.com/gofiber/fiber/v3"
)

// resolveTurnPreferences resolves the user's settings (model, mode, features,
// skills, harness toggles) and validates the requested features against the
// user's tier. Errors have already been responded to.
func (h *Handler) resolveTurnPreferences(ctx context.Context, c fiber.Ctx, userID int, userTier string, req *ChatRequest) (string, string, []string, []string, map[string]interface{}, error) {
	prefs, err := h.SettingsSvc.GetSettings(ctx, userID)
	if err != nil {
		slog.Warn(msgconst.WarnChatLoadSettingsFallback, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyUserID, userID, msgconst.KeyErr, err)
		prefs = h.SettingsSvc.GetDefaults()
	}
	if prefs == nil {
		slog.Warn(msgconst.WarnChatSettingsNilFallback, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeyUserID, userID)
		prefs = h.SettingsSvc.GetDefaults()
	}

	modelID := prefs.DefaultModel
	if modelID == "" {
		modelID = h.Cfg.DefaultModel
	}
	mode := prefs.DefaultMode
	if mode == "" {
		mode = "standard"
	}
	if req.Model != "" {
		modelID = req.Model
	}
	if req.Mode != "" {
		mode = req.Mode
	}
	features := prefs.DefaultFeatures
	skills := prefs.DefaultSkills
	var config map[string]interface{}
	if prefs.HarnessToggles != nil {
		config = map[string]interface{}{"featureToggles": prefs.HarnessToggles}
	}

	if err := h.FeaturesSvc.ValidateRequest(ctx, features, userTier); err != nil {
		var unknownErr featuresvc.ErrUnknownFeature
		if errors.As(err, &unknownErr) {
			return "", "", nil, nil, nil, handlerutil.RespondError(c, fiber.StatusBadRequest, unknownErr.Error())
		}
		var lockedErr featuresvc.ErrFeatureLocked
		if errors.As(err, &lockedErr) {
			return "", "", nil, nil, nil, handlerutil.RespondError(c, fiber.StatusForbidden, lockedErr.Error())
		}
		return "", "", nil, nil, nil, handlerutil.RespondError(c, fiber.StatusInternalServerError, "Feature validation failed")
	}
	return modelID, mode, features, skills, config, nil
}

// validateRequestedSkills rejects requested skills that are not in the agent
// catalog. The catalog fetch itself is best-effort: when it fails the request
// proceeds unvalidated.
func (h *Handler) validateRequestedSkills(ctx context.Context, c fiber.Ctx, skills []string) error {
	if len(skills) > 0 {
		skillsCatalog, err := h.GetSkills(ctx)
		if err == nil {
			skillMap := make(map[string]bool)
			for _, s := range skillsCatalog {
				if name, ok := s["name"].(string); ok {
					skillMap[name] = true
				}
			}
			for _, skillName := range skills {
				if !skillMap[skillName] {
					return handlerutil.RespondError(c, fiber.StatusBadRequest, fmt.Sprintf("Unknown skill '%s'", skillName))
				}
			}
		}
	}
	return nil
}

// resolveOrCreateSession loads the requested session (checking ownership) or
// creates a new one with a resolved strategy version. Errors have already
// been responded to.
func (h *Handler) resolveOrCreateSession(ctx context.Context, c fiber.Ctx, userID int, sessionID string) (*chatmodel.Session, string, error) {
	if sessionID != "" {
		sess, err := h.SessionRepo.GetByID(ctx, sessionID)
		if err != nil {
			return nil, "", handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session", err.Error())
		}
		if sess == nil || sess.Status == "deleted" {
			return nil, "", handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
		}
		if sess.UserID != userID {
			return nil, "", handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
		}
		return sess, sess.StrategyVersion, nil
	}

	resolvedVersion, err := h.StrategySvc.ResolveVersion(ctx, "", "", userID)
	if err != nil {
		return nil, "", handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
	}

	createdSess, err := h.SessionRepo.CreateSession(ctx, userID, db.DefaultSessionTitle, resolvedVersion)
	if err != nil {
		return nil, "", handlerutil.RespondError(c, fiber.StatusInternalServerError, "Failed to create session")
	}
	return createdSess, createdSess.StrategyVersion, nil
}

// prepareTurnState runs consolidation when the token threshold is crossed,
// pins the strategy version, and refreshes the session timestamp. Must run
// under the session lock: two rapid turns could otherwise both cross the
// threshold and compact the same session twice. Returns the (possibly
// reloaded) session and the resolved strategy version.
func (h *Handler) prepareTurnState(ctx context.Context, c fiber.Ctx, userID int, req *ChatRequest, currentSession *chatmodel.Session, currentPinnedVersion string, providerMap map[string]interface{}) (*chatmodel.Session, string, error) {
	if req.SessionID != "" {
		isThresholdCrossed, err := h.ConsolidationSvc.CheckThreshold(ctx, req.SessionID, providerMap)
		if err == nil && isThresholdCrossed {
			slog.Info(msgconst.InfoConsolidationThreshold, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, req.SessionID)
			err = h.ConsolidationSvc.TriggerConsolidation(ctx, req.SessionID, providerMap)
			if err != nil {
				slog.Error(msgconst.ErrConsolidationAuto, msgconst.ComponentKey, msgconst.ComponentConsolidation, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
			} else {
				currentSession, err = h.SessionRepo.GetByID(ctx, req.SessionID)
				if err != nil {
					slog.Error(msgconst.ErrChatReloadAfterConsolid, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
				}
			}
		}
	}

	resolvedStrategyVersion := currentPinnedVersion
	if resolvedStrategyVersion == "" {
		var err error
		resolvedStrategyVersion, err = h.StrategySvc.ResolveVersion(ctx, "", "", userID)
		if err != nil {
			return nil, "", handlerutil.RespondError(c, fiber.StatusBadRequest, "Invalid or deprecated strategy version requested")
		}
	}
	if currentPinnedVersion == "" {
		if err := h.SessionRepo.PinStrategyVersion(ctx, req.SessionID, resolvedStrategyVersion); err != nil {
			slog.Error(msgconst.ErrChatPinStrategyVersion, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
		}
	}
	if err := h.SessionRepo.TouchSession(ctx, req.SessionID); err != nil {
		slog.Error(msgconst.ErrChatTouchSession, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, req.SessionID, msgconst.KeyErr, err)
	}
	return currentSession, resolvedStrategyVersion, nil
}

// prepareChatTurn loads the capped session history, assembles it with the
// context summary, computes the next turn number, and inserts the user
// message plus the streaming placeholder. Errors have already been responded
// to.
func (h *Handler) prepareChatTurn(ctx context.Context, c fiber.Ctx, sessionID string, currentSession *chatmodel.Session, userMessage string, userTokenCount int) ([]HistoryMessage, int, int64, error) {
	dbMessages, err := h.buildCappedHistory(ctx, sessionID)
	if err != nil {
		return nil, 0, 0, handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to load session history", err.Error())
	}

	var history []HistoryMessage
	if currentSession != nil && currentSession.ContextSummary != "" {
		history = append(history, HistoryMessage{
			Role:    "system",
			Content: fmt.Sprintf("Context summary of consolidated previous turns:\n%s", currentSession.ContextSummary),
		})
	}

	for _, dbMsg := range dbMessages {
		if dbMsg.Role == "thought" || dbMsg.Role == "tool_call" || dbMsg.Role == "tool_result" {
			continue
		}
		history = append(history, HistoryMessage{
			Role:    dbMsg.Role,
			Content: dbMsg.Content,
		})
	}

	maxTurn, err := h.SessionRepo.GetMaxTurnNumber(ctx, sessionID)
	if err != nil {
		return nil, 0, 0, handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to compute next turn", err.Error())
	}
	nextTurn := maxTurn + 1

	assistantMsgID, err := h.SessionRepo.PrepareTurn(ctx, sessionID, userMessage, userTokenCount, nextTurn)
	if err != nil {
		slog.Error(msgconst.ErrChatPrepareTurn, msgconst.ComponentKey, msgconst.ComponentChat, msgconst.KeySessionID, sessionID, msgconst.KeyErr, err)
		return nil, 0, 0, handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to prepare chat turn", err.Error())
	}

	return history, nextTurn, assistantMsgID, nil
}
