/**
 * luau-check — Internal Pi extension for Roblox/Luau diagnostics.
 *
 * Hooks write/edit events for .luau files, runs luau-lsp analyze,
 * injects diagnostics into the next turn's context.
 *
 * TODO: Implement. Phase 0 spike validates the mechanism.
 * - Hook pi's write/edit events for .luau files
 * - Spawn `luau-lsp analyze --definitions globalTypes.d.luau <file>`
 * - Parse JSON diagnostics output
 * - Inject into next turn context (fire-and-forget, non-blocking)
 */

export default {
  name: "luau-check",
  description: "Luau diagnostics on write/edit via luau-lsp",
};
