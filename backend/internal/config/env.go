package config

import (
	"bufio"
	"os"
	"strings"
)

// LoadDotEnv reads a KEY=VALUE dotenv file and sets any variable that is not
// already present in the environment. Lines that are blank or start with '#'
// are skipped, and values are trimmed of surrounding quotes so that all
// binaries share identical parsing behavior.
func LoadDotEnv(path string) error {
	f, err := os.Open(path)
	if err != nil {
		return err
	}
	defer func() { _ = f.Close() }()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) != 2 {
			continue
		}
		key := strings.TrimSpace(parts[0])
		val := strings.Trim(strings.TrimSpace(parts[1]), `"'`)
		if _, ok := os.LookupEnv(key); !ok {
			_ = os.Setenv(key, val)
		}
	}
	return scanner.Err()
}
