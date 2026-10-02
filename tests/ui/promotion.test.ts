/**
 * Suite covering PromotionManager routing, picker UI, handlers, and edge cases.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import PromotionManager from "../../ts/src/ui/promotion.ts";
import EventBus from "../../ts/src/events/event-bus.ts";
import { FenStore } from "../../ts/src/utils/fen.ts";
import { DEFAULT_CONFIG } from "../../ts/src/config/defaults.ts";
import type {
  ChessEvents,
  PromotionDeps,
} from "../../ts/src/types/types.ts";
import { flushAsync } from "../helpers.ts";

const WHITE_PROMO_FEN = "4k3/4P3/8/8/8/8/8/4K3 w - - 0 1";
const BLACK_PROMO_FEN = "4k3/8/8/8/8/8/p7/4K3 b - - 0 1";
const START_FEN =
  "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface PromotionFixture {
  container: HTMLElement;
  bus: EventBus<ChessEvents>;
  store: FenStore;
  onRejectMove: ReturnType<typeof vi.fn>;
  manager: PromotionManager;
  moves: Array<{ from: string; to: string; promotion?: string | null }>;
  requested: Array<{ from: string; to: string }>;
  selected: Array<{ from: string; to: string; promotion: string | null }>;
  chosen: Array<{ from: string; to: string; promotion: string | null }>;
  cancelled: Array<{ from: string; to: string }>;
}

let current: PromotionFixture | null = null;

/**
 * Builds a PromotionManager wired to a board container with captured events.
 * @param fen - The board position to load for the test.
 * @returns A fixture with the manager and captured event arrays.
 * Used by: PromotionManager test cases.
 */
function setup(fen: string = START_FEN): PromotionFixture {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const bus = new EventBus<ChessEvents>();
  const store = new FenStore(fen);
  const onRejectMove = vi.fn();
  const deps: PromotionDeps = {
    eventBus: bus,
    getPiece: (sq) => store.getPiece(sq),
    getBoardElement: () => container,
    getTheme: () => DEFAULT_CONFIG.theme,
    onRejectMove,
  };
  const manager = new PromotionManager(deps);
  manager.attach();

  const fx: PromotionFixture = {
    container,
    bus,
    store,
    onRejectMove,
    manager,
    moves: [],
    requested: [],
    selected: [],
    chosen: [],
    cancelled: [],
  };
  bus.on("board:move-requested", (p) => fx.moves.push(p));
  bus.on("board:promotion-requested", (p) => fx.requested.push(p));
  bus.on("board:promotion-selected", (p) => fx.selected.push(p));
  bus.on("board:promotion-chosen", (p) => fx.chosen.push(p));
  bus.on("board:promotion-cancelled", (p) => fx.cancelled.push(p));
  current = fx;
  return fx;
}

afterEach(() => {
  current?.manager.destroy();
  current = null;
  vi.restoreAllMocks();
});

/**
 * Finds the rendered promotion picker panel, if present.
 * @param fx - The promotion fixture.
 * @returns The panel element, or null when not shown.
 * Used by: PromotionManager test cases.
 */
function overlay(fx: PromotionFixture): HTMLElement | null {
  return fx.container.querySelector(".gambix-promotion-panel");
}

/** Covers direct forwarding of ordinary and non-final-rank pawn moves. */
describe("PromotionManager — non-promotion moves", () => {
  it("forwards ordinary moves without overlay or pending state", async () => {
    const fx = setup();
    expect(fx.manager.getPending()).toBeNull();
    fx.bus.emit("interaction:move-requested", { from: "b1", to: "c3" });
    await flushAsync();
    expect(fx.moves).toEqual([{ from: "b1", to: "c3" }]);
    expect(fx.requested).toEqual([]);
    expect(overlay(fx)).toBeNull();
    expect(fx.manager.getPending()).toBeNull();
  });

  it("forwards non-final-rank pawn pushes directly", async () => {
    const fx = setup();
    fx.bus.emit("interaction:move-requested", { from: "e2", to: "e4" });
    await flushAsync();
    expect(fx.moves).toEqual([{ from: "e2", to: "e4" }]);
    expect(overlay(fx)).toBeNull();
  });

  it("treats two-file pawn sidesteps as non-promotions", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "c8" });
    await flushAsync();
    expect(fx.moves).toEqual([{ from: "e7", to: "c8" }]);
    expect(overlay(fx)).toBeNull();
  });
});

/** Covers picker display, pending state, selection, cancel, and backdrop flow. */
describe("PromotionManager — overlay flow", () => {
  it("shows the picker and tracks pending for e7-e8", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();

    expect(fx.requested).toEqual([
      { from: "e7", to: "e8", color: "w", piece: "wp" },
    ]);
    expect(fx.moves).toEqual([]);
    expect(fx.manager.getPending()).toMatchObject({
      from: "e7",
      to: "e8",
      color: "w",
    });

    const panel = overlay(fx);
    expect(panel).not.toBeNull();
    const options = [...panel!.querySelectorAll(".promotion-option")];
    expect(options).toHaveLength(4);
    expect(options.map((o) => o.getAttribute("data-promo")).sort()).toEqual([
      "b",
      "n",
      "q",
      "r",
    ]);
  });

  it("choose() with pending state completes the promotion", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();

    fx.manager.choose("e7", "e8", "q");
    expect(fx.selected).toEqual([{ from: "e7", to: "e8", promotion: "q" }]);
    expect(fx.moves).toEqual([{ from: "e7", to: "e8", promotion: "q" }]);
    expect(overlay(fx)).toBeNull();
    expect(fx.manager.getPending()).toBeNull();
  });

  it("cancel() emits promotion-cancelled and rejects the move", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();

    fx.manager.cancel();
    expect(fx.cancelled).toEqual([{ from: "e7", to: "e8" }]);
    expect(fx.onRejectMove).toHaveBeenCalledWith("e7", "e8");
    expect(overlay(fx)).toBeNull();
    expect(fx.manager.getPending()).toBeNull();
  });

  it("hide(false) closes silently without cancel events", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    fx.manager.hide(false);
    expect(fx.cancelled).toEqual([]);
    expect(fx.onRejectMove).not.toHaveBeenCalled();
    expect(overlay(fx)).toBeNull();
  });

  it("clicking the backdrop cancels the promotion", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    fx.container
      .querySelector(".promotion-backdrop")!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(fx.cancelled).toEqual([{ from: "e7", to: "e8" }]);
    expect(fx.onRejectMove).toHaveBeenCalledWith("e7", "e8");
  });

  it("clicking a picker option selects that piece", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    overlay(fx)!
      .querySelector('.promotion-option[data-promo="n"]')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(fx.selected).toEqual([{ from: "e7", to: "e8", promotion: "n" }]);
    expect(fx.moves).toEqual([{ from: "e7", to: "e8", promotion: "n" }]);
  });

  it("supports black pawn promotions", async () => {
    const fx = setup(BLACK_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "a2", to: "a1" });
    await flushAsync();
    expect(fx.requested[0]).toMatchObject({
      from: "a2",
      to: "a1",
      color: "b",
    });
    expect(overlay(fx)).not.toBeNull();
    fx.manager.choose("a2", "a1", "r");
    expect(fx.moves).toEqual([{ from: "a2", to: "a1", promotion: "r" }]);
  });
});

/** Covers auto-resolve, rejection, errors, and unsubscribe for request handlers. */
describe("PromotionManager — onPromotionRequested handlers", () => {
  it("auto-resolves when a handler returns a piece code", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => "r");
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(fx.selected).toEqual([{ from: "e7", to: "e8", promotion: "r" }]);
    expect(fx.moves).toEqual([{ from: "e7", to: "e8", promotion: "r" }]);
    expect(overlay(fx)).toBeNull();
  });

  it("supports async handlers", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(async () => "b");
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(fx.moves).toEqual([{ from: "e7", to: "e8", promotion: "b" }]);
  });

  it("handler returning false rejects the move", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => false);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(fx.moves).toEqual([]);
    expect(fx.selected).toEqual([]);
    expect(fx.onRejectMove).toHaveBeenCalledWith("e7", "e8");
    expect(overlay(fx)).toBeNull();
  });

  it("throwing handlers are skipped and the overlay still shows", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => {
      throw new Error("nope");
    });
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(overlay(fx)).not.toBeNull();
    expect(fx.onRejectMove).not.toHaveBeenCalled();
  });

  it("invalid piece codes fall through to the overlay", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => "k");
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(fx.moves).toEqual([]);
    expect(overlay(fx)).not.toBeNull();
  });

  it("unsubscribing a handler stops auto-resolution", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    const off = fx.manager.onPromotionRequested(() => "q");
    off();
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    expect(fx.moves).toEqual([]);
    expect(overlay(fx)).not.toBeNull();
  });
});

/** Covers invalid input, in-flight requests, regressions, and teardown. */
describe("PromotionManager — edge cases", () => {
  it("choose() ignores invalid promotion codes", () => {
    const fx = setup();
    fx.manager.choose("e7", "e8", "x");
    expect(fx.selected).toEqual([]);
    expect(fx.moves).toEqual([]);
  });

  // A never-resolving handler keeps the request in flight, so direct choose() must stay a no-op.
  it("choose() during an in-flight async request is a safe no-op", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => new Promise(() => {}));
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    fx.manager.choose("e7", "e8", "q");
    expect(fx.selected).toEqual([]);
    expect(fx.moves).toEqual([]);
  });

  // Regression test for docs/BUGS.md #1: `promotion-chosen` must be
  // broadcast exactly once per choice (via the forwarder in attach()).
  it("emits promotion-chosen exactly once per choice", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    fx.manager.choose("e7", "e8", "q");
    expect(fx.chosen).toHaveLength(1);
  });

  // Regression test for docs/BUGS.md #9: the fallback path in choose()
  // ignores calls that are not real promotion candidates.
  it("ignores choose() calls that are not promotion candidates", () => {
    const fx = setup();
    fx.manager.choose("e2", "e4", "q");
    expect(fx.selected).toEqual([]);
    expect(fx.moves).toEqual([]);
  });

  it("missing board element cancels the request (docs/BUGS.md #10)", async () => {
    const bus = new EventBus<ChessEvents>();
    const store = new FenStore(WHITE_PROMO_FEN);
    const onRejectMove = vi.fn();
    const manager = new PromotionManager({
      eventBus: bus,
      getPiece: (sq) => store.getPiece(sq),
      getBoardElement: () => null,
      getTheme: () => DEFAULT_CONFIG.theme,
      onRejectMove,
    });
    const cancelled: unknown[] = [];
    bus.on("board:promotion-cancelled", (p) => cancelled.push(p));
    try {
      manager.attach();
      bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
      await flushAsync();
      expect(manager.getPending()).toBeNull();
      expect(cancelled).toEqual([{ from: "e7", to: "e8" }]);
      expect(onRejectMove).toHaveBeenCalledWith("e7", "e8");
    } finally {
      manager.destroy();
    }
  });

  it("destroy clears handlers and overlays", async () => {
    const fx = setup(WHITE_PROMO_FEN);
    fx.manager.onPromotionRequested(() => "q");
    fx.bus.emit("interaction:move-requested", { from: "e7", to: "e8" });
    await flushAsync();
    fx.manager.destroy();
    current = null; // already destroyed; skip afterEach destroy
    expect(overlay(fx)).toBeNull();
    expect(fx.manager.getPending()).toBeNull();
  });
});
