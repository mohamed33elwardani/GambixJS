import type {
  BoardCell,
  FenDiff,
  PieceCode,
  PositionMap,
  SquareName,
} from "../types/types.ts";

export type { BoardCell, FenDiff, PieceCode, PositionMap, SquareName };

/**
 * Board file labels from a to h in display order.
 * Used by: parseFenToMap, ALL_SQUARES builder.
 */
export const FILES = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
/**
 * Board rank labels from 8 to 1 in display order.
 * Used by: parseFenToMap, ALL_SQUARES builder.
 */
export const RANKS = ["8", "7", "6", "5", "4", "3", "2", "1"] as const;

/**
 * All 64 square names in a8-h1 display order.
 * Used by: parseFenToMap, diffPositionMaps, FenStore.getBoard.
 */
export const ALL_SQUARES: SquareName[] = (() => {
  const out: string[] = [];

  for (const r of RANKS) for (const f of FILES) out.push(`${f}${r}`);

  return out;
})();

/**
 * Validates the piece-placement section of a FEN string.
 * @param placement - Slash-separated 8-row placement field.
 * @returns True when all rows are valid and each sums to 8 squares.
 * Used by: isValidFen.
 */
function isValidPlacement(placement: string): boolean {
  const rows = placement.split("/");

  if (rows.length !== 8) return false;

  for (const row of rows) {
    if (!row || !/^[rnbqkpRNBQKP1-8]+$/.test(row)) return false;
    if (/\d\d/.test(row)) return false;

    let sum = 0;

    for (const ch of row) {
      if (/\d/.test(ch)) {
        sum += Number(ch);
      } else {
        sum += 1;
      }
    }

    if (sum !== 8) return false;
  }

  return true;
}

/**
 * Checks whether a value is a FEN string with valid piece placement.
 * @param fen - Unknown value to validate as FEN.
 * @returns True when the value is a string with valid placement.
 * Used by: FenStore constructor, FenStore.setFen, Gambix.loadFEN.
 */
export function isValidFen(fen: unknown): fen is string {
  if (typeof fen !== "string") return false;

  const placement = fen.trim().split(/\s+/)[0];

  return placement ? isValidPlacement(placement) : false;
}

/**
 * Parses a FEN string into a 64-square position map.
 * @param fen - FEN string (only the placement field is read).
 * @returns Map from square name to piece code or null.
 * Used by: FenStore constructor, FenStore.setFen, tests/helpers.
 */
export function parseFenToMap(fen: string): PositionMap {
  const map: PositionMap = new Map();
  for (const sq of ALL_SQUARES) map.set(sq, null);

  const placement = fen.trim().split(/\s+/)[0] ?? "";

  const rows = placement.split("/");

  for (let r = 0; r < 8; r++) {
    const row = rows[r] ?? "";
    let fileIdx = 0;

    for (const rowPiecesStr of row) {
      if (fileIdx >= 8) break;

      if (/\d/.test(rowPiecesStr)) {
        fileIdx += Number(rowPiecesStr);
      } else if (/[rnbqkpRNBQKP]/.test(rowPiecesStr)) {
        const sq = `${FILES[fileIdx]!}${RANKS[r]!}`;

        map.set(
          sq,
          `${rowPiecesStr === rowPiecesStr.toUpperCase() ? "w" : "b"}${rowPiecesStr.toLowerCase()}`,
        );

        fileIdx++;
      }
    }
  }

  return map;
}

/**
 * Creates an independent copy of a position map.
 * @param map - Read-only source map to copy.
 * @returns New PositionMap with the same square entries.
 * Used by: FenStore.getPositionMapClone, FenStore.setFen, diff tests.
 */
export function clonePositionMap(
  map: ReadonlyMap<string, string | null>,
): PositionMap {
  return new Map<string, string | null>(map);
}

/**
 * Lists squares whose pieces differ between two position maps.
 * @param oldMap - Previous position map.
 * @param newMap - Next position map.
 * @returns Array of changed square names.
 * Used by: FenStore.setFen, Gambix.loadFEN via FenDiff.
 */
export function diffPositionMaps(
  oldMap: ReadonlyMap<string, string | null>,
  newMap: ReadonlyMap<string, string | null>,
): string[] {
  const changed: string[] = [];

  for (const sq of ALL_SQUARES) {
    if (oldMap.get(sq) !== newMap.get(sq)) changed.push(sq);
  }

  return changed;
}

/**
 * Stores the current FEN and its parsed board position.
 * Used by: Gambix (loadFEN, getBoard, getPiece), Board tests.
 */
export class FenStore {
  private fen: string;
  private position: PositionMap;

/**
 * Creates a store from an initial FEN string.
 * @param initialFen - Seed FEN string, must pass isValidFen.
 * @returns Nothing.
 * Used by: Gambix constructor, Board and interaction tests.
 */
  constructor(initialFen: string) {
    if (!isValidFen(initialFen)) {
      throw new Error("invalid fen");
    }

    const seed = initialFen.trim();

    this.fen = seed;
    this.position = parseFenToMap(this.fen);
  }

/**
 * Returns the current FEN string.
 * @returns The stored FEN string.
 * Used by: Gambix.getFEN, FenStore.setFen diff.
 */
  public getFen(): string {
    return this.fen;
  }

/**
 * Returns a read-only view of the current position map.
 * @returns Read-only map of square to piece code or null.
 * Used by: Gambix Board construction, Highlights setup.
 */
  public getPositionMap(): ReadonlyMap<string, string | null> {
    return this.position;
  }

/**
 * Returns an independent copy of the current position map.
 * @returns Cloned PositionMap safe for mutation.
 * Used by: BoardAnimator tests, FenStore diff snapshots.
 */
  public getPositionMapClone(): PositionMap {
    return clonePositionMap(this.position);
  }

/**
 * Returns the board as an ordered list of square-piece cells.
 * @returns Array of 64 BoardCell entries in ALL_SQUARES order.
 * Used by: Gambix.getBoard, Board rendering.
 */
  public getBoard(): BoardCell[] {
    const out: BoardCell[] = [];
    for (const sq of ALL_SQUARES) {
      out.push({ square: sq, piece: this.position.get(sq) ?? null });
    }
    return out;
  }

/**
 * Returns the piece on a square split into color and type.
 * @param square - Square name to inspect.
 * @returns Object with color and type, or null when empty.
 * Used by: Gambix PromotionManager, promotion tests.
 */
  public getPiece(square: string): { type: string; color: string } | null {
    if (!square) return null;
    const p = this.position.get(square);
    if (!p) return null;
    return { color: p.charAt(0), type: p.charAt(1) };
  }

/**
 * Returns the raw piece code stored on a square.
 * @param square - Square name to inspect.
 * @returns Piece code (e.g. "wp") or null when empty.
 * Used by: Gambix Interaction and core event wiring.
 */
  public getPieceCode(square: string): PieceCode | null {
    return this.position.get(square) ?? null;
  }

/**
 * Checks whether a square currently holds a piece.
 * @param square - Square name to inspect.
 * @returns True when a piece code is stored on the square.
 * Used by: Gambix Highlights legal-move display.
 */
  public hasPiece(square: string): boolean {
    return !!this.position.get(square);
  }

/**
 * Replaces the stored FEN and reports what changed.
 * @param nextFen - Candidate next FEN string.
 * @returns FenDiff with old/new state, or null when rejected.
 * Used by: Gambix.loadFEN, Board.applyFenDiff flow.
 */
  public setFen(nextFen: string): FenDiff | null {
    if (typeof nextFen !== "string") return null;
    const next = nextFen.trim();
    if (!next) return null;

    if (next === this.fen) {
      return {
        oldFen: this.fen,
        newFen: this.fen,
        oldMap: clonePositionMap(this.position),
        newMap: clonePositionMap(this.position),
        changed: [],
      };
    }

    if (!isValidFen(nextFen)) {
      console.warn(`FenStore: rejected invalid FEN "${next.slice(0, 80)}"`);
      return null;
    }

    const oldFen = this.fen;

    const oldMap = clonePositionMap(this.position);

    const newMap = parseFenToMap(next);

    this.fen = next;

    this.position = newMap;

    return {
      oldFen,
      newFen: next,
      oldMap,
      newMap: clonePositionMap(newMap),
      changed: diffPositionMaps(oldMap, newMap),
    };
  }
}
