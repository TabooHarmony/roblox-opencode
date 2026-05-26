import { test } from "node:test"
import assert from "node:assert/strict"
import { mkdtempSync, existsSync, readFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"

// Import the built module
const { runSetup } = await import("../dist/server.js")

test("runSetup copies skills, vendor, config, and AGENTS.md", async () => {
  const dir = mkdtempSync(join(tmpdir(), "roblox-opencode-test-"))
  try {
    const results = await runSetup(dir)

    // All steps should succeed
    for (const r of results) {
      assert.equal(r.status, "ok", `Step "${r.step}" failed: ${r.error}`)
    }

    // Skills copied
    assert.ok(existsSync(join(dir, ".opencode", "skills", "roblox-luau-mastery", "SKILL.md")))
    assert.ok(existsSync(join(dir, ".opencode", "skills", "roblox-networking", "SKILL.md")))
    assert.ok(existsSync(join(dir, ".opencode", "skills", "roblox-analytics", "SKILL.md")))

    // Vendor copied to .opencode/vendor/
    assert.ok(existsSync(join(dir, ".opencode", "vendor", "profilestore", "init.luau")))
    assert.ok(existsSync(join(dir, ".opencode", "vendor", "promise", "init.luau")))
    assert.ok(existsSync(join(dir, ".opencode", "vendor", "rbxutil", "trove", "init.luau")))

    // opencode.json has LSP config
    const config = JSON.parse(readFileSync(join(dir, "opencode.json"), "utf-8"))
    assert.deepEqual(config.lsp.luau.command, ["luau-lsp", "lsp"])
    assert.deepEqual(config.lsp.luau.extensions, [".luau"])

    // .luaurc has aliases
    const luaurc = JSON.parse(readFileSync(join(dir, ".luaurc"), "utf-8"))
    assert.equal(luaurc.aliases["Packages"], ".opencode/vendor/rbxutil")
    assert.equal(luaurc.aliases["Fusion"], ".opencode/vendor/fusion")
    assert.equal(luaurc.aliases["ProfileStore"], ".opencode/vendor/profilestore")
    assert.equal(luaurc.aliases["Promise"], ".opencode/vendor/promise")

    // AGENTS.md has the managed block
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf-8")
    assert.ok(agents.includes("<!-- roblox-opencode 1.0.3 BEGIN"))
    assert.ok(agents.includes("<!-- roblox-opencode END -->"))
    assert.ok(agents.includes("Sharp Edges"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("runSetup preserves existing AGENTS.md content outside markers", async () => {
  const dir = mkdtempSync(join(tmpdir(), "roblox-opencode-test-"))
  const { writeFileSync, mkdirSync } = await import("fs")
  try {
    // Pre-populate AGENTS.md with user content
    writeFileSync(join(dir, "AGENTS.md"), "# My Project\n\nCustom instructions here.\n")

    const results = await runSetup(dir)
    for (const r of results) {
      assert.equal(r.status, "ok", `Step "${r.step}" failed: ${r.error}`)
    }

    const agents = readFileSync(join(dir, "AGENTS.md"), "utf-8")
    assert.ok(agents.includes("# My Project"))
    assert.ok(agents.includes("Custom instructions here."))
    assert.ok(agents.includes("<!-- roblox-opencode 1.0.3 BEGIN"))
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})

test("runSetup replaces existing managed block on re-run", async () => {
  const dir = mkdtempSync(join(tmpdir(), "roblox-opencode-test-"))
  try {
    // Run twice
    await runSetup(dir)
    const results = await runSetup(dir)

    for (const r of results) {
      assert.equal(r.status, "ok", `Step "${r.step}" failed: ${r.error}`)
    }

    // Should only have one BEGIN marker
    const agents = readFileSync(join(dir, "AGENTS.md"), "utf-8")
    const beginCount = (agents.match(/<!-- roblox-opencode.*BEGIN/g) || []).length
    assert.equal(beginCount, 1, "Should have exactly one managed block")
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
