/**
 * Tests for the built-in starting FEN and default board configuration.
 */
import { describe, expect, it } from "vitest";
import {
  DEFAULT_CONFIG,
  STANDARD_FEN,
} from "../../ts/src/config/defaults.ts";

// Covers the classic starting-position FEN constant value.
describe("STANDARD_FEN", () => {
  it("is the classic starting position", () => {
    expect(STANDARD_FEN).toBe(
      "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
    );
  });
});

// Covers default theme, interaction, drawing, highlight and animation values.
describe("DEFAULT_CONFIG", () => {
  it("uses the standard FEN", () => {
    expect(DEFAULT_CONFIG.fen).toBe(STANDARD_FEN);
  });

  it("defines a white-oriented 600px board", () => {
    expect(DEFAULT_CONFIG.theme.orientation).toBe("white");
    expect(DEFAULT_CONFIG.theme.boardSize).toBe(600);
    expect(DEFAULT_CONFIG.theme.boardType).toBe("customizable");
    expect(DEFAULT_CONFIG.theme.autoResize).toBe(true);
  });

  it("defines square, coord and piece themes", () => {
    expect(DEFAULT_CONFIG.theme.squares.type).toBe("color");
    expect(DEFAULT_CONFIG.theme.coord.show).toBe(true);
    expect(DEFAULT_CONFIG.theme.pieces.type).toBe("images");
    expect(DEFAULT_CONFIG.theme.pieces.assets.white.pawn).toContain("wP.svg");
    expect(DEFAULT_CONFIG.theme.pieces.assets.black.king).toContain("bK.svg");
  });

  it("enables both-sides interaction with both mechanics", () => {
    expect(DEFAULT_CONFIG.interaction.control).toBe("both");
    expect(DEFAULT_CONFIG.interaction.moveMechanic).toBe("both");
  });

  it("enables drawing with four modifier buttons", () => {
    expect(DEFAULT_CONFIG.drawing.enabled).toBe(true);
    expect(DEFAULT_CONFIG.drawing.buttons).toHaveLength(4);
    expect(
      DEFAULT_CONFIG.drawing.buttons.map((b) => b.button),
    ).toEqual(["mainColor", "Control", "Shift", "Alt"]);
  });

  it("enables highlight categories with legal-move sizing", () => {
    expect(DEFAULT_CONFIG.highlights.enabled).toBe(true);
    expect(DEFAULT_CONFIG.highlights.lastMove.enable).toBe(true);
    expect(DEFAULT_CONFIG.highlights.legalMoves.enable).toBe(true);
    expect(DEFAULT_CONFIG.highlights.rightClick.length).toBeGreaterThan(0);
  });

  it("enables animations with per-category durations", () => {
    expect(DEFAULT_CONFIG.animations.enabled).toBe(true);
    expect(DEFAULT_CONFIG.animations.move.duration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.animations.capture.duration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.animations.spawn.duration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.animations.snapback.duration).toBeGreaterThan(0);
    expect(DEFAULT_CONFIG.animations.autoSpeed).toBe(true);
  });
});
