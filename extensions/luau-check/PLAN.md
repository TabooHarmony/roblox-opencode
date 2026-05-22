# luau-check Extension — Implementation Plan

## What It Does

Hooks pi's `tool_result` event. When a write or edit completes on a `.luau` file,
spawns `luau-lsp analyze` asynchronously and injects diagnostics into the next
agent turn's context.

## Pi Extension API Surface

Key events:
- `tool_result` — fires after a tool completes. Can return modified content.
  `event.toolName` is "write" or "edit". `event.input.path` has the file path.
- `before_agent_start` — fires before each LLM turn. Inject messages here.

Key APIs:
- `pi.on("tool_result", handler)` — subscribe to tool completions
- `pi.on("before_agent_start", handler)` — inject context before LLM turn
- `ctx.sendMessage({ role: "user", content: [...] })` — inject a message
- Return `{ content: [...] }` from tool_result to modify the tool's output

## Architecture

```
tool_result fires (write/edit on .luau file)
  → spawn luau-lsp analyze (non-blocking, fire-and-forget)
  → store promise in pendingDiagnostics Map<filePath, Promise<string>>

before_agent_start fires (next turn)
  → await all pending diagnostics
  → if any have errors/warnings, inject as context message
  → clear the map
```

## Implementation (~60-80 lines)

```typescript
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "child_process";

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
  code?: string;
}

const pendingDiagnostics = new Map<string, Promise<Diagnostic[]>>();

function runLuauAnalyze(filePath: string): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    // Check if luau-lsp is available
    const proc = spawn("luau-lsp", [
      "analyze",
      filePath,
      "--formatter", "plain",
      "--definitions", "globalTypes.d.luau"  // path configured by /setup
    ], { timeout: 10000 });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => stdout += d);
    proc.stderr.on("data", (d) => stderr += d);

    proc.on("close", (code) => {
      if (code === null || stderr.includes("not found")) {
        resolve([]);  // luau-lsp not available, silently skip
        return;
      }
      resolve(parseDiagnostics(stdout, filePath));
    });

    proc.on("error", () => resolve([]));  // binary not found
  });
}

function parseDiagnostics(output: string, filePath: string): Diagnostic[] {
  // luau-lsp --formatter plain outputs:
  // path.luau:line:col: severity: message [code]
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    const match = line.match(/:(\d+):(\d+): (error|warning|info): (.+)/);
    if (match) {
      diagnostics.push({
        file: filePath,
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        severity: match[3] as Diagnostic["severity"],
        message: match[4],
      });
    }
  }
  return diagnostics;
}

export default function (pi: ExtensionAPI) {
  // Hook tool completions
  pi.on("tool_result", async (event, ctx) => {
    // Only hook write and edit tools
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const input = event.input as { path?: string };
    if (!input.path || !input.path.endsWith(".luau")) return;

    // Spawn luau-lsp asynchronously (fire-and-forget)
    const diagPromise = runLuauAnalyze(input.path);
    pendingDiagnostics.set(input.path, diagPromise);
  });

  // Inject diagnostics before next agent turn
  pi.on("before_agent_start", async (_event, ctx) => {
    if (pendingDiagnostics.size === 0) return;

    // Collect all pending diagnostics
    const allDiagnostics: Diagnostic[] = [];
    const entries = Array.from(pendingDiagnostics.entries());
    pendingDiagnostics.clear();

    for (const [file, promise] of entries) {
      const diags = await promise;
      allDiagnostics.push(...diags);
    }

    if (allDiagnostics.length === 0) return;

    // Format diagnostics as a context injection
    const errors = allDiagnostics.filter(d => d.severity === "error");
    const warnings = allDiagnostics.filter(d => d.severity === "warning");

    let msg = "[luau-check] Diagnostics:\n";
    for (const d of allDiagnostics) {
      msg += `  ${d.file}:${d.line}:${d.column} ${d.severity}: ${d.message}\n`;
    }

    if (errors.length > 0) {
      msg += `\n${errors.length} error(s) found. Fix or justify before claiming "done".`;
    }

    // Inject as a system message the agent sees
    ctx.sendMessage({
      role: "user",
      content: [{ type: "text", text: msg }],
    });
  });
}
```

## What the Agent Sees

After writing a .luau file, on the NEXT turn the agent sees:

```
[luau-check] Diagnostics:
  src/CombatService.luau:42:10 error: Type 'string' could not be converted into 'number'
  src/CombatService.luau:58:3 warning: Unused local 'tempVar'

1 error(s) found. Fix or justify before claiming "done".
```

The core block directive reinforces: "Never claim done with unresolved diagnostics."

## Open Questions (validate in Phase 0 spike)

1. **luau-lsp analyze output format.** Need to verify `--formatter plain` exists
   and the exact output pattern. If it outputs JSON, parse differently.
2. **globalTypes.d.luau path.** Where does /setup put it? Need a consistent path
   the extension can find. Options: `~/.pi/agent/luau/globalTypes.d.luau` or
   alongside the project in `.pi/luau/globalTypes.d.luau`.
3. **ctx.sendMessage behavior.** Does injecting a user-role message work for
   context injection, or should we use the `context` event to modify the system
   prompt instead? Test both approaches.
4. **Performance.** luau-lsp analyze on a large .luau file (1000+ lines) might
   take 2-5 seconds. Fire-and-forget means the agent doesn't wait, but the
   diagnostics arrive on the NEXT turn. Is that acceptable latency?
5. **Multiple rapid writes.** If the agent writes to the same file 3 times in
   one turn, we spawn 3 analyze processes. Should we debounce (cancel previous
   analyze for same file) or let them all run?

## Phase 0 Spike Checklist

- [ ] Verify `luau-lsp analyze --formatter plain <file>` works from CLI
- [ ] Verify exact output format (plain vs JSON)
- [ ] Write the extension as above (~80 lines)
- [ ] Install via `pi -e ./extensions/luau-check/index.ts`
- [ ] Write a .luau file via pi, check if diagnostics appear on next turn
- [ ] Test with valid Luau (no diagnostics expected)
- [ ] Test with intentionally broken Luau (diagnostics expected)
- [ ] Test with luau-lsp NOT installed (should silently skip)
- [ ] Measure latency on a 500-line .luau file
- [ ] Verify no interference with pi-hashline-edit
