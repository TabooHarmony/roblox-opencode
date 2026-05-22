# roblox-pi

Opinionated Pi harness for Roblox/Luau development.

Vanilla LLMs are bad at Roblox. They hallucinate APIs, use deprecated patterns, ignore security fundamentals. roblox-pi fixes that.

## Install

```
pi install npm:roblox-pi
/setup
/init
```

## What it does

- 12 knowledge skills covering Roblox architecture, networking, data, security, and more
- Curated extension stack (8 packages) bringing Pi to full coding-agent parity
- Built-in Studio MCP integration
- Luau LSP diagnostics on every write
- 6 vendored libraries (ProfileStore, Trove, GoodSignal, Promise, Comm, Component)

## Prerequisites

- [Pi](https://pi.dev) installed
- Roblox Studio with Script Sync (Beta) enabled
- `luau-lsp` on PATH (for diagnostics)

## Status

Early development. Not yet published.

## License

MIT. Vendored libraries carry their own licenses in `vendor/LICENSES/`.
