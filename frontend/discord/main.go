package main

import (
	"fmt"
	"log"
	"os"
	"os/signal"
	"syscall"

	"magi/internal/config"
	"magi/internal/server"
)

func main() {
	// 1. Load configuration (reads from environment and .env)
	cfg := config.Load()

	if cfg.DiscordToken == "" {
		log.Fatal("Error: DISCORD_TOKEN is not configured. Check your environment or .env file.")
	}

	// 2. Initialize the Server containing Fiber and DiscordBot
	srv, err := server.NewServer(cfg)
	if err != nil {
		log.Fatalf("Failed to initialize server: %v", err)
	}

	// 3. Start services
	if err := srv.Start(); err != nil {
		log.Fatalf("Failed to start server: %v", err)
	}
	defer srv.Stop()

	fmt.Println("Bot Discord dan Fiber HTTP server sedang berjalan. Tekan CTRL-C untuk keluar.")

	// 4. Wait for OS termination signals
	sc := make(chan os.Signal, 1)
	signal.Notify(sc, syscall.SIGINT, syscall.SIGTERM, os.Interrupt)
	<-sc

	log.Println("Mematikan server secara bersih...")
}
