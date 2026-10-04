package languages

// --- IMPORTS ---
import (
	"encoding/json"
)

// --- GLOBALS ---

// NOTE: ids match the backend and frontend, and the Dockerfile.
var catalog = []Language{
	{
		ID:       "python",
		Command:  []string{"pyright-langserver", "--stdio"},
		Document: "main.py",
	},
	{
		ID:       "javascript",
		Command:  []string{"typescript-language-server", "--stdio"},
		Document: "main.js",
		Files: map[string]string{
			// node runs it: its api is fair game
			"jsconfig.json": `{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "types": ["node"],
    "typeRoots": ["` + NodeTypesPlaceholder + `"]
  }
}`,
		},
	},
	{
		ID:       "typescript",
		Command:  []string{"typescript-language-server", "--stdio"},
		Document: "main.ts",
		Files: map[string]string{
			// no node types, as in the sandbox: the template declares require
			"tsconfig.json": `{
  "compilerOptions": {
    "target": "es2022",
    "lib": ["es2022"],
    "types": [],
    "strict": false
  }
}`,
		},
	},
	{
		ID:       "go",
		Command:  []string{"gopls"},
		Document: "main.go",
		Files: map[string]string{
			// the sandbox runs go 1.16
			"go.mod": "module main\n\ngo 1.16\n",
		},
		// never reach the network for modules or toolchains
		Env: []string{
			"GOPROXY=off",
			"GOFLAGS=-mod=mod",
			"GOTOOLCHAIN=local",
			"GOTELEMETRY=off",
		},
	},
	{
		ID:       "c",
		Command:  clangd,
		Document: "main.c",
		Files:    map[string]string{"compile_flags.txt": "-std=c11\n"},
	},
	{
		ID:       "cpp",
		Command:  clangd,
		Document: "main.cpp",
		Files:    map[string]string{"compile_flags.txt": "-std=c++17\n"},
	},
	{
		ID:       "rust",
		Command:  []string{"rust-analyzer"},
		Document: "src/main.rs",
		Files: map[string]string{
			"Cargo.toml": "[package]\nname = \"main\"\nversion = \"0.1.0\"\n" +
				"edition = \"2021\"\n",
		},
		Env: []string{"CARGO_NET_OFFLINE=true"},
		// no builds on save: they take seconds and memory
		InitializationOptions: json.RawMessage(`{
  "checkOnSave": false,
  "cargo": { "buildScripts": { "enable": false } },
  "procMacro": { "enable": false }
}`),
	},
	{
		ID:       "java",
		Command:  []string{"jdtls-session"},
		Document: "Main.java",
	},
}

// clangd, without the headers it would add on its own on completion
var clangd = []string{
	"clangd",
	"--header-insertion=never",
	"--log=error",
}

// --- CODE ---

// Find returns the language of an id.
func Find(id string) (Language, bool) {

	for _, language := range catalog {
		if language.ID == id {
			return language, true
		}
	}

	return Language{}, false
}

// IDs returns every language id, in catalog order.
func IDs() []string {

	ids := make([]string, 0, len(catalog))

	for _, language := range catalog {
		ids = append(ids, language.ID)
	}

	return ids
}
