import type {
  BoardAnimationOptions,
  DrawingConfig,
  HighlightsConfig,
  InteractionConfig,
  ThemeConfig,
} from "../types/types.ts";

/**
 * Classic chess starting-position FEN string.
 * Used by: DEFAULT_CONFIG, Gambix constructor, fen tests.
 */
export const STANDARD_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

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
export const DEFAULT_CONFIG: DefaultConfig = {
  fen: STANDARD_FEN,

  theme: {
    orientation: "white",
    boardType: "customizable",

    boardSize: 600,
    autoResize: true,

    squares: {
      type: "color",
      light: "#ebecd0",
      dark: "#739552",
    },

    coord: {
      show: true,
      placement: "inside",
      light: "#739552",
      dark: "#ebecd0",
    },

    pieces: {
      type: "images",
      assets: {
        white: {
          pawn: "https://lichess1.org/assets/piece/cburnett/wP.svg",
          rook: "https://lichess1.org/assets/piece/cburnett/wR.svg",
          knight: "https://lichess1.org/assets/piece/cburnett/wN.svg",
          bishop: "https://lichess1.org/assets/piece/cburnett/wB.svg",
          queen: "https://lichess1.org/assets/piece/cburnett/wQ.svg",
          king: "https://lichess1.org/assets/piece/cburnett/wK.svg",
        },
        black: {
          pawn: "https://lichess1.org/assets/piece/cburnett/bP.svg",
          rook: "https://lichess1.org/assets/piece/cburnett/bR.svg",
          knight: "https://lichess1.org/assets/piece/cburnett/bN.svg",
          bishop: "https://lichess1.org/assets/piece/cburnett/bB.svg",
          queen: "https://lichess1.org/assets/piece/cburnett/bQ.svg",
          king: "https://lichess1.org/assets/piece/cburnett/bK.svg",
        },
      },
    },
  },

  interaction: {
    control: "both",
    moveMechanic: "both",
  },

  drawing: {
    enabled: true,
    buttons: [
      { button: "mainColor", color: "rgba(255, 170, 0, 0.8)", lineWidth: 2.5 },
      { button: "Control", color: "rgba(248, 85, 63, 0.8)", lineWidth: 2.5 },
      { button: "Shift", color: "rgba(72, 193, 249, 0.8)", lineWidth: 2.5 },
      { button: "Alt", color: "rgba(159, 207, 63, 0.8)", lineWidth: 2.5 },
    ],
  },

  highlights: {
    enabled: true,

    lastMove: { enable: true, type: "color", color: "rgba(255, 255, 51, 0.5)" },

    selectedPiece: {
      enable: true,
      type: "color",
      color: "rgba(0, 255, 64, 0.5)",
    },

    inCheck: { enable: true, type: "blink", color: "rgba(255, 0, 0, 1)" },

    checkmate: {
      winner: { enable: true, type: "blink", color: "rgba(0, 206, 0, 0.81)" },
      loser: { enable: true, type: "blink", color: "rgba(204, 0, 0, 0.81)" },
    },

    legalMoves: {
      enable: true,
      color: "rgba(0, 0, 0, 0.15)",
      dotSize: 20,
      ringSize: 4,
    },

    rightClick: [
      { button: "mainColor", color: "rgba(248, 85, 63, 0.8)" },
      { button: "Control", color: "rgba(255, 170, 0, 0.8)" },
      { button: "Shift", color: "rgba(72, 193, 249, 0.8)" },
      { button: "Alt", color: "rgba(159, 207, 63, 0.8)" },
    ],
  },

  animations: {
    enabled: true,

    move: { duration: 800, easing: "ease-in-out" },
    capture: { duration: 280, easing: "ease-in-out" },
    spawn: { duration: 120, easing: "ease-in" },
    snapback: { duration: 150, easing: "ease-out" },

    autoSpeed: true,
  },
};
