package chat

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
	"github.com/redis/go-redis/v9"
)

// StreamMissionLogs godoc
// @Summary Stream mission logs
// @Description Streams real-time mission execution logs as Server-Sent Events
// @Tags Chat
// @Produce text/event-stream
// @Security BearerAuth
// @Param missionId path string true "Mission ID"
// @Success 200 {string} string "Event stream"
// @Failure 400 {object} map[string]string
// @Router /api/v1/missions/{missionId}/stream [get]
func (h *Handler) StreamMissionLogs(c fiber.Ctx) error {
	missionID := c.Params("missionId")
	if missionID == "" {
		return handlerutil.RespondError(c, fiber.StatusBadRequest, "missionId is required")
	}

	userID, err := handlerutil.GetUserID(c)
	if err != nil {
		return handlerutil.RespondError(c, fiber.StatusUnauthorized, "Unauthorized")
	}

	// The gateway treats missionId as the session id — enforce ownership so a
	// user cannot stream another user's conversation (transcript includes tool
	// traces and reasoning).
	session, err := h.SessionRepo.GetByID(c.Context(), missionID)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to resolve session", err.Error())
	}
	if session == nil || session.Status == "deleted" {
		return handlerutil.RespondError(c, fiber.StatusNotFound, "Session not found")
	}
	if session.UserID != userID {
		return handlerutil.RespondError(c, fiber.StatusForbidden, "Forbidden: ownership mismatch")
	}

	runtimeMode := os.Getenv("AGENT_RUNTIME_MODE")
	if runtimeMode == "" {
		runtimeMode = "local"
	}

	after := c.Query("after")
	if after == "" {
		if leid := c.Get("Last-Event-ID"); leid != "" {
			after = leid
		}
	}

	c.Set("Content-Type", "text/event-stream")
	c.Set("Cache-Control", "no-cache, no-transform")
	c.Set("Connection", "keep-alive")
	c.Set("Transfer-Encoding", "chunked")
	c.Set("X-Accel-Buffering", "no")

	if runtimeMode == "saas" {
		if h.RedisClient == nil {
			return handlerutil.RespondError(c, fiber.StatusInternalServerError, "Redis state store is offline")
		}

		return c.SendStreamWriter(func(w *bufio.Writer) {
			ctx, cancel := context.WithCancel(context.Background())
			defer cancel()

			key := fmt.Sprintf("mission:events:%s", missionID)
			finalizeRecovered := func() {
				if _, err := h.persistRecoveredMission(ctx, missionID); err != nil {
					log.Printf("⚠️ Mission stream: failed to persist recovered mission %s: %v", missionID, err)
				}
			}
			writeEvent := func(data string) error {
				if _, err := fmt.Fprintf(w, "data: %s\n\n", data); err != nil {
					return err
				}
				return w.Flush()
			}

			start := "-"
			if after != "" {
				start = fmt.Sprintf("(%s", after)
			}

			history, err := h.RedisClient.XRange(ctx, key, start, "+").Result()
			if err != nil {
				log.Printf("⚠️ Mission stream: XRange failed for %s: %v", missionID, err)
				return
			}

			for _, entry := range history {
				payload := entry.Values["p"]
				if payload == nil {
					continue
				}
				if err := writeEvent(payload.(string)); err != nil {
					return
				}
				if terminalPacket(payload.(string)) {
					finalizeRecovered()
					return
				}
			}

			lastID := "$"
			if len(history) > 0 {
				lastID = history[len(history)-1].ID
			}

			// If the stream has already ended (last entry is terminal), close
			// immediately instead of blocking on XREAD forever: replaying a
			// completed mission must not leave the connection hanging.
			if tail, err := h.RedisClient.XRevRangeN(ctx, key, "+", "-", 1).Result(); err == nil && len(tail) > 0 {
				if payload, ok := tail[0].Values["p"].(string); ok && terminalPacket(payload) {
					finalizeRecovered()
					return
				}
			}

			// Signal the end of the replayed history so the client switches to
			// applying live content deltas.
			if err := writeEvent(replayDonePacket); err != nil {
				return
			}

			// A stream with no terminal marker is either a just-started mission
			// (first event not yet recorded), an expired one (24h TTL), or a
			// mission whose agent died mid-run. None of these will produce a
			// terminal packet, so close after an idle window instead of blocking
			// on XREAD forever:
			//   - Empty history: single-shot window for the expired/TTL case;
			//     the first live event proves the mission is running and cancels it.
			//   - Partial history: sliding window reset on every live event, so
			//     a dead mission closes instead of hanging forever.
			slidingIdle := len(history) > 0
			idleTimeout := missionStreamIdleTimeout
			if slidingIdle {
				idleTimeout = missionStreamPartialIdleTimeout
			}
			var idleTimer *time.Timer
			var idleCh <-chan time.Time
			resetIdle := func() {
				if idleTimer != nil {
					if !idleTimer.Stop() {
						select {
						case <-idleTimer.C:
						default:
						}
					}
				}
				idleTimer = time.NewTimer(idleTimeout)
				idleCh = idleTimer.C
			}
			resetIdle()
			defer func() {
				if idleTimer != nil {
					idleTimer.Stop()
				}
			}()

			ticker := time.NewTicker(15 * time.Second)
			defer ticker.Stop()

			for {
				streams, err := h.RedisClient.XRead(ctx, &redis.XReadArgs{
					Count:   100,
					Block:   5 * time.Second,
					Streams: []string{key, lastID},
				}).Result()
				if err != nil && err != redis.Nil {
					return
				}
				if err == redis.Nil || len(streams) == 0 {
					select {
					case <-ticker.C:
						if _, err := fmt.Fprint(w, ": heartbeat\n\n"); err != nil {
							return
						}
						if err := w.Flush(); err != nil {
							return
						}
					case <-c.Context().Done():
						return
					case <-idleCh:
						return
					default:
						continue
					}
					continue
				}

				for _, stream := range streams {
					for _, msg := range stream.Messages {
						payload, ok := msg.Values["p"].(string)
						if !ok {
							continue
						}
						if slidingIdle {
							resetIdle()
						} else if idleTimer != nil {
							if !idleTimer.Stop() {
								select {
								case <-idleTimer.C:
								default:
								}
							}
							idleTimer = nil
							idleCh = nil
						}
						if err := writeEvent(payload); err != nil {
							return
						}
						lastID = msg.ID
						if terminalPacket(payload) {
							finalizeRecovered()
							return
						}
					}
				}
			}
		})
	} else {
		honoStreamURL := fmt.Sprintf("%s/api/v1/missions/%s/stream", h.HonoAPIURL, missionID)
		if after != "" {
			honoStreamURL = fmt.Sprintf("%s?after=%s", honoStreamURL, after)
		}

		return c.SendStreamWriter(func(w *bufio.Writer) {
			reqCtx, reqCancel := context.WithCancel(c.Context())
			defer reqCancel()

			req, err := http.NewRequestWithContext(reqCtx, "GET", honoStreamURL, nil)
			if err != nil {
				return
			}
			req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

			resp, err := handlerutil.HttpClient.Do(req)
			if err != nil {
				return
			}
			defer resp.Body.Close()

			reader := bufio.NewReader(resp.Body)

			for {
				line, err := reader.ReadBytes('\n')
				if err != nil {
					return
				}

				_, err = w.Write(line)
				if err != nil {
					return
				}

				if err := w.Flush(); err != nil {
					return
				}
			}
		})
	}
}
