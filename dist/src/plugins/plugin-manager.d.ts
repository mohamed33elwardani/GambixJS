import type { GambixPluginContext, GambixPlugin } from "../types/types.ts";
/**
 * Registry that installs and tracks Gambix plugins.
 * Used by: Gambix internal wiring, plugin host setup.
 */
export default class PluginManager {
    private readonly context;
    private readonly plugins;
    /**
     * Creates a plugin manager bound to a plugin context.
     * @param context - The shared context passed to installed plugins.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    constructor(context: GambixPluginContext);
    /**
     * Installs a plugin and registers it by name.
     * @param plugin - The plugin to install.
     * @returns Nothing.
     * Used by: Gambix internal wiring, plugin host setup.
     */
    use(plugin: GambixPlugin): void;
    /**
     * Checks whether a plugin with the given name is installed.
     * @param name - The plugin name to look up.
     * @returns True when the plugin is registered.
     * Used by: Gambix internal wiring, plugin host setup.
     */
    has(name: string): boolean;
    /**
     * Returns the installed plugin with the given name.
     * @param name - The plugin name to look up.
     * @returns The plugin, or undefined when not found.
     * Used by: Gambix internal wiring, plugin host setup.
     */
    get(name: string): GambixPlugin | undefined;
    /**
     * Destroys installed plugins in reverse order and clears the registry.
     * @returns Nothing.
     * Used by: Gambix internal wiring, plugin host teardown.
     */
    destroy(): void;
}
