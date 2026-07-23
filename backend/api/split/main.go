package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strings"
)

func main() {
	root := filepath.Clean("./api")
	specPath := filepath.Join(root, "docs", "swagger.json")
	moduleDir := filepath.Join(root, "module")

	spec := readSpec(specPath)
	tagGroups := groupByTag(spec)
	sharedDefs := findShared(spec, tagGroups)
	moduleDefs := findModuleSpecific(spec, tagGroups, sharedDefs)

	writeShared(filepath.Join(moduleDir, "_shared.json"), spec, sharedDefs)
	writeModules(moduleDir, spec, tagGroups, moduleDefs, sharedDefs)

	fmt.Printf("Split %d paths into %d modules\n", len(spec.Paths), len(tagGroups))
	fmt.Println("Modules:")
	keys := make([]string, 0, len(tagGroups))
	for k := range tagGroups {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		fmt.Printf("  %s: %d paths\n", k, len(tagGroups[k]))
	}
	fmt.Printf("Shared definitions: %d\n", len(sharedDefs))
}

type Spec struct {
	Swagger  string                `json:"swagger"`
	Info     json.RawMessage       `json:"info"`
	Host     string                `json:"host"`
	BasePath string                `json:"basePath"`
	Paths    map[string]PathItem   `json:"paths"`
	Defs     map[string]json.RawMessage `json:"definitions"`
	SecDefs  json.RawMessage       `json:"securityDefinitions"`
}

type PathItem struct {
	Get    *Operation `json:"get,omitempty"`
	Post   *Operation `json:"post,omitempty"`
	Put    *Operation `json:"put,omitempty"`
	Delete *Operation `json:"delete,omitempty"`
}

type Operation struct {
	Tags        []string               `json:"tags"`
	Summary     string                 `json:"summary"`
	Description string                 `json:"description"`
	Parameters  []json.RawMessage      `json:"parameters"`
	Responses   map[string]Response    `json:"responses"`
	Security    []map[string][]string  `json:"security"`
	Consumes    []string               `json:"consumes"`
	Produces    []string               `json:"produces"`
}

type Response struct {
	Description string          `json:"description"`
	Schema      json.RawMessage `json:"schema"`
}

func readSpec(path string) *Spec {
	data, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	var spec Spec
	if err := json.Unmarshal(data, &spec); err != nil {
		panic(fmt.Sprintf("parse %s: %v", path, err))
	}
	if spec.Defs == nil {
		spec.Defs = map[string]json.RawMessage{}
	}
	return &spec
}

var refRE = regexp.MustCompile(`"#/definitions/([^"]+)"`)

func collectRefs(v any) []string {
	refs := map[string]bool{}
	collectRefsRecursive(v, refs)
	out := make([]string, 0, len(refs))
	for r := range refs {
		out = append(out, r)
	}
	return out
}

func collectRefsRecursive(v any, acc map[string]bool) {
	switch val := v.(type) {
	case map[string]any:
		if ref, ok := val["$ref"].(string); ok {
			if strings.HasPrefix(ref, "#/definitions/") {
				acc[strings.TrimPrefix(ref, "#/definitions/")] = true
			}
		}
		for _, child := range val {
			collectRefsRecursive(child, acc)
		}
	case []any:
		for _, child := range val {
			collectRefsRecursive(child, acc)
		}
	}
}

func groupByTag(spec *Spec) map[string][]string {
	groups := map[string][]string{}
	tagOrder := map[string]int{}
	order := 0
	for path, item := range spec.Paths {
		var tag string
		for _, op := range []*Operation{item.Get, item.Post, item.Put, item.Delete} {
			if op != nil && len(op.Tags) > 0 {
				tag = op.Tags[0]
				break
			}
		}
		if tag == "" {
			tag = "Other"
		}
		if _, ok := tagOrder[tag]; !ok {
			tagOrder[tag] = order
			order++
		}
		groups[tag] = append(groups[tag], path)
	}
	return groups
}

func findShared(spec *Spec, tagGroups map[string][]string) map[string]bool {
	defUsage := map[string]map[string]bool{}
	for tag, paths := range tagGroups {
		for _, path := range paths {
			item := spec.Paths[path]
			ops := []*Operation{item.Get, item.Post, item.Put, item.Delete}
			for _, op := range ops {
				if op == nil {
					continue
				}
				raw, _ := json.Marshal(op)
				var v any
				json.Unmarshal(raw, &v)
				for _, ref := range collectRefs(v) {
					if defUsage[ref] == nil {
						defUsage[ref] = map[string]bool{}
					}
					defUsage[ref][tag] = true
				}
			}
		}
	}
	shared := map[string]bool{}
	for def, tags := range defUsage {
		if len(tags) > 1 {
			shared[def] = true
		}
	}
	for def := range spec.Defs {
		if strings.HasPrefix(def, "echo-backend_internal_models.") {
			shared[def] = true
		}
	}
	fmt.Printf("Debug: %d unique refs, %d shared models\n", len(defUsage), len(shared))
	return shared
}

func findModuleSpecific(spec *Spec, tagGroups map[string][]string, sharedDefs map[string]bool) map[string][]string {
	specific := map[string][]string{}
	for tag := range tagGroups {
		specific[tag] = nil
	}
	for def := range spec.Defs {
		if !sharedDefs[def] {
			for tag := range tagGroups {
				if defUsedByTag(spec, tagGroups, def, tag) {
					specific[tag] = append(specific[tag], def)
				}
			}
		}
	}
	return specific
}

func defUsedByTag(spec *Spec, tagGroups map[string][]string, def, tag string) bool {
	for _, path := range tagGroups[tag] {
		item := spec.Paths[path]
		ops := []*Operation{item.Get, item.Post, item.Put, item.Delete}
		for _, op := range ops {
			if op == nil {
				continue
			}
			raw, _ := json.Marshal(op)
			var v any
			json.Unmarshal(raw, &v)
			for _, ref := range collectRefs(v) {
				if ref == def {
					return true
				}
			}
		}
	}
	return false
}

func writeShared(path string, spec *Spec, sharedDefs map[string]bool) {
	defs := map[string]json.RawMessage{}
	for def := range sharedDefs {
		if raw, ok := spec.Defs[def]; ok {
			defs[def] = raw
		}
	}
	if len(defs) == 0 {
		defs = nil
	}
	obj := map[string]any{
		"swagger": spec.Swagger,
		"info":    spec.Info,
		"host":    spec.Host,
		"basePath": spec.BasePath,
		"paths":   map[string]any{},
	}
	if spec.SecDefs != nil {
		obj["securityDefinitions"] = spec.SecDefs
	}
	if defs != nil {
		obj["definitions"] = defs
	}
	writeJSON(path, obj)
	fmt.Printf("  _shared.json: %d definitions\n", len(defs))
}

func writeModules(dir string, spec *Spec, tagGroups map[string][]string, moduleDefs map[string][]string, sharedDefs map[string]bool) {
	order := []string{"Health", "Auth", "Chat", "Sessions", "Settings", "Models", "Admin", "Internal"}
	for _, tag := range order {
		paths, ok := tagGroups[tag]
		if !ok {
			continue
		}
		pathEntries := map[string]PathItem{}
		for _, p := range paths {
			pathEntries[p] = spec.Paths[p]
		}
		defs := map[string]json.RawMessage{}
		for _, def := range moduleDefs[tag] {
			if raw, ok := spec.Defs[def]; ok {
				defs[def] = raw
			}
		}
		obj := map[string]any{
			"swagger":  spec.Swagger,
			"info":     spec.Info,
			"host":     spec.Host,
			"basePath": spec.BasePath,
			"paths":    pathEntries,
		}
		if spec.SecDefs != nil {
			obj["securityDefinitions"] = spec.SecDefs
		}
		if defs != nil {
			obj["definitions"] = defs
		}
		if len(sharedDefs) > 0 {
			sharedList := make([]string, 0, len(sharedDefs))
			for d := range sharedDefs {
				sharedList = append(sharedList, d)
			}
			sort.Strings(sharedList)
			obj["x-shared-definitions"] = sharedList
		}
		filename := strings.ToLower(strings.ReplaceAll(tag, " ", "-")) + ".json"
		writeJSON(filepath.Join(dir, filename), obj)
		fmt.Printf("  %s: %d paths, %d definitions\n", filename, len(pathEntries), len(defs))
	}
}

func writeJSON(path string, v any) {
	data, err := json.MarshalIndent(v, "", "    ")
	if err != nil {
		panic(fmt.Sprintf("marshal %s: %v", path, err))
	}
	if err := os.WriteFile(path, data, 0644); err != nil {
		panic(fmt.Sprintf("write %s: %v", path, err))
	}
}
