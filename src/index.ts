import type { Plugin } from "@opencode-ai/plugin"
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs"
import { join, dirname } from "path"

const VERSION = "1.0.0"
const MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN — managed block, edits inside will be overwritten -->`
const MARKER_END = "<!-- roblox-opencode END -->"

export const RobloxOpenCode: Plugin = async ({ directory, client }) => {
  const projectDir = directory
  const pkgDir = dirname(dirname(new URL(import.meta.url).pathname))

  // Only activate for Roblox projects — check for .luau files or existing markers
  const agentsPath = join(projectDir, "AGENTS.md")
  let isRobloxProject = false

  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8")
    if (content.includes("<!-- roblox-opencode") || content.includes("<!-- roblox-pi")) {
      isRobloxProject = true
    }
  }

  if (!isRobloxProject) {
    // Check for .luau files in the project
    try {
      const { readdirSync } = await import("fs")
      const hasLuau = (dir, depth) => {
        if (depth > 2) return false
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith(".")) continue
          const full = join(dir, entry.name)
          if (entry.isFile() && entry.name.endsWith(".luau")) return true
          if (entry.isDirectory() && hasLuau(full, depth + 1)) return true
        }
        return false
      }
      isRobloxProject = hasLuau(projectDir, 0)
    } catch {
      // can't read directory, stay silent
    }
  }

  if (!isRobloxProject) return {} // silent — not a Roblox project

  client.app.log.info(`roblox-opencode v${VERSION} loaded`)

  // Auto-copy skills and commands to project if missing
  const skillsDir = join(projectDir, ".opencode", "skills")
  const commandsDir = join(projectDir, ".opencode", "commands")

  if (!existsSync(skillsDir)) {
    try {
      mkdirSync(skillsDir, { recursive: true })
      cpSync(join(pkgDir, "skills"), skillsDir, { recursive: true })
      client.app.log.info("roblox-opencode: skills copied to .opencode/skills/")
    } catch (e) {
      client.app.log.warn(`roblox-opencode: failed to copy skills: ${e}`)
    }
  }

  if (!existsSync(commandsDir)) {
    try {
      mkdirSync(commandsDir, { recursive: true })
      cpSync(join(pkgDir, "commands"), commandsDir, { recursive: true })
      client.app.log.info("roblox-opencode: commands copied to .opencode/commands/")
    } catch (e) {
      client.app.log.warn(`roblox-opencode: failed to copy commands: ${e}`)
    }
  }

  // Check if AGENTS.md has current version markers
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8")
    const hasCurrentMarkers = content.includes(MARKER_BEGIN)
    const hasOldMarkers = content.includes("<!-- roblox-opencode") && !hasCurrentMarkers

    if (hasOldMarkers) {
      client.app.log.warn("roblox-opencode AGENTS.md markers are outdated. Run /setup to update.")
    }
  }

  return {}
}

/**
 * Setup orchestrator — copies files, writes config, initializes the project.
 * Called by the /setup command.
 */
export async function runSetup(directory: string) {
  const pkgDir = dirname(new URL(import.meta.url).pathname.replace("/src", ""))
  const projectDir = directory

  const steps: { name: string; fn: () => void }[] = []

  // Step 1: Copy skills
  steps.push({
    name: "Copy skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills")
      const dest = join(projectDir, ".opencode", "skills")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 2: Copy commands
  steps.push({
    name: "Copy commands to .opencode/commands/",
    fn: () => {
      const src = join(pkgDir, "commands")
      const dest = join(projectDir, ".opencode", "commands")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 3: Copy vendor libs
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor")
      const dest = join(projectDir, "vendor")
      mkdirSync(dest, { recursive: true })
      cpSync(src, dest, { recursive: true })
    },
  })

  // Step 4: Write LSP config to opencode.json
  steps.push({
    name: "Write LSP config (luau-lsp)",
    fn: () => {
      const configPath = join(projectDir, "opencode.json")
      let config: Record<string, unknown> = {}
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"))
        } catch {
          // Corrupted config, start fresh
        }
      }

      config.lsp = {
        ...(config.lsp as Record<string, unknown> || {}),
        luau: {
          command: ["luau-lsp", "--stdio"],
          extensions: [".luau"],
        },
      }

      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
    },
  })

  // Step 5: Write core block to AGENTS.md
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const agentsPath = join(projectDir, "AGENTS.md")
      const corePath = join(pkgDir, "core", "roblox-core.md")
      const coreContent = readFileSync(corePath, "utf-8")

      const block = `${MARKER_BEGIN}\n${coreContent}\n${MARKER_END}`

      let agentsContent = ""
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8")
      }

      if (agentsContent.includes("<!-- roblox-opencode") || agentsContent.includes("<!-- roblox-pi")) {
        // Replace existing managed block
        const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/
        const endPattern = /<!-- roblox-opencode END -->/

        // Also handle old roblox-pi markers
        const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/
        const oldEndPattern = /<!-- roblox-pi END -->/

        let newContent = agentsContent

        if (beginPattern.test(newContent) && endPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
            block
          )
        } else if (oldBeginPattern.test(newContent) && oldEndPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
            block
          )
        } else {
          // Markers in content but regex didn't match — append
          newContent = newContent.trimEnd() + "\n\n" + block + "\n"
        }

        writeFileSync(agentsPath, newContent)
      } else {
        // No existing markers — create or append
        const content = agentsContent
          ? agentsContent.trimEnd() + "\n\n" + block + "\n"
          : block + "\n"
        writeFileSync(agentsPath, content)
      }
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

  return results
}

/**
 * Write MCP config to opencode.json. Called by /setup after checking prerequisites.
 */
export function writeMcpConfig(
  directory: string,
  servers: { studio?: boolean; robloxDocs?: boolean }
) {
  const configPath = join(directory, "opencode.json")
  let config: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"))
    } catch {
      // corrupted, start fresh
    }
  }

  const mcp: Record<string, unknown> = {}

  if (servers.studio) {
    mcp.studio = {
      type: "local",
      command: ["npx", "-y", "@anthropic/studio-mcp"],
      enabled: true,
    }
  }

  if (servers.robloxDocs) {
    mcp["roblox-docs"] = {
      type: "local",
      command: ["uvx", "mcp-roblox-docs"],
      enabled: true,
    }
  }

  config.mcp = { ...(config.mcp as Record<string, unknown> || {}), ...mcp }

  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n")
}

export default {
  id: "roblox-opencode",
  server: RobloxOpenCode,
}
