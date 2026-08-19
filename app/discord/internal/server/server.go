package server

import (
	"context"
	"fmt"
	"log"
	"magi/internal/handler"
	"magi/internal/models"
	"magi/internal/router"

	"github.com/bwmarrin/discordgo"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/logger"
	"github.com/gofiber/fiber/v3/middleware/recover"
)

type Server struct {
	FiberApp       *fiber.App
	DiscordSession *discordgo.Session
	Cfg            *models.Config
	DiscordHandler *handler.DiscordHandler
	cancelWorkers  context.CancelFunc
}

func NewServer(cfg *models.Config) (*Server, error) {
	// 1. Initialize Fiber Application
	fbApp := fiber.New(fiber.Config{
		AppName: "Magi Discord Bot Server",
	})

	// Add middlewares matching backend pattern
	fbApp.Use(recover.New())
	fbApp.Use(logger.New())

	// 2. Initialize Discord session
	dg, err := discordgo.New("Bot " + cfg.DiscordToken)
	if err != nil {
		return nil, fmt.Errorf("failed to create Discord session: %w", err)
	}

	// 3. Register Discord Event Handlers (Queue Size: 10,000)
	discordHandler := handler.NewDiscordHandler(cfg, 10000)
	dg.AddHandler(discordHandler.OnMessageCreate)
	dg.AddHandler(discordHandler.OnInteractionCreate) // Handle slash command and component clicks

	// Configure Intents
	dg.Identify.Intents = discordgo.IntentsGuildMessages | discordgo.IntentsDirectMessages

	// 4. Setup routes (sharing discordHandler state)
	router.SetupRoutes(fbApp, discordHandler)

	return &Server{
		FiberApp:       fbApp,
		DiscordSession: dg,
		Cfg:            cfg,
		DiscordHandler: discordHandler,
	}, nil
}

// Start opens both the Fiber HTTP server and the Discord websocket gateway.
func (s *Server) Start() error {
	// Start websocket connection
	if err := s.DiscordSession.Open(); err != nil {
		return fmt.Errorf("failed to open Discord session: %w", err)
	}
	log.Println("Discord bot session opened successfully")

	// Register /model Slash Command
	_, err := s.DiscordSession.ApplicationCommandCreate(s.DiscordSession.State.User.ID, s.Cfg.GuildID, &discordgo.ApplicationCommand{
		Name:        "model",
		Description: "Pilih model AI yang diaktifkan di channel ini",
	})
	if err != nil {
		log.Printf("Warning: failed to register /model slash command: %v", err)
	} else {
		log.Println("Registered /model slash command successfully")
	}

	// Register /mode Slash Command
	_, err = s.DiscordSession.ApplicationCommandCreate(s.DiscordSession.State.User.ID, s.Cfg.GuildID, &discordgo.ApplicationCommand{
		Name:        "mode",
		Description: "Pilih mode eksekusi Agent untuk channel ini",
	})
	if err != nil {
		log.Printf("Warning: failed to register /mode slash command: %v", err)
	} else {
		log.Println("Registered /mode slash command successfully")
	}

	// Start worker pool (Workers Count: 50)
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelWorkers = cancel
	s.DiscordHandler.Start(ctx, 50)
	log.Println("Discord bot worker pool started with 50 workers")

	// Start HTTP server in a goroutine
	go func() {
		log.Printf("Fiber server starting on port %s", s.Cfg.ServerPort)
		if err := s.FiberApp.Listen(s.Cfg.ServerPort); err != nil {
			log.Printf("Fiber HTTP server stopped: %v", err)
		}
	}()

	return nil
}

// Stop gracefully shuts down both services.
func (s *Server) Stop() {
	log.Println("Stopping server services...")

	if s.cancelWorkers != nil {
		s.cancelWorkers()
		log.Println("Discord bot worker pool stopped")
	}

	if err := s.DiscordSession.Close(); err != nil {
		log.Printf("Error closing Discord session: %v", err)
	}

	if err := s.FiberApp.Shutdown(); err != nil {
		log.Printf("Error shutting down Fiber server: %v", err)
	}
}
