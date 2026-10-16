import type { BoardCell, FenDiff, PieceCode, PositionMap, SquareName } from "../types/types.ts";
export type { BoardCell, FenDiff, PieceCode, PositionMap, SquareName };
/**
 * Board file labels from a to h in display order.
 * Used by: parseFenToMap, ALL_SQUARES builder.
 */
export declare const FILES: readonly ["a", "b", "c", "d", "e", "f", "g", "h"];
/**
 * Board rank labels from 8 to 1 in display order.
 * Used by: parseFenToMap, ALL_SQUARES builder.
 */
export declare const RANKS: readonly ["8", "7", "6", "5", "4", "3", "2", "1"];
/**
 * All 64 square names in a8-h1 display order.
 * Used by: parseFenToMap, diffPositionMaps, FenStore.getBoard.
 */
export declare const ALL_SQUARES: SquareName[];
/**
 * Checks whether a value is a FEN string with valid piece placement.
 * @param fen - Unknown value to validate as FEN.
 * @returns True when the value is a string with valid placement.
 * Used by: FenStore constructor, FenStore.setFen, Gambix.loadFEN.
 */
export declare function isValidFen(fen: unknown): fen is string;
/**
 * Parses a FEN string into a 64-square position map.
 * @param fen - FEN string (only the placement field is read).
 * @returns Map from square name to piece code or null.
 * Used by: FenStore constructor, FenStore.setFen, tests/helpers.
 */
export declare function parseFenToMap(fen: string): PositionMap;
/**
 * Creates an independent copy of a position map.
 * @param map - Read-only source map to copy.
 * @returns New PositionMap with the same square entries.
 * Used by: FenStore.getPositionMapClone, FenStore.setFen, diff tests.
 */
export declare function clonePositionMap(map: ReadonlyMap<string, string | null>): PositionMap;
/**
 * Lists squares whose pieces differ between two position maps.
 * @param oldMap - Previous position map.
 * @param newMap - Next position map.
 * @returns Array of changed square names.
 * Used by: FenStore.setFen, Gambix.loadFEN via FenDiff.
 */
export declare function diffPositionMaps(oldMap: ReadonlyMap<string, string | null>, newMap: ReadonlyMap<string, string | null>): string[];
/**
 * Stores the current FEN and its parsed board position.
 * Used by: Gambix (loadFEN, getBoard, getPiece), Board tests.
 */
export declare class FenStore {
    private fen;
    private position;
    /**
     * Creates a store from an initial FEN string.
     * @param initialFen - Seed FEN string, must pass isValidFen.
     * @returns Nothing.
     * Used by: Gambix constructor, Board and interaction tests.
     */
    constructor(initialFen: string);
    /**
     * Returns the current FEN string.
     * @returns The stored FEN string.
     * Used by: Gambix.getFEN, FenStore.setFen diff.
     */
    getFen(): string;
    /**
     * Returns a read-only view of the current position map.
     * @returns Read-only map of square to piece code or null.
     * Used by: Gambix Board construction, Highlights setup.
     */
    getPositionMap(): ReadonlyMap<string, string | null>;
    /**
     * Returns an independent copy of the current position map.
     * @returns Cloned PositionMap safe for mutation.
     * Used by: BoardAnimator tests, FenStore diff snapshots.
     */
    getPositionMapClone(): PositionMap;
    /**
     * Returns the board as an ordered list of square-piece cells.
     * @returns Array of 64 BoardCell entries in ALL_SQUARES order.
     * Used by: Gambix.getBoard, Board rendering.
     */
    getBoard(): BoardCell[];
    /**
     * Returns the piece on a square split into color and type.
     * @param square - Square name to inspect.
     * @returns Object with color and type, or null when empty.
     * Used by: Gambix PromotionManager, promotion tests.
     */
    getPiece(square: string): {
        type: string;
        color: string;
    } | null;
    /**
     * Returns the raw piece code stored on a square.
     * @param square - Square name to inspect.
     * @returns Piece code (e.g. "wp") or null when empty.
     * Used by: Gambix Interaction and core event wiring.
     */
    getPieceCode(square: string): PieceCode | null;
    /**
     * Checks whether a square currently holds a piece.
     * @param square - Square name to inspect.
     * @returns True when a piece code is stored on the square.
     * Used by: Gambix Highlights legal-move display.
     */
    hasPiece(square: string): boolean;
    /**
     * Replaces the stored FEN and reports what changed.
     * @param nextFen - Candidate next FEN string.
     * @returns FenDiff with old/new state, or null when rejected.
     * Used by: Gambix.loadFEN, Board.applyFenDiff flow.
     */
    setFen(nextFen: string): FenDiff | null;
}
