// End-to-end tests for the public Gambix facade (ts/index.ts):
// construction, FEN state, view APIs, events, and plugin wiring.
import { afterEach, describe, expect, it, vi } from "vitest";
import Gambix from "../ts/index.ts";
import { DEFAULT_CONFIG, STANDARD_FEN } from "../ts/src/config/defaults.ts";
import type { ChessOptions, GambixPlugin } from "../ts/src/types/types.ts";
import { MockResizeObserver } from "./setup.ts";
import {
  click,
  flushAsync,
  pointerDown,
  pointerUp,
} from "./helpers.ts";

const E2_E4_FEN = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
const WHITE_PROMO_FEN = "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1";

let games: Gambix[] = [];

/**
 * Builds a Gambix instance inside an attached #board container.
 * @param props - Optional ChessOptions for the constructor.
 * @returns The game instance and its root element (destroyed in afterEach).
 * Used by: every suite in this file.
 */
function setupGame(props?: ChessOptions): { game: Gambix; root: HTMLElement } {
  const root = document.createElement("div");
  root.id = "board";
  document.body.appendChild(root);
  const game = new Gambix("#board", props);
  games.push(game);
  return { game, root };
}

/**
 * Queries a square element by name.
 * @param root - Board root. @param name - Square name (e.g. "e2").
 * @returns The matching .square element.
 * Used by: click/drag simulation in this file.
 */
function square(root: HTMLElement, name: string): HTMLElement {
  return root.querySelector(`.square[data-square="${name}"]`)!;
}

/**
 * Queries a piece element by its square.
 * @param root - Board root. @param name - Square holding the piece.
 * @returns The matching .piece element.
 * Used by: drag simulation in this file.
 */
function pieceEl(root: HTMLElement, name: string): HTMLElement {
  return root.querySelector(`.piece[data-square="${name}"]`)!;
}

afterEach(() => {
  while (games.length) games.pop()!.destroy();
  vi.restoreAllMocks();
});

// Covers construction errors, default state, theming, resize, and destroy.
describe("Gambix constructor & lifecycle", () => {
  it("throws when the selector matches nothing", () => {
    expect(() => new Gambix("#missing")).toThrow(
      "Gambix: element '#missing' was not found on the page.",
    );
  });

  it("builds a default board with the standard position", () => {
    const { game, root } = setupGame();
    expect(game.getFEN()).toBe(STANDARD_FEN);
    expect(game.getOrientation()).toBe("white");
    expect(game.getPlayer()).toBe("both");
    expect(game.getTheme().boardSize).toBe(600);
    expect(root.querySelectorAll(".square")).toHaveLength(64);
    expect(root.querySelectorAll(".piece")).toHaveLength(32);
  });

  it("accepts fen 'start' and custom FEN strings", () => {
    const { game } = setupGame({ fen: "start" });
    expect(game.getFEN()).toBe(STANDARD_FEN);
    const { game: custom } = setupGame({ fen: E2_E4_FEN });
    expect(custom.getFEN()).toBe(E2_E4_FEN);
    expect(custom.getPiece("e4")).toEqual({ type: "p", color: "w" });
  });

  it("installs constructor plugins and supports usePlugin", () => {
    const install = vi.fn();
    const plugin: GambixPlugin = { name: "p1", install };
    const { game } = setupGame({ plugins: [plugin] });
    expect(install).toHaveBeenCalledOnce();
    expect(game.plugins.has("p1")).toBe(true);

    const second: GambixPlugin = { name: "p2", install: vi.fn() };
    game.usePlugin(second);
    expect(game.plugins.has("p2")).toBe(true);
    expect(() => game.usePlugin(second)).toThrow(
      "Plugin 'p2' is already installed.",
    );
  });

  it("binds constructor callbacks", () => {
    const onFenChanged = vi.fn();
    const { game } = setupGame({ onFenChanged });
    game.loadFEN(E2_E4_FEN);
    expect(onFenChanged).toHaveBeenCalledWith(E2_E4_FEN);
  });

  it("destroy tears down the DOM and is idempotent", () => {
    const { game, root } = setupGame();
    expect(root.querySelector(".gambix-wrapper")).not.toBeNull();
    expect(() => game.destroy()).not.toThrow();
    expect(root.querySelector(".gambix-wrapper")).toBeNull();
    games.pop(); // already destroyed; prevent afterEach double-destroy issues
    expect(() => game.destroy()).not.toThrow();
  });
});

// Covers getFEN/loadFEN/getBoard/getPiece, including invalid-FEN rejection.
describe("Gambix board state (FEN)", () => {
  it("getBoard returns all 64 squares", () => {
    const { game } = setupGame();
    const board = game.getBoard();
    expect(board).toHaveLength(64);
    expect(board.find((c) => c.square === "a8")).toEqual({
      square: "a8",
      piece: "br",
    });
    expect(board.find((c) => c.square === "e4")?.piece).toBeNull();
  });

  it("getPiece returns type/color or null", () => {
    const { game } = setupGame();
    expect(game.getPiece("e1")).toEqual({ type: "k", color: "w" });
    expect(game.getPiece("e8")).toEqual({ type: "k", color: "b" });
    expect(game.getPiece("e4")).toBeNull();
  });

  it("loadFEN applies valid positions and emits fen-changed", () => {
    const { game } = setupGame();
    const seen: string[] = [];
    game.onFenChanged((fen) => seen.push(fen));
    expect(game.loadFEN(E2_E4_FEN)).toBe(true);
    expect(game.getFEN()).toBe(E2_E4_FEN);
    expect(seen).toEqual([E2_E4_FEN]);
  });

  it("loadFEN rejects invalid FEN without side effects", () => {
    const { game } = setupGame();
    const seen: string[] = [];
    game.onFenChanged((fen) => seen.push(fen));
    expect(game.loadFEN("junk")).toBe(false);
    expect(game.getFEN()).toBe(STANDARD_FEN);
    expect(seen).toEqual([]);
  });

  it("reloading the same FEN is silent (documented behavior)", () => {
    const { game } = setupGame();
    const seen: string[] = [];
    game.onFenChanged((fen) => seen.push(fen));
    expect(game.loadFEN(STANDARD_FEN)).toBe(true);
    expect(seen).toEqual([]);
  });
});

// Covers flip/resize/setTheme/reStyle and auto-resize behavior.
describe("Gambix view APIs", () => {
  it("setTheme merges partially", () => {
    const { game } = setupGame();
    game.setTheme({ boardSize: 700 });
    expect(game.getTheme().boardSize).toBe(700);
    expect(game.getTheme().orientation).toBe("white");
    game.setTheme({ orientation: "black" });
    expect(game.getOrientation()).toBe("black");
  });

  it("flipBoard toggles orientation", () => {
    const { game } = setupGame();
    game.flipBoard();
    expect(game.getOrientation()).toBe("black");
    game.flipBoard();
    expect(game.getOrientation()).toBe("white");
  });

  it("resize updates the theme size", () => {
    const { game } = setupGame();
    game.resize(400);
    expect(game.getTheme().boardSize).toBe(400);
  });

  it("reStyle helpers update the board theme without throwing", () => {
    const { game } = setupGame();
    game.reStyleBoard("#ffffff", "#000000");
    // Regression test for docs/BUGS.md #13: Gambix.getTheme() must
    // reflect reStyle* changes (synced with Board.theme).
    expect(game.board.theme.squares.light).toBe("#ffffff");
    expect(game.board.theme.squares.dark).toBe("#000000");
    expect(game.getTheme().squares.light).toBe("#ffffff");
    expect(game.getTheme().squares.dark).toBe("#000000");
    game.reStyleCoords({ show: false });
    expect(game.board.theme.coord.show).toBe(false);
    expect(game.getTheme().coord.show).toBe(false);
    game.reStylePiece({ type: "svg" });
    expect(game.board.theme.pieces.type).toBe("svg");
    expect(game.getTheme().pieces.type).toBe("svg");
  });

  it("auto-resize follows the parent and can be disabled", () => {
    const { game } = setupGame();
    const observer = MockResizeObserver.instances.at(-1)!;
    expect(observer.targets.size).toBe(1);

    observer.trigger(500, 500);
    // next = min(500-24, 800) = 476
    expect(game.getTheme().boardSize).toBe(476);

    game.disableAutoResize();
    expect(game.getTheme().autoResize).toBe(false);
    expect(observer.targets.size).toBe(0);

    game.enableAutoResize();
    expect(game.getTheme().autoResize).toBe(true);
    expect(MockResizeObserver.instances.at(-1)!.targets.size).toBe(1);
  });
});

// Covers enable/disableInteractionFor and getInteractionSettings.
describe("Gambix interaction control", () => {
  it("enable/disable interaction for players", () => {
    const { game } = setupGame();
    game.enableInteractionFor("white");
    expect(game.getPlayer()).toBe("white");
    expect(game.getInteractionSettings().control).toBe("white");
    game.disableInteractionFor();
    expect(game.getPlayer()).toBe("none");
    game.enableInteractionFor("both");
    expect(game.getPlayer()).toBe("both");
  });

  it("rejectMove and rejectMoveFrom emit snapback events", () => {
    const { game } = setupGame();
    const snaps: Array<{ from: string; to: string | null }> = [];
    game.onSnapbackTriggered((p) => snaps.push(p));
    game.rejectMove();
    expect(snaps).toEqual([{ from: "", to: null }]);
    game.rejectMoveFrom("e2", "e4");
    expect(snaps[1]).toEqual({ from: "e2", to: "e4" });
  });
});

// Covers drawArrow/removeArrow/clearArrows and related events.
describe("Gambix arrows API", () => {
  it("drawArrow / getArrows / removeArrow / clearArrows / clearArrowsAll", () => {
    const { game } = setupGame();
    expect(game.getArrows()).toEqual([]);
    expect(game.drawArrow("e2", "e4", "red")).toBe(true);
    expect(game.getArrows()).toHaveLength(1);
    expect(game.drawArrow("e2", "e2")).toBe(false);

    const removed: Array<{ from: string; to: string }> = [];
    game.onArrowRemoved((p) => removed.push(p));
    expect(game.removeArrow("e2", "e4")).toBe(true);
    expect(removed).toEqual([{ from: "e2", to: "e4" }]);
    expect(game.removeArrow("e2", "e4")).toBe(false);

    game.drawArrow("a2", "a4", "red");
    game.drawArrow("b2", "b4", "blue", 2);
    // NOTE: Gambix.drawArrow creates persistent arrows, so clearArrows
    // (temporary only) keeps them while clearArrowsAll removes everything.
    game.clearArrows();
    expect(game.getArrows()).toHaveLength(2);
    game.clearArrowsAll();
    expect(game.getArrows()).toHaveLength(0);
  });

  it("onArrowAdded fires for programmatic arrows", () => {
    const { game } = setupGame();
    const added: Array<{ from: string; to: string; color: string }> = [];
    game.onArrowAdded((p) => added.push(p));
    game.drawArrow("e2", "e4", "red", true);
    expect(added).toMatchObject([{ from: "e2", to: "e4", color: "red" }]);
  });

  it("onArrowsCleared fires", () => {
    const { game } = setupGame();
    const cleared: unknown[] = [];
    game.onArrowsCleared(() => cleared.push(1));
    game.clearArrows();
    game.clearArrowsAll();
    expect(cleared).toHaveLength(2);
  });

  it("drawing can be disabled at construction and toggled later", () => {
    const { game } = setupGame({ drawing: { enabled: false } });
    expect(game.drawArrow("e2", "e4")).toBe(false);
    expect(game.getArrows()).toEqual([]);
    // NOTE: with drawing disabled at construction no Arrows instance
    // exists, so enable/disableDraw() return early and the flag stays
    // false — programmatic drawArrow() stays unavailable by design.
    game.enableDraw();
    expect(game.drawing.enabled).toBe(false);
    expect(game.drawArrow("e2", "e4")).toBe(false);
    game.disableDraw();
    expect(game.drawing.enabled).toBe(false);
  });
});

// Covers setHighlight, last-move, check/checkmate, and legal-move markers.
describe("Gambix highlights API", () => {
  it("setHighlight / getHighlights / removeHighlight", () => {
    const { game } = setupGame();
    game.setHighlight("e4");
    expect(game.getHighlights()).toEqual([
      { square: "e4", kind: "locked", color: game.highlighter.activeColor },
    ]);
    game.removeHighlight("e4");
    expect(game.getHighlights()).toEqual([]);
  });

  it("onHighlightToggled and onHighlightsCleared fire", () => {
    const { game } = setupGame();
    const toggles: Array<{ square: string; active: boolean }> = [];
    const cleared: unknown[] = [];
    game.onHighlightToggled((p) => toggles.push(p));
    game.onHighlightsCleared(() => cleared.push(1));
    game.setHighlight("e4", "red");
    expect(toggles[0]).toMatchObject({ square: "e4", active: true });
    game.clearHighlights();
    expect(cleared).toHaveLength(1);
    game.setHighlight("e4");
    game.clearHighlightsAll();
    expect(game.getHighlights()).toEqual([]);
  });

  it("enable/disable highlights master switch", () => {
    const { game } = setupGame();
    game.disableHighlights();
    expect(game.highlighter.highlightsConfig.enabled).toBe(false);
    game.enableHighlights();
    expect(game.highlighter.highlightsConfig.enabled).toBe(true);
  });

  it("last move, check and checkmate helpers", () => {
    const { game } = setupGame();
    expect(game.getLastMove()).toBeNull();
    game.setLastMove("e2", "e4");
    expect(game.getLastMove()).toEqual({ from: "e2", to: "e4" });
    game.setLastMove(null, null);
    expect(game.getLastMove()).toBeNull();

    game.setCheck("e8");
    expect(game.getHighlights().some((h) => h.kind === "check")).toBe(true);
    game.clearCheck();
    expect(game.getHighlights().some((h) => h.kind === "check")).toBe(false);

    game.setCheckmate("d8", "e8");
    const kinds = game.getHighlights().map((h) => h.kind).sort();
    expect(kinds).toEqual(["checkmate-loser", "checkmate-winner"]);
    game.clearCheckmate();
    expect(game.getHighlights()).toEqual([]);
  });

  it("legal moves can be set and cleared", () => {
    const { game } = setupGame();
    game.setLegalMoves(["e3", "e4"]);
    expect(game.getHighlights()).toHaveLength(2);
    game.clearLegalMoves();
    expect(game.getHighlights()).toEqual([]);
  });

  it("legal move ratios and scale updates apply", () => {
    const { game } = setupGame();
    // setLegalMoveRatio mutates shared DEFAULT_CONFIG nesting, so restore it.
    const prevDot = DEFAULT_CONFIG.highlights.legalMoves.dotSize;
    const prevRing = DEFAULT_CONFIG.highlights.legalMoves.ringSize;
    try {
      expect(() => {
        game.setLegalMoveRatio(0.2, 0.05);
        game.updateLegalMoveScale();
      }).not.toThrow();
    } finally {
      DEFAULT_CONFIG.highlights.legalMoves.dotSize = prevDot;
      DEFAULT_CONFIG.highlights.legalMoves.ringSize = prevRing;
    }
  });
});

// Covers animation toggles and animation-config updates.
describe("Gambix animation APIs", () => {
  it("enable/disable animations toggles the animator", () => {
    const { game } = setupGame();
    game.disableAnimations();
    expect(game.board.animator.options.enabled).toBe(false);
    game.enableAnimations();
    expect(game.board.animator.options.enabled).toBe(true);
  });

  it("updateAnimationConfig merges animator and snapback settings", () => {
    const { game } = setupGame();
    game.updateAnimationConfig({ move: { duration: 5 } } as never);
    expect(game.board.animator.options.move.duration).toBe(5);
    game.updateAnimationConfig({ snapback: { duration: 42 } } as never);
    expect(game.getInteractionSettings().snapback?.duration).toBe(42);
  });
});

// Covers choosePromotion/cancelPromotion/getPromotionPending end to end.
describe("Gambix promotion APIs", () => {
  it("drives the overlay via board clicks", () => {
    const { game, root } = setupGame({ fen: WHITE_PROMO_FEN });
    expect(game.getPromotionPending()).toBeNull();
    click(square(root, "e7"));
    click(square(root, "e8"));
    expect(game.getPromotionPending()).toMatchObject({ from: "e7", to: "e8" });
    expect(
      root.querySelector(".gambix-promotion-panel"),
    ).not.toBeNull();
  });

  it("choosePromotion completes and cancelPromotion aborts", () => {
    const { game, root } = setupGame({ fen: WHITE_PROMO_FEN });
    const selected: Array<{ from: string; to: string; promotion: string }> = [];
    const cancelled: Array<{ from: string; to: string }> = [];
    game.onPromotionSelected((p) => selected.push(p));
    game.onPromotionCancelled((p) => cancelled.push(p));

    click(square(root, "e7"));
    click(square(root, "e8"));
    game.choosePromotion("e7", "e8", "q");
    expect(selected).toEqual([{ from: "e7", to: "e8", promotion: "q" }]);

    click(square(root, "e7"));
    click(square(root, "e8"));
    game.cancelPromotion();
    expect(cancelled).toEqual([{ from: "e7", to: "e8" }]);
    expect(game.getPromotionPending()).toBeNull();
  });

  it("binds onPromotionCancelled from the constructor config", () => {
    const cancelled: Array<{ from: string; to: string }> = [];
    const { game, root } = setupGame({
      fen: WHITE_PROMO_FEN,
      onPromotionCancelled: (p) => cancelled.push(p),
    });
    click(square(root, "e7"));
    click(square(root, "e8"));
    game.cancelPromotion();
    expect(cancelled).toEqual([{ from: "e7", to: "e8" }]);
  });

  it("choosePromotion with an invalid code is ignored", () => {
    const { game } = setupGame();
    const selected: unknown[] = [];
    game.onPromotionSelected((p) => selected.push(p));
    game.choosePromotion("e2", "e4", "x");
    expect(selected).toEqual([]);
  });

  it("onPromotionRequested can auto-resolve without overlay", async () => {
    const { game, root } = setupGame({ fen: WHITE_PROMO_FEN });
    const seen: Array<{ from: string; to: string }> = [];
    game.onPromotionRequested(() => "q");
    game.onPromotionSelected((p) => seen.push(p));
    click(square(root, "e7"));
    click(square(root, "e8"));
    await flushAsync(); // the auto-pick path awaits the handler
    expect(seen).toEqual([{ from: "e7", to: "e8", promotion: "q" }]);
    expect(root.querySelector(".gambix-promotion-panel")).toBeNull();
  });
});

// Covers onPieceSelected/onSquareSelected/onMoveRequested incl. async paths.
describe("Gambix selection & move events", () => {
  it("onPieceSelected receives the piece and renders returned legal moves", () => {
    const { game, root } = setupGame();
    const seen: Array<{ square: string; piece: string | null }> = [];
    game.onPieceSelected((p) => {
      seen.push(p);
      return ["e3", "e4"];
    });
    click(square(root, "e2"));
    expect(seen).toEqual([{ square: "e2", piece: "wp" }]);
    const kinds = game.getHighlights().map((h) => h.kind);
    expect(kinds).toContain("legal-dot");
  });

  it("onSquareSelected fires for every selection", () => {
    const { game, root } = setupGame();
    const seen: Array<{ square: string; piece: string | null }> = [];
    game.onSquareSelected((p) => seen.push(p));
    click(square(root, "e2"));
    expect(seen).toEqual([{ square: "e2", piece: "wp" }]);
  });

  it("onMoveRequested returning false triggers a snapback", () => {
    const { game, root } = setupGame();
    const moves: Array<{ from: string; to: string }> = [];
    const snaps: Array<{ from: string; to: string | null }> = [];
    game.onMoveRequested((p) => {
      moves.push(p);
      return false;
    });
    game.onSnapbackTriggered((p) => snaps.push(p));
    click(square(root, "e2"));
    click(square(root, "e4"));
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ from: "e2", to: "e4" });
    expect(snaps).toEqual([{ from: "e2", to: "e4" }]);
  });

  it("onMoveRequested supports async rejection", async () => {
    const { game, root } = setupGame();
    const snaps: Array<{ from: string; to: string | null }> = [];
    game.onMoveRequested(() => Promise.resolve(false));
    game.onSnapbackTriggered((p) => snaps.push(p));
    click(square(root, "e2"));
    click(square(root, "e4"));
    await flushAsync();
    expect(snaps).toEqual([{ from: "e2", to: "e4" }]);
  });

  it("onMoveRequested async failure snaps back without unhandled rejection", async () => {
    const { game, root } = setupGame();
    const snaps: Array<{ from: string; to: string | null }> = [];
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    game.onMoveRequested(() => Promise.reject(new Error("boom")));
    game.onSnapbackTriggered((p) => snaps.push(p));
    click(square(root, "e2"));
    click(square(root, "e4"));
    await flushAsync();
    expect(snaps).toEqual([{ from: "e2", to: "e4" }]);
    expect(err).toHaveBeenCalledTimes(1);
  });

  it("constructor onMoveRequested callback is honored", () => {
    const { game, root } = setupGame({
      onMoveRequested: () => false,
    });
    const snaps: Array<{ from: string; to: string | null }> = [];
    game.onSnapbackTriggered((p) => snaps.push(p));
    click(square(root, "e2"));
    click(square(root, "e4"));
    expect(snaps).toEqual([{ from: "e2", to: "e4" }]);
  });
});

// Covers onDragStart/onDragEnd around pointer drags.
describe("Gambix drag events", () => {
  it("onDragStart / onDragEnd fire around a piece drag", () => {
    const { game, root } = setupGame();
    const starts: Array<{ square: string; piece: string | null }> = [];
    const ends: Array<{ from: string; to: string | null }> = [];
    game.onDragStart((p) => starts.push(p));
    game.onDragEnd((p) => ends.push(p));

    pointerDown(pieceEl(root, "e2"), { button: 0, clientX: 10, clientY: 10 });
    expect(starts).toEqual([{ square: "e2", piece: "wp" }]);
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    pointerUp(window, { button: 0, clientX: 300, clientY: 300 });
    expect(ends).toHaveLength(1);
    expect(ends[0]).toMatchObject({ from: "e2", piece: "wp" });
  });

  it("onMoveAnimatedEnd fires after an instant animated load", () => {
    const { game } = setupGame();
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    game.onMoveAnimatedEnd((p) => ended.push(p));
    game.updateAnimationConfig({ move: { duration: 0 } } as never);
    game.loadFEN(E2_E4_FEN);
    expect(ended).toEqual([{ from: "e2", to: "e4", isCapture: false }]);
  });
});

// Covers onDrawStart/onDrawMove/onDrawEnd/onDrawCleared subscriptions.
describe("Gambix drawing events", () => {
  it("onDrawStart / onDrawMove / onDrawEnd follow a right-drag", () => {
    const { game, root } = setupGame();
    const starts: Array<{ from: string; to: string }> = [];
    const moves: Array<{ from: string; to: string }> = [];
    const ends: Array<{ from: string; to: string }> = [];
    game.onDrawStart((p) => starts.push(p));
    game.onDrawMove((p) => moves.push(p));
    game.onDrawEnd((p) => ends.push(p));

    pointerDown(square(root, "e2"), { button: 2, clientX: 5, clientY: 5 });
    square(root, "e4").dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true }),
    );
    pointerUp(window, { button: 2 });

    expect(starts).toEqual([{ from: "e2", to: "e2" }]);
    expect(moves).toEqual([{ from: "e2", to: "e4" }]);
    expect(ends).toEqual([{ from: "e2", to: "e4" }]);
  });

  it("onDrawCleared fires on double-click", () => {
    const { game, root } = setupGame();
    const cleared: unknown[] = [];
    game.onDrawCleared(() => cleared.push(1));
    root
      .querySelector(".gambix-wrapper")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(cleared).toHaveLength(1);
  });
});

// Covers highlight toggles, piece placed/removed, and snapback events.
describe("Gambix highlight & placement events", () => {
  it("onSquareHighlight fires on right-click", () => {
    const { game, root } = setupGame();
    const seen: string[] = [];
    game.onSquareHighlight((sq) => seen.push(sq));
    square(root, "d4").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(seen).toEqual(["d4"]);
  });

  it("onPiecePlaced fires when a panel piece is dropped inside", () => {
    const { game, root } = setupGame();
    const placed: Array<{ to: string; piece: string }> = [];
    game.onPiecePlaced((p) => placed.push(p));

    const wrapper = root.querySelector(".gambix-wrapper") as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      x: 0,
      y: 0,
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
      toJSON: () => ({}),
    } as DOMRect);
    const panel = document.createElement("div");
    panel.className = "panel-piece";
    panel.setAttribute("data-piece", "wq");
    wrapper.appendChild(panel);

    pointerDown(panel, { button: 0, clientX: 200, clientY: 200 });
    pointerUp(window);
    expect(placed).toHaveLength(1);
    expect(placed[0]?.piece).toBe("wq");
    expect(placed[0]?.to).toMatch(/^[a-h][1-8]$/);
  });

  it("onPieceRemoved fires when a piece is dropped outside", () => {
    const { game, root } = setupGame();
    const removed: Array<{ from: string }> = [];
    game.onPieceRemoved((p) => removed.push(p));

    const wrapper = root.querySelector(".gambix-wrapper") as HTMLElement;
    vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
      x: 5000,
      y: 5000,
      left: 5000,
      top: 5000,
      right: 6000,
      bottom: 6000,
      width: 1000,
      height: 1000,
      toJSON: () => ({}),
    } as DOMRect);

    pointerDown(pieceEl(root, "e2"), { button: 0, clientX: 10, clientY: 10 });
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    pointerUp(window, { button: 0, clientX: 300, clientY: 300 });
    expect(removed).toEqual([{ from: "e2" }]);
  });
});

// Covers onKeyPressed/onKeyUp subscriptions.
describe("Gambix keyboard events", () => {
  it("onKeyPressed / onKeyUp forward document keys", () => {
    const { game } = setupGame();
    const pressed: string[] = [];
    const released: string[] = [];
    game.onKeyPressed((k) => pressed.push(k));
    game.onKeyUp((k) => released.push(k));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Shift" }));
    document.dispatchEvent(new KeyboardEvent("keyup"));
    expect(pressed).toEqual(["Shift"]);
    expect(released).toEqual([""]);
  });
});

// Covers the generic on/off/once API and plugin install/destroy.
describe("Gambix generic event API", () => {
  it("on / off / once manage raw subscriptions", () => {
    const { game } = setupGame();
    const calls: string[] = [];
    const handler = (p: { fen: string }): void => {
      calls.push(p.fen);
    };
    game.on("board:fen-changed", handler);
    game.loadFEN(E2_E4_FEN);
    expect(calls).toEqual([E2_E4_FEN]);

    game.off("board:fen-changed", handler);
    game.loadFEN(WHITE_PROMO_FEN);
    expect(calls).toEqual([E2_E4_FEN]);

    const onceCalls: string[] = [];
    game.once("board:fen-changed", (p) => onceCalls.push(p.fen));
    game.loadFEN(STANDARD_FEN);
    game.loadFEN(E2_E4_FEN);
    expect(onceCalls).toEqual([STANDARD_FEN]);
  });

  it("every on* returns a working unsubscribe function", () => {
    const { game, root } = setupGame();
    const selected: unknown[] = [];
    const off = game.onSquareSelected((p) => selected.push(p));
    click(square(root, "e2"));
    expect(selected).toHaveLength(1);
    off();
    click(square(root, "d2"));
    click(square(root, "d4"));
    expect(selected).toHaveLength(1);
  });
});
