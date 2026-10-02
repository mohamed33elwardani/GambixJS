// Suite covering Highlights selection, toggles, game marks, legal moves and scaling.
import { afterEach, describe, expect, it, vi } from "vitest";
import Highlights from "../../ts/src/ui/highlights.ts";
import { DEFAULT_CONFIG } from "../../ts/src/config/defaults.ts";
import { deepMerge } from "../../ts/src/utils/object.ts";
import type {
  HighlightsConfig,
} from "../../ts/src/types/types.ts";
import { makeBoard, type BoardFixture } from "../helpers.ts";

interface HighlightsFixture extends BoardFixture {
  config: HighlightsConfig;
  highlights: Highlights;
}

let current: HighlightsFixture | null = null;

// setup(): builds a fresh Highlights fixture; params: optional config patch; returns: board fixture plus config and highlights.
function setup(configPatch?: Partial<HighlightsConfig>): HighlightsFixture {
  const base = makeBoard();
  const config = deepMerge(
    structuredClone(DEFAULT_CONFIG.highlights),
    configPatch ?? {},
  );
  const highlights = new Highlights(
    base.bus,
    config,
    base.root,
    () => base.theme.boardSize,
  );
  current = { ...base, config, highlights };
  return current;
}

afterEach(() => {
  current?.highlights.destroy();
  current?.board.destroy();
  current = null;
  vi.restoreAllMocks();
});

// Covers selected-square tracking and selection events.
describe("Highlights selection", () => {
  it("highlightSelectedSquare tracks squares with pieces", () => {
    const { highlights, root } = setup();
    expect(highlights.getHighlights()).toEqual([]);
    highlights.highlightSelectedSquare("e2");
    expect(
      root
        .querySelector('.square[data-square="e2"]')
        ?.classList.contains("highlight-selected-square"),
    ).toBe(true);
    expect(highlights.getHighlights()).toEqual([
      { square: "e2", kind: "selected" },
    ]);
  });

  it("highlightSelectedSquare ignores empty squares", () => {
    const { highlights } = setup();
    highlights.highlightSelectedSquare("e4");
    expect(highlights.getHighlights()).toEqual([]);
  });

  it("square-selected event auto-selects and move-requested clears", () => {
    const { highlights, bus, root } = setup();
    bus.emit("interaction:square-selected", { square: "e2" });
    expect(
      root
        .querySelector('.square[data-square="e2"]')
        ?.classList.contains("highlight-selected-square"),
    ).toBe(true);
    bus.emit("interaction:move-requested", { from: "e2", to: "e4" });
    expect(highlights.getHighlights()).toEqual([]);
  });
});

// Covers user toggling, persistence and clear behavior.
describe("Highlights user toggle", () => {
  it("highlightSquare toggles on and off with events", () => {
    const { highlights, bus } = setup();
    const toggles: Array<{ square: string; active: boolean }> = [];
    bus.on("drawing:highlight-toggled", (p) => toggles.push(p));

    highlights.highlightSquare("e4");
    expect(toggles).toHaveLength(1);
    expect(toggles[0]).toMatchObject({ square: "e4", active: true });
    expect(highlights.getHighlights()).toEqual([
      { square: "e4", kind: "user", color: highlights.activeColor },
    ]);

    highlights.highlightSquare("e4");
    expect(toggles[1]).toMatchObject({ square: "e4", active: false });
    expect(highlights.getHighlights()).toEqual([]);
  });

  it("does nothing when disabled unless persistent", () => {
    const { highlights } = setup();
    highlights.setEnabledState(false);
    expect(highlights.isEnabledState()).toBe(false);
    highlights.highlightSquare("e4");
    expect(highlights.getHighlights()).toEqual([]);
    highlights.highlightSquarePersistent("e4");
    expect(highlights.getHighlights()).toHaveLength(1);
    highlights.setEnabledState(true);
  });

  it("highlight-square event is honored only when enabled", () => {
    const { highlights, bus } = setup();
    bus.emit("interaction:highlight-square", "d4");
    expect(highlights.getHighlights()).toHaveLength(1);
    highlights.setEnabledState(false);
    bus.emit("interaction:highlight-square", "e4");
    expect(highlights.getHighlights()).toHaveLength(1);
  });

  it("persistent highlights survive clearHighlights but not clearHighlightsAll", () => {
    const { highlights } = setup();
    highlights.highlightSquarePersistent("d4");
    highlights.highlightSquare("e4");
    expect(highlights.getHighlights()).toHaveLength(2);
    highlights.clearHighlights();
    expect(highlights.getHighlights()).toEqual([
      { square: "d4", kind: "locked", color: highlights.activeColor },
    ]);
    highlights.clearHighlightsAll();
    expect(highlights.getHighlights()).toEqual([]);
  });

  it("highlightSquarePersistent accepts an explicit color", () => {
    const { highlights } = setup();
    highlights.highlightSquarePersistent("d4", "rgb(1, 2, 3)");
    expect(highlights.getHighlights()).toEqual([
      { square: "d4", kind: "locked", color: "rgb(1, 2, 3)" },
    ]);
    // active color is restored afterwards
    expect(highlights.activeColor).toBe(highlights.mainColor);
  });

  it("removeHighlightSquare clears and emits", () => {
    const { highlights, bus } = setup();
    const toggles: Array<{ square: string; active: boolean }> = [];
    bus.on("drawing:highlight-toggled", (p) => toggles.push(p));
    highlights.highlightSquarePersistent("d4");
    highlights.removeHighlightSquare("d4");
    expect(highlights.getHighlights()).toEqual([]);
    expect(toggles.at(-1)).toMatchObject({ square: "d4", active: false });
  });

  it("clear-draw clears manual highlights and emits highlights-cleared", () => {
    const { highlights, bus } = setup();
    const cleared: unknown[] = [];
    bus.on("drawing:highlights-cleared", (p) => cleared.push(p));
    highlights.highlightSquare("e4");
    bus.emit("interaction:clear-draw", {});
    expect(highlights.getHighlights()).toEqual([]);
    expect(cleared).toHaveLength(1);
  });
});

// Covers last-move, check and checkmate highlights.
describe("Highlights last move / check / checkmate", () => {
  it("setLastMove / getLastMove / clearLastMove", () => {
    const { highlights, root } = setup();
    highlights.setLastMove("e2", "e4");
    expect(highlights.getLastMove()).toEqual({ from: "e2", to: "e4" });
    expect(
      root
        .querySelector('.square[data-square="e2"]')
        ?.classList.contains("highlight-lastmove-start"),
    ).toBe(true);
    expect(
      root
        .querySelector('.square[data-square="e4"]')
        ?.classList.contains("highlight-lastmove-end"),
    ).toBe(true);
    highlights.clearLastMove();
    expect(highlights.getLastMove()).toBeNull();
    expect(highlights.getHighlights()).toEqual([]);
  });

  it("setLastMove is a no-op when disabled in config", () => {
    const { highlights } = setup({
      lastMove: { enable: false, type: "color", color: "red" },
    });
    highlights.setLastMove("e2", "e4");
    expect(highlights.getLastMove()).toBeNull();
  });

  it("setCheck / clearCheck / getCheck", () => {
    const { highlights, root } = setup();
    highlights.setCheck("e8");
    expect(highlights.getCheck()).toBe("e8");
    expect(
      root
        .querySelector('.square[data-square="e8"]')
        ?.classList.contains("highlight-check"),
    ).toBe(true);
    highlights.clearCheck();
    expect(highlights.getCheck()).toBeNull();
    highlights.setCheck(null);
    expect(highlights.getCheck()).toBeNull();
  });

  it("setCheck respects the inCheck enable flag", () => {
    const { highlights } = setup({
      inCheck: { enable: false, type: "color", color: "red" },
    });
    highlights.setCheck("e8");
    expect(highlights.getCheck()).toBeNull();
  });

  it("setCheckmate / clearCheckmate track winner and loser", () => {
    const { highlights } = setup();
    highlights.setCheckmate("d8", "e8");
    const kinds = highlights.getHighlights().map((h) => h.kind).sort();
    expect(kinds).toEqual(["checkmate-loser", "checkmate-winner"]);
    highlights.clearCheckmate();
    expect(highlights.getHighlights()).toEqual([]);
    highlights.setCheckmate(null, null);
    expect(highlights.getHighlights()).toEqual([]);
  });
});

// Covers legal-move dots versus rings for empty and occupied squares.
describe("Highlights legal moves", () => {
// Verifies dot versus ring choice relies on the e2 pawn still occupying e2.
  it("uses dots for empty squares and rings for occupied ones", () => {
    const { highlights, root } = setup();
    highlights.setLegalMoves(["e3", "e4", "d5"]);
    const classes = (sq: string) =>
      root.querySelector(`.square[data-square="${sq}"]`)?.className ?? "";
    // e2 pawn was not moved in this fixture, so e3/e4 empty -> dots
    expect(classes("e3")).toContain("highlight-legalmove-dot");
    expect(classes("e4")).toContain("highlight-legalmove-dot");
    highlights.setLegalMoves(["e2"]);
    expect(classes("e2")).toContain("highlight-legalmove-ring");
    expect(
      highlights.getHighlights().find((h) => h.square === "e2")?.kind,
    ).toBe("legal-ring");
    highlights.clearLegalMoves();
    expect(classes("e2")).not.toContain("highlight-legalmove-ring");
    expect(highlights.getHighlights()).toEqual([]);
  });

  it("skips invalid squares and honors the enable flag", () => {
    const { highlights } = setup({
      legalMoves: { enable: false, color: "red", dotSize: 20, ringSize: 4 },
    });
    highlights.setLegalMoves(["e4", "zzz"]);
    expect(highlights.getHighlights()).toEqual([]);
  });
});

// Covers scaling, CSS variables and key-based color switching.
describe("Highlights scaling and keys", () => {
  it("setLegalMoveRatios clamps and persists ratios", () => {
    const { highlights, config } = setup();
    highlights.setLegalMoveRatios(99, 99);
    expect(config.legalMoves.dotSize).toBe(0.45);
    expect(config.legalMoves.ringSize).toBe(0.2);
    highlights.setLegalMoveRatios(0.2, 0.05);
    expect(config.legalMoves.dotSize).toBeCloseTo(0.2);
  });

  it("updateScale refreshes CSS variables without throwing", () => {
    const { highlights, root } = setup();
    expect(() =>
      highlights.updateScale(400),
    ).not.toThrow();
    expect(
      root.style.getPropertyValue("--highlight-legalmove-dot-size"),
    ).not.toBe("");
  });

  it("key-pressed swaps the highlight color, key-up restores it", () => {
    const { highlights, bus, root } = setup();
    const main = root.style.getPropertyValue("--highlight-color");
    bus.emit("interaction:key-pressed", "Shift");
    expect(root.style.getPropertyValue("--highlight-color")).toBe(
      "rgba(72, 193, 249, 0.8)",
    );
    bus.emit("interaction:key-up", "");
    expect(root.style.getPropertyValue("--highlight-color")).toBe(main);
  });

  it("refreshFromConfig rebuilds key bindings", () => {
    const { highlights, bus } = setup();
    highlights.highlightsConfig.rightClick.push({
      button: "Meta",
      color: "pink",
    });
    highlights.refreshFromConfig();
    bus.emit("interaction:key-pressed", "Meta");
    expect(highlights.activeColor).toBe("pink");
  });
});
