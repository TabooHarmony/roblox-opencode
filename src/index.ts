import type { Plugin } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"
import { fileURLToPath } from "node:url"

// IMPORTANT: Keep in sync with package.json "version" - mismatches cause duplicate AGENTS.md blocks on upgrade
const VERSION = "1.0.7"
const MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN - managed block, edits inside will be overwritten -->`
const MARKER_END = "<!-- roblox-opencode END -->"

/** Recommended MCP servers for Roblox development. Each entry describes what it does and how to run it. */
const RECOMMENDED_MCPS: Record<string, { description: string; command: string[]; recommended: boolean }> = {
  "roblox-docs": {
    description: "Roblox API reference — queries class docs at runtime so the assistant doesn't guess at stale properties",
    command: ["uvx", "mcp-roblox-docs"],
    recommended: true,
  },
  "web-search": {
    description: "DuckDuckGo web search + content fetch — find GUI assets, color palettes, DevForum solutions, code patterns",
    command: ["uvx", "duckduckgo-mcp-server"],
    recommended: true,
  },
  "code-analysis": {
    description: "Tree-sitter code analysis — dependency graphs, file exploration, symbol search. Gives the assistant structural understanding of your project",
    command: ["uvx", "mcp-server-tree-sitter"],
    recommended: false,
  },
}

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

  // Also copy commands to project-level .opencode/commands/ (reliable on Windows)
  try {
    const directory = ctx?.directory
    if (directory) {
      const srcDir = join(pkgDir, "commands")
      const destDir = join(directory, ".opencode", "commands")
      if (existsSync(srcDir)) {
        mkdirSync(destDir, { recursive: true })
        const files = readdirSync(srcDir).filter(f => f.endsWith(".md"))
        for (const file of files) {
          copyFileSync(join(srcDir, file), join(destDir, file))
        }
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
        // Preserve existing MCPs from opencode.json during auto-sync
        let existingMcpNames: string[] = []
        try {
          const configPath = join(directory, "opencode.json")
          if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, "utf-8"))
            existingMcpNames = Object.keys(config.mcp || {})
          }
        } catch { /* ignore */ }
        await runSetup(directory, existingMcpNames)
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
        description: `One-time project setup for roblox-opencode. Copies skills and vendor libraries to the project, writes luau-lsp config, and writes core Roblox agent instructions to AGENTS.md. Run this when first opening a Roblox project.

When called WITHOUT mcpServers: detects environment (uvx availability, existing MCPs) and returns recommended MCP servers. Present these to the user and ask which they want installed. Then call again WITH their selection.

When called WITH mcpServers: runs full setup with the selected MCP servers. Pass an array of MCP names (e.g. ["roblox-docs", "web-search"]) or an empty array to skip MCP installation.`,
        args: {
          mcpServers: tool.schema.array(tool.schema.string()).optional().describe("Array of MCP server names to install. Omit to detect environment and return recommendations. Pass [] to skip MCP installation entirely."),
        },
        async execute(args, context) {
          if (!context.directory) {
            return [{ step: "pre-check", status: "error", error: "No project directory. Open a project folder first." }]
          }
          return await runSetup(context.directory, args.mcpServers as string[] | undefined)
        },
      }),
    },
  }
}

/**
 * Setup orchestrator - copies skills, vendor libs, writes config.
 * Called by the roblox_setup tool.
 */
export async function runSetup(directory: string, mcpServers?: string[]) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync, readdirSync, copyFileSync } = await import("fs")
  const { join } = await import("path")

  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..")
  const projectDir = directory

  // Detect uvx once upfront (cross-platform)
  let uvxFound = false
  let uvxPath = "uvx"
  try {
    const { execSync } = await import("child_process")
    execSync("uvx --version", { stdio: "ignore" })
    uvxFound = true
    // Resolve full path for reliable spawning on Windows
    // (older OpenCode versions don't use cross-spawn, so bare "uvx" can fail)
    try {
      const os = await import("os")
      const isWin = os.platform() === "win32"
      const which = isWin ? "where uvx" : "which uvx"
      const resolved = execSync(which, { encoding: "utf-8" }).trim().split(/\r?\n/)[0]
      if (resolved) uvxPath = resolved
    } catch { /* fallback to bare "uvx" */ }
  } catch { /* uvx not installed */ }

  // Detect existing MCPs in opencode.json
  const configPath = join(projectDir, "opencode.json")
  let existingMcps: string[] = []
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"))
      existingMcps = Object.keys(config.mcp || {})
    } catch { /* corrupted, ignore */ }
  }

  // Phase 1: No mcpServers provided — detect and return recommendations
  if (mcpServers === undefined) {
    const recommendations = Object.entries(RECOMMENDED_MCPS).map(([name, mcp]) => ({
      name,
      description: mcp.description,
      recommended: mcp.recommended,
      alreadyInstalled: existingMcps.includes(name),
    }))

    return {
      phase: "detect" as const,
      uvxAvailable: uvxFound,
      existingMcps,
      recommendations: uvxFound
        ? recommendations
        : recommendations.map(r => ({ ...r, available: false, reason: "uvx not found" })),
      message: uvxFound
        ? "MCP servers require uvx (detected). Review the recommendations and call roblox_setup again with your selection."
        : "uvx not found — MCP servers require uvx (pip install uvx). You can still run setup without MCPs by passing mcpServers: [].",
    }
  }

  // Phase 2: Run setup with selected MCPs
  const steps: { name: string; fn: () => void }[] = []

  // Step 0: Copy commands to project-level .opencode/commands/ (cross-platform reliable)
  steps.push({
    name: "Copy commands to .opencode/commands/",
    fn: () => {
      const src = join(pkgDir, "commands")
      const dest = join(projectDir, ".opencode", "commands")
      if (!existsSync(src)) return // non-fatal if commands dir missing
      mkdirSync(dest, { recursive: true })
      const files = readdirSync(src).filter((f: string) => f.endsWith(".md"))
      for (const file of files) {
        copyFileSync(join(src, file), join(dest, file))
      }
    },
  })

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

  // Step 3: Write LSP config + selected MCPs to opencode.json
  steps.push({
    name: "Write LSP config (luau-lsp) + MCP servers",
    fn: () => {
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

      // Write selected MCP servers
      if (mcpServers.length > 0 && uvxFound) {
        const mcp = (config.mcp as Record<string, unknown>) || {}
        for (const name of mcpServers) {
          const def = RECOMMENDED_MCPS[name]
          if (def) {
            const command = def.command.map((c: string) => c === "uvx" ? uvxPath : c)
            mcp[name] = {
              type: "local",
              command,
              enabled: true,
            }
          }
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
