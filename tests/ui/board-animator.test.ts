// Suite covering BoardAnimator quiet moves, captures, spawn/discard, promotion and plumbing.
import { afterEach, describe, expect, it, vi } from "vitest";
import { FenStore } from "../../ts/src/utils/fen.ts";
import { STANDARD_FEN } from "../../ts/src/config/defaults.ts";
import { parseFenToMap, clonePositionMap } from "../../ts/src/utils/fen.ts";
import { makeBoard, type BoardFixture } from "../helpers.ts";

let fixture: BoardFixture | null = null;

afterEach(() => {
  fixture?.board.destroy();
  fixture = null;
  vi.restoreAllMocks();
});

// Covers quiet pawn moves without capture.
describe("BoardAnimator.renderSnapshot — quiet move", () => {
  it("moves the piece element and emits move-animated-end", () => {
    fixture = makeBoard({ animationsEnabled: false });
    const { board, bus } = fixture;
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    bus.on("board:move-animated-end", (p) => ended.push(p));

    const store = new FenStore(STANDARD_FEN);
    const next = store.setFen(
      "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1",
    )!;
    board.applyFenDiff(next);

    expect(ended).toEqual([{ from: "e2", to: "e4", isCapture: false }]);
    expect(board.getPieceElement("e2")).toBeNull();
    expect(board.getPieceElement("e4")?.getAttribute("data-piece")).toBe("wp");
  });
});

// Covers captures and the isCapture flag.
describe("BoardAnimator.renderSnapshot — capture", () => {
  it("removes the captured piece and flags isCapture", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1",
    });
    const { board, bus, root } = fixture;
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    bus.on("board:move-animated-end", (p) => ended.push(p));
    expect(board.getPieceElement("d5")?.getAttribute("data-piece")).toBe("bp");

    const store = new FenStore("4k3/8/8/3p4/4P3/8/8/4K3 w - - 0 1");
    const next = store.setFen("4k3/8/8/3P4/8/8/8/4K3 b - - 0 1")!;
    board.applyFenDiff(next);

    expect(ended).toEqual([{ from: "e4", to: "d5", isCapture: true }]);
    const atD5 = root.querySelectorAll('.piece[data-square="d5"]');
    expect(atD5).toHaveLength(1);
    expect(atD5[0]?.getAttribute("data-piece")).toBe("wp");
  });
});

// Covers appearing and disappearing pieces outside normal moves.
describe("BoardAnimator.renderSnapshot — spawn / discard", () => {
  it("spawns newly appearing pieces", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "4k3/8/8/8/8/8/8/4K3 w - - 0 1",
    });
    const { board } = fixture;
    expect(board.getPieceElement("e4")).toBeNull();

    const oldMap = parseFenToMap("4k3/8/8/8/8/8/8/4K3 w - - 0 1");
    const newMap = clonePositionMap(oldMap);
    newMap.set("e4", "wq");
    board.animator.renderSnapshot(oldMap, newMap);

    expect(board.getPieceElement("e4")?.getAttribute("data-piece")).toBe("wq");
  });

  it("discards disappearing pieces", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "4k3/8/8/8/8/8/p7/4K3 w - - 0 1",
    });
    const { board } = fixture;
    expect(board.getPieceElement("a2")).not.toBeNull();

    const oldMap = parseFenToMap("4k3/8/8/8/8/8/p7/4K3 w - - 0 1");
    const newMap = clonePositionMap(oldMap);
    newMap.set("a2", null);
    board.animator.renderSnapshot(oldMap, newMap);

    expect(board.getPieceElement("a2")).toBeNull();
  });
});

// Covers pawn promotion with piece swap on the target square.
describe("BoardAnimator.renderSnapshot — promotion", () => {
  it("animates the pawn then swaps it for the promoted piece", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "2k5/4P3/8/8/8/8/8/4K3 w - - 0 1",
    });
    const { board, bus } = fixture;
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    bus.on("board:move-animated-end", (p) => ended.push(p));

    const store = new FenStore("2k5/4P3/8/8/8/8/8/4K3 w - - 0 1");
    const next = store.setFen("2k1Q3/8/8/8/8/8/8/4K3 b - - 0 1")!;
    board.applyFenDiff(next);

    expect(ended).toEqual([{ from: "e7", to: "e8", isCapture: false }]);
    expect(board.getPieceElement("e7")).toBeNull();
    expect(board.getPieceElement("e8")?.getAttribute("data-piece")).toBe("wq");
  });
});

// Covers promotion when the pawn element is missing from the DOM registry.
describe("BoardAnimator.renderSnapshot — promotion without pawn element", () => {
  it("spawns the promoted piece instead of leaving the square empty", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "2k5/4P3/8/8/8/8/8/4K3 w - - 0 1",
    });
    const { board } = fixture;
    board.removePieceElement("e7");

    const store = new FenStore("2k5/4P3/8/8/8/8/8/4K3 w - - 0 1");
    const next = store.setFen("2k1Q3/8/8/8/8/8/8/4K3 b - - 0 1")!;
    board.applyFenDiff(next);

    expect(board.getPieceElement("e7")).toBeNull();
    expect(board.getPieceElement("e8")?.getAttribute("data-piece")).toBe("wq");
  });
});

// Covers promotion captures with piece swap and captured-piece cleanup.
describe("BoardAnimator.renderSnapshot — promotion capture", () => {
  it("replaces both the pawn and the captured piece with the promoted piece", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "r6k/1P6/8/8/8/8/8/4K3 w - - 0 1",
    });
    const { board, bus, root } = fixture;
    const ended: Array<{ from: string; to: string; isCapture: boolean }> = [];
    bus.on("board:move-animated-end", (p) => ended.push(p));
    expect(board.getPieceElement("a8")?.getAttribute("data-piece")).toBe("br");

    const store = new FenStore("r6k/1P6/8/8/8/8/8/4K3 w - - 0 1");
    const next = store.setFen("Q6k/8/8/8/8/8/8/4K3 b - - 0 1")!;
    board.applyFenDiff(next);

    expect(ended).toEqual([{ from: "b7", to: "a8", isCapture: true }]);
    expect(board.getPieceElement("b7")).toBeNull();
    const atA8 = root.querySelectorAll('.piece[data-square="a8"]');
    expect(atA8).toHaveLength(1);
    expect(atA8[0]?.getAttribute("data-piece")).toBe("wq");
  });
});

// Covers queen materialization after the move duration when animated.
describe("BoardAnimator.renderSnapshot — animated promotion", () => {
  it("shows the pawn in flight, then swaps it for the promoted piece", () => {
    vi.useFakeTimers();
    try {
      fixture = makeBoard({
        animationsEnabled: true,
        fen: "2k5/4P3/8/8/8/8/8/4K3 w - - 0 1",
      });
      const { board, root } = fixture;
      board.animator.options.autoSpeed = false;

      const store = new FenStore("2k5/4P3/8/8/8/8/8/4K3 w - - 0 1");
      const next = store.setFen("2k1Q3/8/8/8/8/8/8/4K3 b - - 0 1")!;
      board.applyFenDiff(next);

      expect(board.getPieceElement("e8")?.getAttribute("data-piece")).toBe(
        "wp",
      );

      vi.advanceTimersByTime(1000);

      const atE8 = root.querySelectorAll('.piece[data-square="e8"]');
      expect(atE8).toHaveLength(1);
      expect(atE8[0]?.getAttribute("data-piece")).toBe("wq");
    } finally {
      vi.useRealTimers();
    }
  });
});

// Covers underpromotion and black-side promotion appearance.
describe("BoardAnimator.renderSnapshot — promotion variants", () => {
  it("spawns a knight on underpromotion", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "2k5/4P3/8/8/8/8/8/4K3 w - - 0 1",
    });
    const { board, root } = fixture;

    const store = new FenStore("2k5/4P3/8/8/8/8/8/4K3 w - - 0 1");
    const next = store.setFen("2k1N3/8/8/8/8/8/8/4K3 b - - 0 1")!;
    board.applyFenDiff(next);

    const atE8 = root.querySelectorAll('.piece[data-square="e8"]');
    expect(atE8).toHaveLength(1);
    expect(atE8[0]?.getAttribute("data-piece")).toBe("wn");
  });

  it("spawns a black rook on black pawn promotion", () => {
    fixture = makeBoard({
      animationsEnabled: false,
      fen: "4k3/8/8/8/8/8/p7/4K3 b - - 0 1",
    });
    const { board, root } = fixture;

    const store = new FenStore("4k3/8/8/8/8/8/p7/4K3 b - - 0 1");
    const next = store.setFen("4k3/8/8/8/8/8/8/r3K3 w - - 0 1")!;
    board.applyFenDiff(next);

    expect(board.getPieceElement("a2")).toBeNull();
    const atA1 = root.querySelectorAll('.piece[data-square="a1"]');
    expect(atA1).toHaveLength(1);
    expect(atA1[0]?.getAttribute("data-piece")).toBe("br");
  });
});

// Covers Web Animations usage and cancelPending behavior.
describe("BoardAnimator animation plumbing", () => {
  it("uses the Web Animations API when durations are enabled", () => {
    fixture = makeBoard({ animationsEnabled: true });
    const { board } = fixture;
    const spy = vi.spyOn(Element.prototype, "animate");

    const oldMap = parseFenToMap(STANDARD_FEN);
    const newMap = clonePositionMap(oldMap);
    newMap.set("e2", null);
    newMap.set("e4", "wp");
    board.animator.renderSnapshot(oldMap, newMap);

    expect(spy).toHaveBeenCalled();
    board.animator.cancelPending();
  });

  it("cancelPending does not throw and can be called repeatedly", () => {
    fixture = makeBoard({ animationsEnabled: false });
    expect(() => {
      fixture!.board.animator.cancelPending();
      fixture!.board.animator.cancelPending();
    }).not.toThrow();
  });
});
