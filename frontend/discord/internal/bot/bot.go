package bot

import (
	"fmt"

	"github.com/bwmarrin/discordgo"
)

// Bot manages the session lifecycle and setup of the Discord client.
type Bot struct {
	Session    *discordgo.Session
	BackendURL string
}

// New initializes a Bot instance and registers event listeners.
func New(token string, backendURL string) (*Bot, error) {
	dg, err := discordgo.New("Bot " + token)
	if err != nil {
		return nil, fmt.Errorf("failed to create Discord session: %w", err)
	}

	b := &Bot{
		Session:    dg,
		BackendURL: backendURL,
	}

	b.registerHandlers()
	b.configureIntents()

	return b, nil
}

// Start opens the gateway socket to Discord.
func (b *Bot) Start() error {
	if err := b.Session.Open(); err != nil {
		return fmt.Errorf("failed to open session connection: %w", err)
	}
	return nil
}

// Stop gracefully shuts down the session.
func (b *Bot) Stop() error {
	if err := b.Session.Close(); err != nil {
		return fmt.Errorf("failed to close session connection: %w", err)
	}
	return nil
}

func (b *Bot) configureIntents() {
	b.Session.Identify.Intents = discordgo.IntentsGuildMessages | discordgo.IntentsDirectMessages
}

func (b *Bot) registerHandlers() {
	b.Session.AddHandler(b.messageCreate)
}
