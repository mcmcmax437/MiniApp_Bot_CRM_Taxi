# codebase-memory-mcp (project-local)

This directory contains the `codebase-memory-mcp` binary used by Cursor's
MCP server for this repo. The binary indexes the codebase into a persistent
knowledge graph and exposes structural code-intelligence tools.

## Layout

- `codebase-memory-mcp.exe` — the static binary (Windows amd64).
- `install.ps1` — the upstream installer. **Not used here** because it
  auto-detects and modifies config for 11+ coding agents. We wire Cursor
  up manually instead via `../../.cursor/mcp.json`.
- `LICENSE`, `THIRD_PARTY_NOTICES.md` — upstream licensing.

## How Cursor picks it up

The MCP server is registered in the project-local `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "codebase-memory": {
      "command": "${workspaceFolder}\\tools\\codebase-memory-mcp\\codebase-memory-mcp.exe",
      "args": [],
      "env": { "CBM_LOG_LEVEL": "info" }
    }
  }
}
```

Cursor resolves `${workspaceFolder}` to this repo root, so the entry works
across machines without per-user config edits.

## First-time index

After Cursor loads the MCP server, ask the agent:

> Index this project.

…or call directly from a shell:

```powershell
& .\tools\codebase-memory-mcp\codebase-memory-mcp.exe cli index_repository `
    '{"repo_path": "D:\Tereshkovych-WebSite\Application\MiniApp_Bot_CRM_Taxi"}'
& .\tools\codebase-memory-mcp\codebase-memory-mcp.exe cli list_projects
```

The index is written to `.codebase-memory/` (gitignored) and `~/.cache/codebase-memory-mcp/`.

## Available MCP tools

`index_repository`, `search_graph`, `query_graph`, `trace_path`,
`get_code_snippet`, `get_graph_schema`, `get_architecture`, `search_code`,
`list_projects`, `delete_project`, `index_status`, `detect_changes`,
`manage_adr`, `ingest_traces`.

## Updating

1. Fetch the new checksums from the latest GitHub release.
2. Download the new `codebase-memory-mcp-windows-amd64.zip` and verify
   its SHA-256 against `checksums.txt`.
3. Replace `codebase-memory-mcp.exe` in this directory.
4. Restart Cursor.

## Uninstalling

Delete this directory and remove the entry from `.cursor/mcp.json`.
To wipe the cached index: `rm -rf .codebase-memory` and
`rm -rf ~/.cache/codebase-memory-mcp/`.

## Pinned version

v0.8.1 — `a602ad090ed3f49d86c55472f73f27ad7055222806a82358f2e08513e027f00f`
(Linux-x86_64 `linux-amd64` SHA listed in `../codebase-memory-mcp-checksums.txt`).