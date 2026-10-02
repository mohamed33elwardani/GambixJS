// Suite covering Board DOM, coords, orientation, sync, registry, auto-resize and destroy.
import { afterEach, describe, expect, it, vi } from "vitest";
import { FenStore } from "../../ts/src/utils/fen.ts";
import { STANDARD_FEN } from "../../ts/src/config/defaults.ts";
import { MockResizeObserver } from "../setup.ts";
import { makeBoard, type BoardFixture } from "../helpers.ts";

let fixture: BoardFixture | null = null;

// setup(): builds a fresh Board fixture; params: optional makeBoard options; returns: board fixture.
function setup(options?: Parameters<typeof makeBoard>[0]): BoardFixture {
  fixture = makeBoard(options);
  return fixture;
}

afterEach(() => {
  fixture?.board.destroy();
  fixture = null;
});

const E2_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";

// Covers initial DOM, squares, pieces and CSS variables.
describe("Board DOM construction", () => {
  it("builds wrapper, 64 squares and 32 pieces for the start position", () => {
    const { root } = setup();
    expect(root.querySelector(".gambix-wrapper")).not.toBeNull();
    expect(root.querySelector(".gambix-board")).not.toBeNull();

    const squares = root.querySelectorAll(".squares-container .square");
    expect(squares).toHaveLength(64);
    expect(root.querySelector('.square[data-square="e4"]')).not.toBeNull();
    expect(root.querySelectorAll(".piece")).toHaveLength(32);
  });

  it("sets square colors and piece metadata", () => {
    const { root } = setup();
    const e2Piece = root.querySelector('.piece[data-square="e2"]');
    expect(e2Piece?.getAttribute("data-piece")).toBe("wp");
    expect(e2Piece?.getAttribute("data-color")).toBe("white");
    expect(e2Piece?.getAttribute("data-type")).toBe("pawn");
    expect(
      root.querySelector('.piece[data-square="e8"]')?.getAttribute("data-color"),
    ).toBe("black");
  });

  it("renders no pieces for an empty position", () => {
    const { root } = setup({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" });
    expect(root.querySelectorAll(".piece")).toHaveLength(0);
    expect(root.querySelectorAll(".squares-container .square")).toHaveLength(64);
  });

  it("exposes CSS variables for square colors", () => {
    const { root } = setup();
    expect(root.style.getPropertyValue("--square-light-color")).toBe("#ebecd0");
    expect(root.style.getPropertyValue("--square-dark-color")).toBe("#739552");
    expect(root.style.getPropertyValue("--board-size")).toBe("800px");
  });
});

// Covers pixel coordinate math for both orientations.
describe("Board coordinates", () => {
  it("computes square coords for white orientation (800px board)", () => {
    const { board } = setup({ boardSize: 800 });
    // squareWidth=100, padding=5
    expect(board.getSquareCoords("a1")).toEqual({ x: 5, y: 705 });
    expect(board.getSquareCoords("h8")).toEqual({ x: 705, y: 5 });
    expect(board.getSquareCoords("e4")).toEqual({ x: 405, y: 405 });
  });

  it("mirrors square coords for black orientation", () => {
    const { board } = setup({ boardSize: 800, orientation: "black" });
    expect(board.getSquareCoords("a1")).toEqual({ x: 705, y: 5 });
    expect(board.getSquareCoords("h8")).toEqual({ x: 5, y: 705 });
  });
});

// Covers flipping, resizing and theme restyling.
describe("Board orientation / resize / restyle", () => {
  it("flipBoard toggles orientation and re-renders", () => {
    const { board, root } = setup();
    expect(board.getOrientation()).toBe("white");
    board.flipBoard("black");
    expect(board.getOrientation()).toBe("black");
    expect(board.getSquareCoords("a1")).toEqual({ x: 705, y: 5 });
    expect(root.querySelectorAll(".square")).toHaveLength(64);
    board.flipBoard("white");
    expect(board.getOrientation()).toBe("white");
  });

  it("resize updates board size and piece layout", () => {
    const { board, theme } = setup({ boardSize: 800 });
    board.resize(400);
    expect(theme.boardSize).toBe(400);
    // squareWidth=50, padding=2.5
    expect(board.getSquareCoords("a1")).toEqual({ x: 2.5, y: 352.5 });
  });

  it("reStyle merges square colors", () => {
    const { board, root, theme } = setup();
    board.reStyle({ squares: { light: "#ffffff", dark: "#000000" } });
    expect(theme.squares.light).toBe("#ffffff");
    expect(theme.squares.dark).toBe("#000000");
    expect(root.style.getPropertyValue("--square-light-color")).toBe("#ffffff");
  });

// Documents the known stale-reference quirk where the original theme object is not mutated.
  it("reStyle merges coord and piece themes", () => {
    const { board, theme } = setup();
    board.reStyle({ coord: { show: false } });
    expect(board.theme.coord.show).toBe(false);
    board.reStyle({ orientation: "black", pieces: { type: "svg" } });
    // NOTE: reStyle() replaces Board.theme with a merged copy, so
    // top-level props on the originally-passed object go stale — assert
    // on board.theme (see docs/BUGS.md #13).
    expect(board.theme.orientation).toBe("black");
    expect(board.theme.pieces.type).toBe("svg");
    expect(theme.orientation).toBe("white");
  });
});

// Covers position replacement and animated versus synced FEN diffs.
describe("Board position sync", () => {
  it("syncPosition replaces all pieces", () => {
    const { board, root } = setup();
    const store = new FenStore("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    board.syncPosition(store.getPositionMap());
    expect(root.querySelectorAll(".piece")).toHaveLength(2);
    expect(board.getPieceElement("e8")?.getAttribute("data-piece")).toBe("bk");
    expect(board.getPieceElement("e2")).toBeNull();
  });

  it("applyFenDiff without animation syncs pieces", () => {
    const { board } = setup({ animationsEnabled: false });
    const store = new FenStore(STANDARD_FEN);
    const diff = store.setFen(E2_E4_FEN)!;
    board.applyFenDiff(diff, { animate: false });
    expect(board.getPieceElement("e2")).toBeNull();
    expect(board.getPieceElement("e4")?.getAttribute("data-piece")).toBe("wp");
  });

  it("applyFenDiff with animation emits move-animated-end synchronously when durations are 0", () => {
    const { board, bus } = setup({ animationsEnabled: false });
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    bus.on("board:move-animated-end", (p) => ended.push(p));

    const store = new FenStore(STANDARD_FEN);
    const diff = store.setFen(E2_E4_FEN)!;
    board.applyFenDiff(diff);

    expect(ended).toEqual([{ from: "e2", to: "e4", isCapture: false }]);
    expect(board.getPieceElement("e4")?.getAttribute("data-piece")).toBe("wp");
  });
});

// Covers piece lookup, creation, remapping and removal.
describe("Board piece element registry", () => {
// Verifies empty-string lookup returns null before exercising the registry lifecycle.
  it("createAndAppendPieceElement / removePieceElement / remapPieceElement", () => {
    const { board } = setup({ fen: "8/8/8/8/8/8/8/8 w - - 0 1" });
    expect(board.getPieceElement("e4")).toBeNull();
    expect(board.getPieceElement("")).toBeNull();

    const el = board.createAndAppendPieceElement("wq", "e4");
    expect(el?.getAttribute("data-square")).toBe("e4");
    expect(board.getPieceElement("e4")).toBe(el);

    board.remapPieceElement("e4", "e5");
    expect(board.getPieceElement("e4")).toBeNull();
    expect(board.getPieceElement("e5")).toBe(el);

    board.removePieceElement("e5");
    expect(board.getPieceElement("e5")).toBeNull();
  });

  it("getBoardElement returns the board node", () => {
    const { board, root } = setup();
    const el = board.getBoardElement();
    expect(el).not.toBeNull();
    expect(el?.classList.contains("gambix-board")).toBe(true);
    expect(root.contains(el)).toBe(true);
  });
});

// Covers ResizeObserver wiring and size-change thresholds.
describe("Board auto-resize", () => {
  it("enableAutoResize observes the target and reacts to width", () => {
    const { board, root, theme } = setup({ boardSize: 600 });
    const seen: number[] = [];
    board.enableAutoResize(root, () => theme.boardSize, (w) => seen.push(w));

    const observer = MockResizeObserver.instances.at(-1)!;
    expect(observer.targets.has(root)).toBe(true);

    observer.trigger(500, 500);
    // next = min(500-24, 800) = 476, |476-600| > 4 -> onResize fires
    expect(seen).toEqual([476]);

    board.disableAutoResize();
    expect(observer.targets.size).toBe(0);
  });

  it("ignores negligible size changes", () => {
    const { board, root, theme } = setup({ boardSize: 600 });
    const onResize = vi.fn();
    board.enableAutoResize(root, () => theme.boardSize, onResize);
    // contentRect width 626 -> next = 602, |602-600| = 2 <= 4 -> ignored
    MockResizeObserver.instances.at(-1)!.trigger(626, 626);
    expect(onResize).not.toHaveBeenCalled();
    board.disableAutoResize();
  });
});

// Covers teardown and registry cleanup.
describe("Board.destroy", () => {
  it("removes the wrapper and clears registries", () => {
    const { board, root } = setup();
    expect(root.querySelector(".gambix-wrapper")).not.toBeNull();
    expect(board.getPieceElement("e2")).not.toBeNull();
    board.destroy();
    expect(root.querySelector(".gambix-wrapper")).toBeNull();
    expect(board.getPieceElement("e2")).toBeNull();
  });
});
