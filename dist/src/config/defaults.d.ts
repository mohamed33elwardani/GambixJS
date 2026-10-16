import type { BoardAnimationOptions, DrawingConfig, HighlightsConfig, InteractionConfig, ThemeConfig } from "../types/types.ts";
/**
 * Classic chess starting-position FEN string.
 * Used by: DEFAULT_CONFIG, Gambix constructor, fen tests.
 */
export declare const STANDARD_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
/**
 * Full default configuration shape for theme, interaction and display.
 * Used by: DEFAULT_CONFIG, Gambix constructor options merging.
 */
export interface DefaultConfig {
    fen: string;
    theme: ThemeConfig;
    interaction: InteractionConfig;
    drawing: DrawingConfig;
    highlights: HighlightsConfig;
    animations: BoardAnimationOptions;
}
/**
 * Built-in default board, interaction, drawing and animation settings.
 * Used by: Gambix constructor, PromotionManager assets, tests/helpers.
 */
export declare const DEFAULT_CONFIG: DefaultConfig;
