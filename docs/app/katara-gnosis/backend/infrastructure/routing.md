# Katara Backend: Routing & Middleware Architecture

> Fiber v3 HTTP routing layout, route groups, and middleware stack running on port 8090.

---

## 1. Route Table & Grouping

All Katara routes are prefixed with `/api/v1` and registered via `internal/router/router.go`:

```go
func SetupRoutes(app *fiber.App, h *handler.Handler, authMiddleware fiber.Handler) {
    v1 := app.Group("/api/v1")

    // Standalone Authentication (Public)
    auth := v1.Group("/auth")
    auth.Post("/register", h.Register)
    auth.Post("/login", h.Login)
    auth.Post("/logout", h.Logout)
    auth.Get("/me", authMiddleware, h.GetMe)

    // Protected Katara Core Routes
    katara := v1.Group("/katara", authMiddleware)

    // Knowledge Lakes
    katara.Get("/lakes", h.ListLakes)
    katara.Post("/lakes", h.CreateLake)
    katara.Get("/lakes/:id", h.GetLake)
    katara.Patch("/lakes/:id", h.UpdateLake)
    katara.Delete("/lakes/:id", h.DeleteLake)

    // Sources & Material
    katara.Get("/sources", h.ListSources)
    katara.Post("/sources", h.UploadSource)
    katara.Get("/sources/:id", h.GetSource)
    katara.Patch("/sources/:id", h.UpdateSourceNotes)
    katara.Delete("/sources/:id", h.DeleteSource)
    katara.Get("/sources/:id/chunks", h.GetSourceChunks)
    katara.Post("/sources/:id/reprocess", h.ReprocessSource)

    // Flashcards & Search
    katara.Get("/flashcards", h.ListFlashcards)
    katara.Post("/flashcards", h.CreateFlashcard)
    katara.Patch("/flashcards/:id", h.UpdateFlashcard)
    katara.Delete("/flashcards/:id", h.DeleteFlashcard)
    katara.Post("/flashcards/search", h.SearchFlashcards)

    // Drills & Practice
    katara.Post("/drills", h.CreateDrillSession)
    katara.Get("/drills/:id", h.GetDrillSession)
    katara.Get("/drills/:id/next", h.GetNextDrillQuestion)
    katara.Post("/drills/:id/answer", h.SubmitDrillAnswer)
    katara.Get("/drills/:id/results", h.GetDrillResults)

    // Progress & Synthesis
    katara.Get("/today", h.GetTodaySummary)
    katara.Get("/progress", h.GetProgressSummary)
    katara.Get("/synthesis/weekly", h.GetWeeklySheet)
    katara.Post("/synthesis/weekly/regenerate", h.RegenerateWeeklySheet)

    // Settings & Jobs
    katara.Get("/settings", h.GetSettings)
    katara.Patch("/settings", h.UpdateSettings)
    katara.Get("/jobs/:id", h.GetJob)
}
```

---

## 2. Middleware Stack

1. **CORS Middleware**: Allows incoming requests from the frontend origin (`http://localhost:3002`).
2. **Recovery Middleware**: Recovers from unexpected panics and outputs structured JSON 500 error logs.
3. **Logger Middleware**: Records request method, path, status, latency, and client IP.
4. **Auth JWT Middleware**: Parses `Authorization: Bearer <jwt_token>`, verifies signature with `JWT_SECRET`, and extracts `user_id` into `c.Locals("user_id")`.
