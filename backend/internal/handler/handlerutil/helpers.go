package handlerutil

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"net/http"
	"strconv"

	httpxconst "echo-backend/internal/constants/httpx"
	"echo-backend/internal/constants/locals"
	msgconst "echo-backend/internal/constants/msg"

	"github.com/gofiber/fiber/v3"
)

// HttpClient is the shared outbound client for internal agent calls. It has
// no global Timeout: chat.go and hitl.go stream the agent's response body for
// the whole turn (minutes), and http.Client.Timeout would abort the stream
// mid-body. Non-streaming callers bound their requests with per-call context
// timeouts instead.
var HttpClient = &http.Client{}

func GetUserID(c fiber.Ctx) (int, error) {
	userIDStr, ok := c.Locals(locals.UserID).(string)
	if !ok || userIDStr == "" {
		return 0, errors.New("user_id not found")
	}
	return strconv.Atoi(userIDStr)
}

func GenerateUUID() (string, error) {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		return "", fmt.Errorf("generate uuid: %w", err)
	}
	return hex.EncodeToString(b), nil
}

func RespondSuccess(c fiber.Ctx, data any) error {
	return c.JSON(data)
}

func RespondCreated(c fiber.Ctx, data any) error {
	return c.Status(fiber.StatusCreated).JSON(data)
}

func RespondMessage(c fiber.Ctx, msg string) error {
	return c.JSON(fiber.Map{
		httpxconst.JSONKeyStatus:  httpxconst.JSONKeySuccess,
		httpxconst.JSONKeyMessage: msg,
	})
}

// RespondError writes the error response body and returns a non-nil error so
// handlers that `return handlerutil.RespondError(...)` actually stop. The
// returned fiber.Error carries the status so the app error handler can render
// it (without clobbering the already-written body) when a caller ignores it.
func RespondError(c fiber.Ctx, status int, msg string) error {
	return RespondErrorDetail(c, status, msg, httpxconst.EmptyDetails)
}

func RespondErrorDetail(c fiber.Ctx, status int, msg string, details string) error {
	_ = c.Status(status).JSON(fiber.Map{
		httpxconst.JSONKeyError:   msg,
		httpxconst.JSONKeyDetails: details,
	})
	return fiber.NewError(status, msg)
}

// ErrorHandler renders handler errors as JSON without clobbering a response
// body that a handler already wrote (RespondErrorDetail writes and returns a
// non-nil error). Plain errors become a generic 500, matching fiber defaults.
func ErrorHandler(c fiber.Ctx, err error) error {
	var fe *fiber.Error
	if errors.As(err, &fe) {
		if len(c.Response().Body()) > 0 {
			return nil
		}
		return c.Status(fe.Code).JSON(fiber.Map{httpxconst.JSONKeyError: fe.Message, httpxconst.JSONKeyDetails: httpxconst.EmptyDetails})
	}
	return c.Status(fiber.StatusInternalServerError).JSON(fiber.Map{
		httpxconst.JSONKeyError:   msgconst.MsgInternalServerError,
		httpxconst.JSONKeyDetails: httpxconst.EmptyDetails,
	})
}
