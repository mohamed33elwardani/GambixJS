/**
 * Tests for FEN validation, parsing, cloning, diffing and FenStore.
 */
import { describe, expect, it, vi } from "vitest";
import {
  ALL_SQUARES,
  FenStore,
  clonePositionMap,
  diffPositionMaps,
  isValidFen,
  parseFenToMap,
} from "../../ts/src/utils/fen.ts";
import { STANDARD_FEN } from "../../ts/src/config/defaults.ts";

// Covers FEN placement validation for valid and malformed inputs.
describe("isValidFen", () => {
  it("accepts the standard starting position", () => {
    expect(isValidFen(STANDARD_FEN)).toBe(true);
  });

  it("accepts placement-only strings", () => {
    expect(isValidFen("rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(true);
  });

  it("accepts empty-board-adjacent valid placements with digits", () => {
    expect(isValidFen("8/8/8/8/8/8/8/8 w - - 0 1")).toBe(true);
  });

  it("rejects non-string input", () => {
    expect(isValidFen(null)).toBe(false);
    expect(isValidFen(undefined)).toBe(false);
    expect(isValidFen(123)).toBe(false);
    expect(isValidFen({})).toBe(false);
  });

  it("rejects empty / whitespace strings", () => {
    expect(isValidFen("")).toBe(false);
    expect(isValidFen("   ")).toBe(false);
  });

  it("rejects wrong row counts", () => {
    expect(isValidFen("8/8/8/8/8/8/8")).toBe(false);
    expect(isValidFen("8/8/8/8/8/8/8/8/8 w - - 0 1")).toBe(false);
  });

  it("rejects invalid piece characters", () => {
    expect(isValidFen("xnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });

  it("rejects consecutive digits in a row", () => {
    expect(isValidFen("rnbqkbnr/pppppppp/71/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });

  it("rejects rows that do not sum to 8", () => {
    expect(isValidFen("rnbqkbnr/pppppppp/7/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
    expect(isValidFen("rnbqkbnr/pppppppp/9/8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });

  it("rejects empty rows", () => {
    expect(isValidFen("rnbqkbnr/pppppppp//8/8/8/PPPPPPPP/RNBQKBNR")).toBe(false);
  });
});

// Covers parsing FEN placement into a 64-square position map.
describe("parseFenToMap", () => {
  it("creates all 64 squares", () => {
    const map = parseFenToMap(STANDARD_FEN);
    expect(map.size).toBe(64);
    expect(ALL_SQUARES).toHaveLength(64);
    for (const sq of ALL_SQUARES) {
      expect(map.has(sq)).toBe(true);
    }
  });

  it("maps standard position pieces with wb-prefix codes", () => {
    const map = parseFenToMap(STANDARD_FEN);
    expect(map.get("a8")).toBe("br");
    expect(map.get("e8")).toBe("bk");
    expect(map.get("a7")).toBe("bp");
    expect(map.get("e4")).toBeNull();
    expect(map.get("e2")).toBe("wp");
    expect(map.get("a1")).toBe("wr");
    expect(map.get("e1")).toBe("wk");
    expect(map.get("d1")).toBe("wq");
    expect(map.get("c1")).toBe("wb");
    expect(map.get("b1")).toBe("wn");
  });

  it("ignores everything after the placement token", () => {
    const map = parseFenToMap(`${STANDARD_FEN} extra tokens here`);
    expect(map.get("e2")).toBe("wp");
  });

  it("leaves empty squares as null", () => {
    const map = parseFenToMap("8/8/8/8/8/8/8/8 w - - 0 1");
    for (const sq of ALL_SQUARES) {
      expect(map.get(sq)).toBeNull();
    }
  });
});

// Covers map cloning independence and square-by-square diffing.
describe("clonePositionMap / diffPositionMaps", () => {
  it("clones without sharing references", () => {
    const map = parseFenToMap(STANDARD_FEN);
    const clone = clonePositionMap(map);
    expect(clone).toEqual(map);
    expect(clone).not.toBe(map);
    clone.set("e4", "wp");
    expect(map.get("e4")).toBeNull();
  });

  it("diffs two maps square by square", () => {
    const a = parseFenToMap(STANDARD_FEN);
    const b = clonePositionMap(a);
    expect(diffPositionMaps(a, b)).toEqual([]);
    b.set("e2", null);
    b.set("e4", "wp");
    expect(diffPositionMaps(a, b).sort()).toEqual(["e2", "e4"]);
  });
});

// Covers FenStore state, getters and setFen update/reject paths.
describe("FenStore", () => {
  it("throws on invalid initial FEN", () => {
    expect(() => new FenStore("nope")).toThrow("invalid fen");
    expect(() => new FenStore("")).toThrow("invalid fen");
  });

  it("trims and stores the seed FEN", () => {
    const store = new FenStore(`  ${STANDARD_FEN}  `);
    expect(store.getFen()).toBe(STANDARD_FEN);
  });

  it("exposes position map, board, piece getters", () => {
    const store = new FenStore(STANDARD_FEN);
    expect(store.getPositionMap().size).toBe(64);

    const clone = store.getPositionMapClone();
    expect(clone).toEqual(store.getPositionMap());
    expect(clone).not.toBe(store.getPositionMap());

    const board = store.getBoard();
    expect(board).toHaveLength(64);
    expect(board[0]).toEqual({ square: "a8", piece: "br" });
    expect(board.find((c) => c.square === "e4")).toEqual({
      square: "e4",
      piece: null,
    });

    expect(store.getPiece("e2")).toEqual({ color: "w", type: "p" });
    expect(store.getPiece("e8")).toEqual({ color: "b", type: "k" });
    expect(store.getPiece("e4")).toBeNull();
    expect(store.getPiece("")).toBeNull();

    expect(store.getPieceCode("a1")).toBe("wr");
    expect(store.getPieceCode("e4")).toBeNull();

    expect(store.hasPiece("e2")).toBe(true);
    expect(store.hasPiece("e4")).toBe(false);
  });

  it("setFen returns null for non-string / empty input", () => {
    const store = new FenStore(STANDARD_FEN);
    expect(store.setFen(123 as unknown as string)).toBeNull();
    expect(store.setFen("   ")).toBeNull();
    expect(store.getFen()).toBe(STANDARD_FEN);
  });

  it("setFen returns an empty diff for the identical FEN", () => {
    const store = new FenStore(STANDARD_FEN);
    const diff = store.setFen(STANDARD_FEN);
    expect(diff).not.toBeNull();
    expect(diff!.changed).toEqual([]);
    expect(diff!.oldFen).toBe(STANDARD_FEN);
    expect(diff!.newFen).toBe(STANDARD_FEN);
  });

  // Verifies invalid FEN is rejected with a console warning and unchanged state.
  it("setFen rejects invalid FEN with a warning and keeps state", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const store = new FenStore(STANDARD_FEN);
    try {
      expect(store.setFen("garbage")).toBeNull();
      expect(store.getFen()).toBe(STANDARD_FEN);
      expect(store.getPieceCode("e2")).toBe("wp");
      expect(warn).toHaveBeenCalledOnce();
    } finally {
      warn.mockRestore();
    }
  });

  it("setFen applies a valid new FEN and reports the diff", () => {
    const store = new FenStore(STANDARD_FEN);
    const next = "rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1";
    const diff = store.setFen(next);
    expect(diff).not.toBeNull();
    expect(diff!.oldFen).toBe(STANDARD_FEN);
    expect(diff!.newFen).toBe(next);
    expect(diff!.changed.sort()).toEqual(["e2", "e4"]);
    expect(store.getFen()).toBe(next);
    expect(store.getPieceCode("e2")).toBeNull();
    expect(store.getPieceCode("e4")).toBe("wp");
    // oldMap snapshot must be unaffected by the update
    expect(diff!.oldMap.get("e2")).toBe("wp");
  });
});
