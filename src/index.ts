import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

// IMPORTANT: Keep in sync with package.json "version" - mismatches cause duplicate AGENTS.md blocks on upgrade
const VERSION = "1.0.4"
const MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN - managed block, edits inside will be overwritten -->`
const MARKER_END = "<!-- roblox-opencode END -->"

/**
 * Plugin entry point.
 * On first load: copies commands to global config (~/.config/opencode/commands/).
 * On every load: checks if project skills need updating (version mismatch).
 * Registers roblox_setup tool for project configuration.
 */
export const RobloxOpenCode: Plugin = async (ctx) => {
  const { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } = await import("fs")
  const { join } = await import("path")
  const os = await import("os")

  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..")

  // Copy commands to global config (idempotent - always overwrites)
  try {
    const srcDir = join(pkgDir, "commands")
    const destDir = join(os.homedir(), ".config", "opencode", "commands")

    if (existsSync(srcDir)) {
      mkdirSync(destDir, { recursive: true })
      const files = readdirSync(srcDir).filter(f => f.endsWith(".md"))
      for (const file of files) {
        copyFileSync(join(srcDir, file), join(destDir, file))
      }
    }
  } catch {
    // non-fatal
  }

  // Auto-sync skills if version changed (silent upgrade on plugin load)
  try {
    const directory = ctx?.directory
    if (directory) {
      const versionFile = join(directory, ".opencode", ".roblox-opencode-version")
      let installedVersion = ""
      if (existsSync(versionFile)) {
        installedVersion = readFileSync(versionFile, "utf-8").trim()
      }
      if (installedVersion !== VERSION && existsSync(join(directory, ".opencode", "skills"))) {
        // Only auto-sync if setup was run before (skills dir exists)
        await runSetup(directory)
        mkdirSync(join(directory, ".opencode"), { recursive: true })
        writeFileSync(versionFile, VERSION + "\n")
      }
    }
  } catch {
    // non-fatal - user can always run /setup-game manually
  }

  return {
    tool: {
      roblox_setup: tool({
        description: "One-time project setup for roblox-opencode. Copies 17 skills and vendor libraries (rbxutil, profilestore, promise, testez, t, fusion) to the project, writes luau-lsp config and MCP servers (roblox-docs + web search via DuckDuckGo, if uvx is available) to opencode.json, and writes the core Roblox agent instructions to AGENTS.md. Run this when first opening a Roblox project.",
        args: {},
        async execute(_args, context) {
          if (!context.directory) {
            return [{ step: "pre-check", status: "error", error: "No project directory. Open a project folder first." }]
          }
          return await runSetup(context.directory)
        },
      }),
    },
  }
}

/**
 * Setup orchestrator - copies skills, vendor libs, writes config.
 * Called by the roblox_setup tool.
 */
export async function runSetup(directory: string) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } = await import("fs")
  const { join } = await import("path")

  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..")
  const projectDir = directory

  const steps: { name: string; fn: () => void }[] = []

  // Detect uvx once upfront
  let uvxFound = false
  try {
    const { execSync } = await import("child_process")
    execSync("command -v uvx", { stdio: "ignore" })
    uvxFound = true
  } catch { /* uvx not installed */ }

  // Step 1: Copy skills (always overwrite - ensures updates propagate)
  steps.push({
    name: "Copy 17 skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills")
      const dest = join(projectDir, ".opencode", "skills")
      if (!existsSync(src)) throw new Error(`skills/ not found in plugin at ${src}`)
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true, force: true })
    },
  })

  // Step 2: Copy vendor libs (always overwrite)
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor")
      const dest = join(projectDir, ".opencode", "vendor")
      if (!existsSync(src)) throw new Error(`vendor/ not found in plugin at ${src}`)
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true, force: true })
    },
  })

  // Step 3: Write LSP config to opencode.json
  steps.push({
    name: "Write LSP config (luau-lsp)",
    fn: () => {
      const configPath = join(projectDir, "opencode.json")
      let config: Record<string, unknown> = {}
      if (existsSync(configPath)) {
        try { config = JSON.parse(readFileSync(configPath, "utf-8")) } catch { /* corrupted, start fresh */ }
      }
      config.lsp = {
        ...(config.lsp as Record<string, unknown> || {}),
        luau: {
          command: ["luau-lsp", "lsp"],
          extensions: [".luau"],
        },
      }

      // Register MCP servers if uvx is available
      if (uvxFound) {
        const mcp = (config.mcp as Record<string, unknown>) || {}
        mcp["roblox-docs"] = {
          type: "local",
          command: ["uvx", "mcp-roblox-docs"],
          enabled: true,
        }
        mcp["web-search"] = {
          type: "local",
          command: ["uvx", "duckduckgo-mcp-server"],
          enabled: true,
        }
        config.mcp = mcp
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
    },
  })

  // Step 3b: Write .luaurc so luau-lsp resolves vendor paths
  steps.push({
    name: "Write .luaurc (vendor path aliases)",
    fn: () => {
      const luaurcPath = join(projectDir, ".luaurc")
      let luaurc: Record<string, unknown> = {}
      if (existsSync(luaurcPath)) {
        try { luaurc = JSON.parse(readFileSync(luaurcPath, "utf-8")) } catch { /* corrupted, start fresh */ }
      }
      // Merge aliases - preserve user-defined ones, add/overwrite ours
      const aliases = (luaurc.aliases as Record<string, string>) || {}
      aliases["Packages"] = ".opencode/vendor/rbxutil"
      aliases["Fusion"] = ".opencode/vendor/fusion"
      aliases["ProfileStore"] = ".opencode/vendor/profilestore"
      aliases["Promise"] = ".opencode/vendor/promise"
      aliases["TestEZ"] = ".opencode/vendor/testez"
      aliases["t"] = ".opencode/vendor/t"
      luaurc.aliases = aliases
      luaurc.languageMode = luaurc.languageMode || "nonstrict"
      writeFileSync(luaurcPath, JSON.stringify(luaurc, null, 2) + "\n")
    },
  })

  // Step 4: Write core block to AGENTS.md
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const agentsPath = join(projectDir, "AGENTS.md")
      const corePath = join(pkgDir, "core", "roblox-core.md")
      if (!existsSync(corePath)) throw new Error(`core/roblox-core.md not found in plugin at ${corePath}`)
      const coreContent = readFileSync(corePath, "utf-8")
      const block = `${MARKER_BEGIN}\n${coreContent}\n${MARKER_END}`

      let agentsContent = ""
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8")
      }

      const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/
      const endPattern = /<!-- roblox-opencode END -->/
      const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/
      const oldEndPattern = /<!-- roblox-pi END -->/

      let newContent: string
      if (beginPattern.test(agentsContent) && endPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
          block
        )
      } else if (oldBeginPattern.test(agentsContent) && oldEndPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
          block
        )
      } else {
        // No existing block - append below existing content
        newContent = agentsContent ? agentsContent.trimEnd() + "\n\n" + block + "\n" : block + "\n"
      }
      writeFileSync(agentsPath, newContent)
    },
  })

  // Execute all steps
  const results: { step: string; status: "ok" | "error"; error?: string }[] = []
  for (const step of steps) {
    try {
      step.fn()
      results.push({ step: step.name, status: "ok" })
    } catch (err) {
      results.push({
        step: step.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Write version marker so auto-sync knows when to update
  try {
    const versionFile = join(projectDir, ".opencode", ".roblox-opencode-version")
    mkdirSync(join(projectDir, ".opencode"), { recursive: true })
    writeFileSync(versionFile, VERSION + "\n")
  } catch {
    // non-fatal
  }

  return results
}

export default {
  id: "roblox-opencode",
  server: RobloxOpenCode,
}
