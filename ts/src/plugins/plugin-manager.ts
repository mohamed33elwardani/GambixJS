import type { GambixPluginContext, GambixPlugin } from "../types/types.ts";

/**
 * Registry that installs and tracks Gambix plugins.
 * Used by: Gambix internal wiring, plugin host setup.
 */
export default class PluginManager {
  private readonly plugins = new Map<string, GambixPlugin>();

  /**
   * Creates a plugin manager bound to a plugin context.
   * @param context - The shared context passed to installed plugins.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  public constructor(private readonly context: GambixPluginContext) {}

  /**
   * Installs a plugin and registers it by name.
   * @param plugin - The plugin to install.
   * @returns Nothing.
   * Used by: Gambix internal wiring, plugin host setup.
   */
  public use(plugin: GambixPlugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already installed.`);
    }

    plugin.install(this.context);
    this.plugins.set(plugin.name, plugin);
  }

  /**
   * Checks whether a plugin with the given name is installed.
   * @param name - The plugin name to look up.
   * @returns True when the plugin is registered.
   * Used by: Gambix internal wiring, plugin host setup.
   */
  public has(name: string): boolean {
    return this.plugins.has(name);
  }

  /**
   * Returns the installed plugin with the given name.
   * @param name - The plugin name to look up.
   * @returns The plugin, or undefined when not found.
   * Used by: Gambix internal wiring, plugin host setup.
   */
  public get(name: string): GambixPlugin | undefined {
    return this.plugins.get(name);
  }

  /**
   * Destroys installed plugins in reverse order and clears the registry.
   * @returns Nothing.
   * Used by: Gambix internal wiring, plugin host teardown.
   */
  public destroy(): void {
    try {
      for (const plugin of [...this.plugins.values()].reverse()) {
        try {
          plugin.destroy?.();
        } catch (err) {
          console.error("[Gambix] plugin destroy failed:", err);
        }
      }
    } finally {
      this.plugins.clear();
    }
  }
}
