// src/index.ts
import { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } from "fs";
import { join, dirname } from "path";
var VERSION = "1.0.0";
var MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN \u2014 managed block, edits inside will be overwritten -->`;
var MARKER_END = "<!-- roblox-opencode END -->";
var RobloxOpenCode = async ({ directory, client }) => {
  const pkgDir = dirname(new URL(import.meta.url).pathname.replace("/src", ""));
  const projectDir = directory;
  client.app.log.info(`roblox-opencode v${VERSION} loaded`);
  const agentsPath = join(projectDir, "AGENTS.md");
  if (existsSync(agentsPath)) {
    const content = readFileSync(agentsPath, "utf-8");
    const hasCurrentMarkers = content.includes(MARKER_BEGIN);
    const hasOldMarkers = content.includes("<!-- roblox-opencode") && !hasCurrentMarkers;
    if (hasOldMarkers) {
      client.app.log.warn("roblox-opencode AGENTS.md markers are outdated. Run /setup to update.");
    } else if (!hasCurrentMarkers && !content.includes("<!-- roblox-pi")) {
      client.app.log.info("roblox-opencode not configured yet. Run /setup to initialize.");
    }
  } else {
    client.app.log.info("No AGENTS.md found. Run /setup to initialize roblox-opencode.");
  }
  return {
    "session.created": async () => {
      const skillsDir = join(projectDir, ".opencode", "skills");
      if (!existsSync(skillsDir)) {
        client.app.log.info("roblox-opencode skills not installed. Run /setup to initialize.");
      }
    }
  };
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
