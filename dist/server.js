// src/index.ts
import { tool } from "@opencode-ai/plugin";
import { fileURLToPath } from "node:url";
var VERSION = "1.0.1";
var MARKER_BEGIN = `<!-- roblox-opencode ${VERSION} BEGIN - managed block, edits inside will be overwritten -->`;
var MARKER_END = "<!-- roblox-opencode END -->";
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
        await runSetup(directory);
        mkdirSync(join(directory, ".opencode"), { recursive: true });
        writeFileSync(versionFile, VERSION + "\n");
      }
    }
  } catch {
  }
  return {
    tool: {
      roblox_setup: tool({
        description: "One-time project setup for roblox-opencode. Copies 17 skills and vendor libraries (rbxutil, profilestore, promise, testez, t, fusion) to the project, writes luau-lsp config to opencode.json, and writes the core Roblox agent instructions to AGENTS.md. Run this when first opening a Roblox project.",
        args: {},
        async execute(_args, context) {
          if (!context.directory) {
            return [{ step: "pre-check", status: "error", error: "No project directory. Open a project folder first." }];
          }
          return await runSetup(context.directory);
        }
      })
    }
  };
};
async function runSetup(directory) {
  const { existsSync, mkdirSync, readFileSync, writeFileSync, cpSync } = await import("fs");
  const { join } = await import("path");
  const pkgDir = join(import.meta.dirname ?? fileURLToPath(new URL(".", import.meta.url)), "..");
  const projectDir = directory;
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
          command: ["luau-lsp", "lsp"],
          extensions: [".luau"]
        }
      };
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
