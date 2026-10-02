/**
 * Suite covering PluginManager install, lookup, and destroy behavior.
 */
import { describe, expect, it, vi } from "vitest";
import PluginManager from "../../ts/src/plugins/plugin-manager.ts";
import EventBus from "../../ts/src/events/event-bus.ts";
import type {
  ChessEvents,
  GambixPlugin,
  GambixPluginContext,
} from "../../ts/src/types/types.ts";

/**
 * Builds a minimal plugin context with a fresh event bus.
 * @returns A new plugin context for tests.
 * Used by: PluginManager test cases.
 */
function makeContext(): GambixPluginContext {
  return {
    root: document.createElement("div"),
    eventBus: new EventBus<ChessEvents>(),
    board: {} as GambixPluginContext["board"],
  };
}

/**
 * Builds a mock plugin with spied install and destroy hooks.
 * @param name - The plugin name to assign.
 * @returns A mock plugin instance.
 * Used by: PluginManager test cases.
 */
function makePlugin(name: string): GambixPlugin & {
  install: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
} {
  return {
    name,
    install: vi.fn(),
    destroy: vi.fn(),
  };
}

/** Covers plugin installation, duplicate rejection, and lookup. */
describe("PluginManager.use", () => {
  it("installs a plugin with the context and tracks it", () => {
    const ctx = makeContext();
    const manager = new PluginManager(ctx);
    const plugin = makePlugin("alpha");

    manager.use(plugin);

    expect(plugin.install).toHaveBeenCalledTimes(1);
    expect(plugin.install).toHaveBeenCalledWith(ctx);
    expect(manager.has("alpha")).toBe(true);
    expect(manager.get("alpha")).toBe(plugin);
  });

  it("throws when installing a duplicate name", () => {
    const manager = new PluginManager(makeContext());
    manager.use(makePlugin("dup"));
    expect(() => manager.use(makePlugin("dup"))).toThrow(
      "Plugin 'dup' is already installed.",
    );
  });

  it("has/get return false/undefined for unknown plugins", () => {
    const manager = new PluginManager(makeContext());
    expect(manager.has("missing")).toBe(false);
    expect(manager.get("missing")).toBeUndefined();
  });
});

/** Covers reverse-order teardown and registry clearing. */
describe("PluginManager.destroy", () => {
  it("destroys in reverse install order and clears the registry", () => {
    const manager = new PluginManager(makeContext());
    const order: string[] = [];
    const first = makePlugin("first");
    const second = makePlugin("second");
    first.destroy.mockImplementation(() => order.push("first"));
    second.destroy.mockImplementation(() => order.push("second"));

    manager.use(first);
    manager.use(second);
    manager.destroy();

    expect(order).toEqual(["second", "first"]);
    expect(manager.has("first")).toBe(false);
    expect(manager.has("second")).toBe(false);
  });

  it("tolerates plugins without a destroy hook", () => {
    const manager = new PluginManager(makeContext());
    const plugin: GambixPlugin = { name: "plain", install: vi.fn() };
    manager.use(plugin);
    expect(() => manager.destroy()).not.toThrow();
    expect(manager.has("plain")).toBe(false);
  });
});
