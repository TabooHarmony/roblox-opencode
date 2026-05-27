// src/index.ts
import { tool } from "@opencode-ai/plugin";
import { fileURLToPath } from "node:url";
var VERSION = "1.0.6";
var MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN - managed block, edits inside will be overwritten -->`;
var MARKER_END = "<!-- roblox-opencode END -->";
var RECOMMENDED_MCPS = {
  "roblox-docs": {
    description: "Roblox API reference \u2014 queries class docs at runtime so the assistant doesn't guess at stale properties",
    command: ["uvx", "mcp-roblox-docs"],
    recommended: true
  },
  "web-search": {
    description: "DuckDuckGo web search + content fetch \u2014 find GUI assets, color palettes, DevForum solutions, code patterns",
    command: ["uvx", "duckduckgo-mcp-server"],
    recommended: true
  },
  "code-analysis": {
    description: "Tree-sitter code analysis \u2014 dependency graphs, file exploration, symbol search. Gives the assistant structural understanding of your project",
    command: ["uvx", "mcp-server-tree-sitter"],
    recommended: false
  }
};
var RobloxOpenCode = async (ctx) => {
  const { existsSync, mkdirSync, readdirSync, copyFileSync, readFileSync, writeFileSync } = await import("fs");
  const { join } = await import("path");
  const os = await import("os");
  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..");
  try {
    const srcDir = join(pkgDir, "commands");
    const destDir = join(os.homedir(), ".config", "opencode", "commands");
    if (existsSync(srcDir)) {
      mkdirSync(destDir, { recursive: true });
      const files = readdirSync(srcDir).filter((f) => f.endsWith(".md"));
      for (const file of files) {
        copyFileSync(join(srcDir, file), join(destDir, file));
      }
    }
  } catch {
  }
  try {
    const directory = ctx?.directory;
    if (directory) {
      const versionFile = join(directory, ".opencode", ".roblox-opencode-version");
      let installedVersion = "";
      if (existsSync(versionFile)) {
        installedVersion = readFileSync(versionFile, "utf-8").trim();
      }
      if (installedVersion !== VERSION && existsSync(join(directory, ".opencode", "skills"))) {
        let existingMcpNames = [];
        try {
          const configPath = join(directory, "opencode.json");
          if (existsSync(configPath)) {
            const config = JSON.parse(readFileSync(configPath, "utf-8"));
            existingMcpNames = Object.keys(config.mcp || {});
          }
        } catch {
        }
        await runSetup(directory, existingMcpNames);
        mkdirSync(join(directory, ".opencode"), { recursive: true });
        writeFileSync(versionFile, VERSION + "\n");
      }
    }
  } catch {
  }
  return {
    tool: {
      roblox_setup: tool({
        description: `One-time project setup for roblox-opencode. Copies skills and vendor libraries to the project, writes luau-lsp config, and writes core Roblox agent instructions to AGENTS.md. Run this when first opening a Roblox project.

When called WITHOUT mcpServers: detects environment (uvx availability, existing MCPs) and returns recommended MCP servers. Present these to the user and ask which they want installed. Then call again WITH their selection.

When called WITH mcpServers: runs full setup with the selected MCP servers. Pass an array of MCP names (e.g. ["roblox-docs", "web-search"]) or an empty array to skip MCP installation.`,
        args: {
          mcpServers: tool.schema.array(tool.schema.string()).optional().describe("Array of MCP server names to install. Omit to detect environment and return recommendations. Pass [] to skip MCP installation entirely.")
        },
        async execute(args, context) {
          if (!context.directory) {
            return [{ step: "pre-check", status: "error", error: "No project directory. Open a project folder first." }];
          }
          return await runSetup(context.directory, args.mcpServers);
        }
      })
    }
  };
};
async function runSetup(directory, mcpServers) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } = await import("fs");
  const { join } = await import("path");
  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..");
  const projectDir = directory;
  let uvxFound = false;
  try {
    const { execSync } = await import("child_process");
    execSync("command -v uvx", { stdio: "ignore" });
    uvxFound = true;
  } catch {
  }
  const configPath = join(projectDir, "opencode.json");
  let existingMcps = [];
  if (existsSync(configPath)) {
    try {
      const config = JSON.parse(readFileSync(configPath, "utf-8"));
      existingMcps = Object.keys(config.mcp || {});
    } catch {
    }
  }
  if (mcpServers === void 0) {
    const recommendations = Object.entries(RECOMMENDED_MCPS).map(([name, mcp]) => ({
      name,
      description: mcp.description,
      recommended: mcp.recommended,
      alreadyInstalled: existingMcps.includes(name)
    }));
    return {
      phase: "detect",
      uvxAvailable: uvxFound,
      existingMcps,
      recommendations: uvxFound ? recommendations : recommendations.map((r) => ({ ...r, available: false, reason: "uvx not found" })),
      message: uvxFound ? "MCP servers require uvx (detected). Review the recommendations and call roblox_setup again with your selection." : "uvx not found \u2014 MCP servers require uvx (pip install uvx). You can still run setup without MCPs by passing mcpServers: []."
    };
  }
  const steps = [];
  steps.push({
    name: "Copy 17 skills to .opencode/skills/",
    fn: () => {
      const src = join(pkgDir, "skills");
      const dest = join(projectDir, ".opencode", "skills");
      if (!existsSync(src)) throw new Error(`skills/ not found in plugin at ${src}`);
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true, force: true });
    }
  });
  steps.push({
    name: "Copy vendor libraries to project",
    fn: () => {
      const src = join(pkgDir, "vendor");
      const dest = join(projectDir, ".opencode", "vendor");
      if (!existsSync(src)) throw new Error(`vendor/ not found in plugin at ${src}`);
      mkdirSync(dest, { recursive: true });
      cpSync(src, dest, { recursive: true, force: true });
    }
  });
  steps.push({
    name: "Write LSP config (luau-lsp) + MCP servers",
    fn: () => {
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
          command: ["luau-lsp", "lsp"],
          extensions: [".luau"]
        }
      };
      if (mcpServers.length > 0 && uvxFound) {
        const mcp = config.mcp || {};
        for (const name of mcpServers) {
          const def = RECOMMENDED_MCPS[name];
          if (def) {
            mcp[name] = {
              type: "local",
              command: def.command,
              enabled: true
            };
          }
        }
        config.mcp = mcp;
      }
      writeFileSync(configPath, JSON.stringify(config, null, 2) + "\n");
    }
  });
  steps.push({
    name: "Write .luaurc (vendor path aliases)",
    fn: () => {
      const luaurcPath = join(projectDir, ".luaurc");
      let luaurc = {};
      if (existsSync(luaurcPath)) {
        try {
          luaurc = JSON.parse(readFileSync(luaurcPath, "utf-8"));
        } catch {
        }
      }
      const aliases = luaurc.aliases || {};
      aliases["Packages"] = ".opencode/vendor/rbxutil";
      aliases["Fusion"] = ".opencode/vendor/fusion";
      aliases["ProfileStore"] = ".opencode/vendor/profilestore";
      aliases["Promise"] = ".opencode/vendor/promise";
      aliases["TestEZ"] = ".opencode/vendor/testez";
      aliases["t"] = ".opencode/vendor/t";
      luaurc.aliases = aliases;
      luaurc.languageMode = luaurc.languageMode || "nonstrict";
      writeFileSync(luaurcPath, JSON.stringify(luaurc, null, 2) + "\n");
    }
  });
  steps.push({
    name: "Write core block to AGENTS.md",
    fn: () => {
      const agentsPath = join(projectDir, "AGENTS.md");
      const corePath = join(pkgDir, "core", "roblox-core.md");
      if (!existsSync(corePath)) throw new Error(`core/roblox-core.md not found in plugin at ${corePath}`);
      const coreContent = readFileSync(corePath, "utf-8");
      const block = `${MARKER_BEGIN}
${coreContent}
${MARKER_END}`;
      let agentsContent = "";
      if (existsSync(agentsPath)) {
        agentsContent = readFileSync(agentsPath, "utf-8");
      }
      const beginPattern = /<!-- roblox-opencode[^>]*BEGIN[^>]*-->/;
      const endPattern = /<!-- roblox-opencode END -->/;
      const oldBeginPattern = /<!-- roblox-pi[^>]*BEGIN[^>]*-->/;
      const oldEndPattern = /<!-- roblox-pi END -->/;
      let newContent;
      if (beginPattern.test(agentsContent) && endPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${beginPattern.source}[\\s\\S]*?${endPattern.source}`),
          block
        );
      } else if (oldBeginPattern.test(agentsContent) && oldEndPattern.test(agentsContent)) {
        newContent = agentsContent.replace(
          new RegExp(`${oldBeginPattern.source}[\\s\\S]*?${oldEndPattern.source}`),
          block
        );
      } else {
        newContent = agentsContent ? agentsContent.trimEnd() + "\n\n" + block + "\n" : block + "\n";
      }
      writeFileSync(agentsPath, newContent);
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
  try {
    const versionFile = join(projectDir, ".opencode", ".roblox-opencode-version");
    mkdirSync(join(projectDir, ".opencode"), { recursive: true });
    writeFileSync(versionFile, VERSION + "\n");
  } catch {
  }
  return results;
}
var index_default = {
  id: "roblox-opencode",
  server: RobloxOpenCode
};
export {
  RobloxOpenCode,
  index_default as default,
  runSetup
};
