/**
 * luau-check — Pi extension for Roblox/Luau diagnostics.
 *
 * Hooks write/edit events for .luau files, runs luau-lsp analyze,
 * injects diagnostics into the next agent turn's context.
 *
 * Phase 0 spike. Validate mechanism before production use.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { spawn } from "child_process";

interface Diagnostic {
  file: string;
  line: number;
  column: number;
  severity: "error" | "warning" | "info";
  message: string;
}

// Track pending diagnostics per file path
const pendingDiagnostics = new Map<string, Promise<Diagnostic[]>>();

function runLuauAnalyze(filePath: string): Promise<Diagnostic[]> {
  return new Promise((resolve) => {
    const proc = spawn("luau-lsp", [
      "analyze",
      filePath,
      "--formatter", "plain",
    ], { timeout: 15000 });

    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d: Buffer) => (stdout += d.toString()));
    proc.stderr.on("data", (d: Buffer) => (stderr += d.toString()));

    proc.on("close", () => {
      if (stderr.includes("not found") || stderr.includes("ENOENT")) {
        resolve([]);
        return;
      }
      resolve(parseDiagnostics(stdout, filePath));
    });

    proc.on("error", () => resolve([])); // binary not found
  });
}

function parseDiagnostics(output: string, filePath: string): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const line of output.split("\n")) {
    // luau-lsp --formatter plain:
    // path.luau:line:col: severity: message
    const match = line.match(/:(\d+):(\d+)\s+(error|warning|info):\s+(.+)/);
    if (match) {
      diagnostics.push({
        file: filePath,
        line: parseInt(match[1]),
        column: parseInt(match[2]),
        severity: match[3] as Diagnostic["severity"],
        message: match[4].trim(),
      });
    }
  }
  return diagnostics;
}

export default function (pi: ExtensionAPI) {
  // Hook tool completions — detect .luau writes/edits
  pi.on("tool_result", async (event, _ctx) => {
    if (event.toolName !== "write" && event.toolName !== "edit") return;

    const input = event.input as { path?: string };
    if (!input.path || !input.path.endsWith(".luau")) return;

    // Fire-and-forget: spawn luau-lsp, store promise
    const diagPromise = runLuauAnalyze(input.path);
    pendingDiagnostics.set(input.path, diagPromise);
  });

  // Inject diagnostics before next agent turn
  pi.on("before_agent_start", async (_event, ctx) => {
    if (pendingDiagnostics.size === 0) return;

    const allDiagnostics: Diagnostic[] = [];
    const entries = Array.from(pendingDiagnostics.entries());
    pendingDiagnostics.clear();

    for (const [_file, promise] of entries) {
      const diags = await promise;
      allDiagnostics.push(...diags);
    }

    if (allDiagnostics.length === 0) return;

    const errors = allDiagnostics.filter((d) => d.severity === "error");

    let msg = "[luau-check] Diagnostics:\n";
    for (const d of allDiagnostics) {
      msg += `  ${d.file}:${d.line}:${d.column} ${d.severity}: ${d.message}\n`;
    }

    if (errors.length > 0) {
      msg += `\n${errors.length} error(s) found. Fix or justify before claiming "done".`;
    }

    // Inject as context the agent sees
    ctx.sendMessage({
      role: "user",
      content: [{ type: "text", text: msg }],
    });
  });
}
