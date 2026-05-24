// src/index.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs";
import { join, dirname } from "path";
var VERSION = "1.0.0";
var MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN \u2014 managed block, edits inside will be overwritten -->`;
var MARKER_END = "<!-- roblox-opencode END -->";
var RobloxOpenCode = async ({ directory, client }) => {
  const projectDir = directory;
  const pkgDir = dirname(dirname(new URL(import.meta.url).pathname));
  const agentsPath = join(projectDir, "AGENTS.md");
  let isRobloxProject = false;
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    if (content.includes("<!-- roblox-opencode") || content.includes("<!-- roblox-pi")) {
      isRobloxProject = true;
    }
  }
  if (!isRobloxProject) {
    try {
      const { readdirSync } = await import("fs");
      const hasLuau = (dir, depth) => {
        if (depth > 2) return false;
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          if (entry.name.startsWith(".")) continue;
          const full = join(dir, entry.name);
          if (entry.isFile() && entry.name.endsWith(".luau")) return true;
          if (entry.isDirectory() && hasLuau(full, depth + 1)) return true;
        }
        return false;
      };
      isRobloxProject = hasLuau(projectDir, 0);
    } catch {
    }
  }
  if (!isRobloxProject) return {};
  client.app.log.info(`roblox-opencode v${VERSION} loaded`);
  const skillsDir = join(projectDir, ".opencode", "skills");
  const commandsDir = join(projectDir, ".opencode", "commands");
  if (!existsSync(skillsDir)) {
    try {
      mkdirSync(skillsDir, { recursive: true });
      cpSync(join(pkgDir, "skills"), skillsDir, { recursive: true });
      client.app.log.info("roblox-opencode: skills copied to .opencode/skills/");
    } catch (e) {
      client.app.log.warn(`roblox-opencode: failed to copy skills: ${e}`);
    }
  }
  if (!existsSync(commandsDir)) {
    try {
      mkdirSync(commandsDir, { recursive: true });
      cpSync(join(pkgDir, "commands"), commandsDir, { recursive: true });
      client.app.log.info("roblox-opencode: commands copied to .opencode/commands/");
    } catch (e) {
      client.app.log.warn(`roblox-opencode: failed to copy commands: ${e}`);
    }
  }
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    const hasCurrentMarkers = content.includes(MARKER_BEGIN);
    const hasOldMarkers = content.includes("<!-- roblox-opencode") && !hasCurrentMarkers;
    if (hasOldMarkers) {
      client.app.log.warn("roblox-opencode AGENTS.md markers are outdated. Run /setup to update.");
    }
  }
  return {};
};
async function runSetup(directory) {
  const pkgDir = dirname(new URL(import.meta.url).pathname.replace("/src", ""));
  const projectDir = directory;
  const steps = [];
  steps.push({
    name: "Copy skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills");
      const dest = join(projectDir, ".opencode", "skills");
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  });
  steps.push({
    name: "Copy commands to .opencode/commands/",
    fn: () => {
      const src = join(pkgDir, "commands");
      const dest = join(projectDir, ".opencode", "commands");
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  });
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor");
      const dest = join(projectDir, "vendor");
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true });
    }
  });
  steps.push({
    name: "Write LSP config (luau-lsp)",
    fn: () => {
      const configPath = join(projectDir, "opencode.json");
      let config = {};
      if (existsSync(configPath)) {
        try {
          config = JSON.parse(readFileSync(configPath, "utf-8"));
        } catch {
        }
      }
      config.lsp = {
        ...config.lsp || {},
        luau: {
          command: ["luau-lsp", "--stdio"],
          extensions: [".luau"]
        }
      };
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  });
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const agentsPath = join(projectDir, "AGENTS.md");
      const corePath = join(pkgDir, "core", "roblox-core.md");
      const coreContent = readFileSync(corePath, "utf-8");
      const block = `${MARKER_BEGIN}
${coreContent}
${MARKER_END}`;
      let agentsContent = "";
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8");
      }
      if (agentsContent.includes("<!-- roblox-opencode") || agentsContent.includes("<!-- roblox-pi")) {
        const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/;
        const endPattern = /<!-- roblox-opencode END -->/;
        const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/;
        const oldEndPattern = /<!-- roblox-pi END -->/;
        let newContent = agentsContent;
        if (beginPattern.test(newContent) && endPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
            block
          );
        } else if (oldBeginPattern.test(newContent) && oldEndPattern.test(newContent)) {
          newContent = newContent.replace(
            new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
            block
          );
        } else {
          newContent = newContent.trimEnd() + "\n\n" + block + "\n";
        }
        writeFileSync(agentsPath, newContent);
      } else {
        const content = agentsContent ? agentsContent.trimEnd() + "\n\n" + block + "\n" : block + "\n";
        writeFileSync(agentsPath, content);
      }
    }
  });
  const results = [];
  for (const step of steps) {
    try {
      step.fn();
      results.push({ step: step.name, status: "ok" });
    } catch (err) {
      results.push({
        step: step.name,
        status: "error",
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  return results;
}
function writeMcpConfig(directory, servers) {
  const configPath = join(directory, "opencode.json");
  let config = {};
  if (existsSync(configPath)) {
    try {
      config = JSON.parse(readFileSync(configPath, "utf-8"));
    } catch {
    }
  }
  const mcp = {};
  if (servers.studio) {
    mcp.studio = {
      type: "local",
      command: ["npx", "-y", "@anthropic/studio-mcp"],
      enabled: true
    };
  }
  if (servers.robloxDocs) {
    mcp["roblox-docs"] = {
      type: "local",
      command: ["uvx", "mcp-roblox-docs"],
      enabled: true
    };
  }
  config.mcp = { ...config.mcp || {}, ...mcp };
  writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
}
var index_default = {
  id: "roblox-opencode",
  server: RobloxOpenCode
};
export {
  RobloxOpenCode,
  index_default as default,
  runSetup,
  writeMcpConfig
};
