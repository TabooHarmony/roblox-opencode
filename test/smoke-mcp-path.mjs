/**
 * Smoke test: verifies MCP config writes a resolved uvx path.
 * Runs on both Linux and Windows in CI.
 */
import { mkdtempSync, readFileSync, rmSync, existsSync } from "fs"
import { join } from "path"
import { tmpdir, platform } from "os"

const { runSetup } = await import("../dist/server.js")

const dir = mkdtempSync(join(tmpdir(), "roblox-opencode-smoke-"))

try {
  // Test 1: MCP path resolution
  const results = await runSetup(dir, ["roblox-docs"])
  for (const r of results) {
    if (r.status !== "ok") {
      console.error(`FAIL: Step "${r.step}" failed: ${r.error}`)
      process.exit(1)
    }
  }

  const config = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf-8"))
  const cmd = config.mcp["roblox-docs"].command

  console.log(`Platform: ${platform()}`)
  console.log(`MCP command: ${JSON.stringify(cmd)}`)

  if (!cmd[0].includes("uvx")) {
    console.error("FAIL: uvx not found in command path")
    process.exit(1)
  }
  if (cmd[1] !== "mcp-roblox-docs") {
    console.error("FAIL: wrong mcp package name")
    process.exit(1)
  }

  // Test 2: Commands copied to project-level
  if (!existsSync(join(dir, ".opencode", "commands", "setup-game.md"))) {
    console.error("FAIL: setup-game.md not copied to .opencode/commands/")
    process.exit(1)
  }

  // Test 3: .luaurc written
  const luaurc = JSON.parse(readFileSync(join(dir, ".luaurc"), "utf-8"))
  if (!luaurc.aliases || !luaurc.aliases["Packages"]) {
    console.error("FAIL: .luaurc aliases not written")
    process.exit(1)
  }

  // Test 4: AGENTS.md written
  const agents = readFileSync(join(dir, "AGENTS.md"), "utf-8")
  if (!agents.includes("roblox-opencode")) {
    console.error("FAIL: AGENTS.md managed block not written")
    process.exit(1)
  }

  // Test 5: Version file written
  const version = readFileSync(join(dir, ".opencode", ".roblox-opencode-version"), "utf-8").trim()
  if (!version) {
    console.error("FAIL: version file not written")
    process.exit(1)
  }

  console.log(`PASS: All smoke tests passed on ${platform()}`)
} finally {
  rmSync(dir, { recursive: true, force: true })
}
