package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

type ModuleSpec struct {
	Swagger             string                            `json:"swagger"`
	Info                json.RawMessage                   `json:"info"`
	Host                string                            `json:"host"`
	BasePath            string                            `json:"basePath"`
	Paths               map[string]map[string]interface{} `json:"paths"`
	Definitions         map[string]json.RawMessage       `json:"definitions"`
	SecurityDefinitions json.RawMessage                   `json:"securityDefinitions"`
}

type MonolithSpec struct {
	Swagger             string                            `json:"swagger"`
	Info                json.RawMessage                   `json:"info"`
	Host                string                            `json:"host"`
	BasePath            string                            `json:"basePath"`
	Paths               map[string]map[string]interface{} `json:"paths"`
	Definitions         map[string]json.RawMessage       `json:"definitions"`
	SecurityDefinitions json.RawMessage                   `json:"securityDefinitions"`
}

func main() {
	moduleDir := filepath.Clean("./api/module")
	outputFile := filepath.Clean("./api/docs/swagger.json")

	files, err := os.ReadDir(moduleDir)
	if err != nil {
		fmt.Printf("Error reading module dir: %v\n", err)
		os.Exit(1)
	}

	monolith := MonolithSpec{
		Swagger:     "2.0",
		Paths:       make(map[string]map[string]interface{}),
		Definitions: make(map[string]json.RawMessage),
	}

	// 1. Read _shared.json definitions if present
	sharedPath := filepath.Join(moduleDir, "_shared.json")
	if data, err := os.ReadFile(sharedPath); err == nil {
		var shared struct {
			Definitions map[string]json.RawMessage `json:"definitions"`
		}
		if err := json.Unmarshal(data, &shared); err == nil {
			for k, v := range shared.Definitions {
				monolith.Definitions[k] = v
			}
		}
	}

	// 2. Read each module file
	pathCount := 0
	for _, file := range files {
		if file.IsDir() || file.Name() == "_shared.json" || filepath.Ext(file.Name()) != ".json" {
			continue
		}

		data, err := os.ReadFile(filepath.Join(moduleDir, file.Name()))
		if err != nil {
			continue
		}

		var mod ModuleSpec
		if err := json.Unmarshal(data, &mod); err != nil {
			continue
		}

		if len(monolith.Info) == 0 && len(mod.Info) > 0 {
			monolith.Info = mod.Info
			monolith.Host = mod.Host
			monolith.BasePath = mod.BasePath
			monolith.SecurityDefinitions = mod.SecurityDefinitions
		}

		for path, methods := range mod.Paths {
			if _, ok := monolith.Paths[path]; !ok {
				monolith.Paths[path] = make(map[string]interface{})
			}
			for method, op := range methods {
				monolith.Paths[path][method] = op
				pathCount++
			}
		}

		for defName, defBody := range mod.Definitions {
			monolith.Definitions[defName] = defBody
		}
	}

	outData, err := json.MarshalIndent(monolith, "", "    ")
	if err != nil {
		fmt.Printf("Error marshaling monolith spec: %v\n", err)
		os.Exit(1)
	}

	if err := os.WriteFile(outputFile, outData, 0644); err != nil {
		fmt.Printf("Error writing swagger.json: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Successfully merged %d endpoints and %d definitions into %s\n", pathCount, len(monolith.Definitions), outputFile)
}
