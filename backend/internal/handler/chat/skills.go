package chat

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"

	"echo-backend/internal/handler/handlerutil"

	"github.com/gofiber/fiber/v3"
)

func (h *Handler) GetSkills(ctx context.Context) ([]map[string]interface{}, error) {
	cacheKey := "agent:skills"

	if h.RedisClient != nil {
		cached, err := h.RedisClient.Get(ctx, cacheKey).Result()
		if err == nil && cached != "" {
			var skills []map[string]interface{}
			if err := json.Unmarshal([]byte(cached), &skills); err == nil {
				return skills, nil
			}
		}
	}

	agentURL := fmt.Sprintf("%s/api/skills", h.HonoAPIURL)
	reqCtx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(reqCtx, "GET", agentURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("X-Internal-Token", h.Cfg.InternalAuthToken)

	resp, err := handlerutil.HttpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		bodyBytes, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("agent skills request failed: status %d, details: %s", resp.StatusCode, string(bodyBytes))
	}

	bodyBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	var skills []map[string]interface{}
	if err := json.Unmarshal(bodyBytes, &skills); err != nil {
		return nil, err
	}

	if h.RedisClient != nil {
		if err := h.RedisClient.Set(ctx, cacheKey, string(bodyBytes), 10*time.Minute).Err(); err != nil {
			log.Printf("Failed to cache skills in Redis: %v", err)
		}
	}

	return skills, nil
}

// SkillModifiers describes optional tuning parameters applied when a skill runs.
type SkillModifiers struct {
	// Temperature is the sampling temperature for the skill's model calls.
	Temperature float64 `json:"temperature"`
	// MaxTokens is the maximum number of tokens the skill may generate.
	MaxTokens int `json:"maxTokens"`
	// Compression indicates whether the skill compresses its context.
	Compression bool `json:"compression"`
}

// SkillResponse describes a single entry in the agent skill catalog.
type SkillResponse struct {
	// Name is the unique identifier of the skill.
	Name string `json:"name"`
	// Description is a human-readable summary of what the skill does.
	Description string `json:"description"`
	// PreferredTools lists tools the skill prefers to use, if any.
	PreferredTools []string `json:"preferredTools,omitempty"`
	// Modifiers are optional tuning parameters applied when the skill runs.
	Modifiers *SkillModifiers `json:"modifiers,omitempty"`
}

// HandleGetSkills godoc
// @Summary List available agent skills
// @Description Returns the catalog of skills available to agents
// @Tags Chat
// @Produce json
// @Success 200 {array} SkillResponse "Agent skill catalog"
// @Failure 500 {object} map[string]string
// @Router /api/v1/skills [get]
func (h *Handler) HandleGetSkills(c fiber.Ctx) error {
	ctx := c.Context()
	skills, err := h.GetSkills(ctx)
	if err != nil {
		return handlerutil.RespondErrorDetail(c, fiber.StatusInternalServerError, "Failed to retrieve skills", err.Error())
	}
	return handlerutil.RespondSuccess(c, skills)
}
