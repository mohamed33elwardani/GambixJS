/**
 * GAMBIX Chessboard Coordinate & Geometry Utilities
 */
/**
 * Matches valid chess squares (files a-h, ranks 1-8).
 * Used by: isValidSquare.
 */
export declare const SQUARE_REGEX: RegExp;
/**
 * Checks whether a string is a valid chess square name.
 * @param square - Candidate square string (e.g. "e4").
 * @returns True when the string matches files a-h and ranks 1-8.
 * Used by: isKnightJump, Arrows arrow validation.
 */
export declare function isValidSquare(square: string): boolean;
/**
 * Returns the file index (0-7 for a-h) and rank index (0-7 for 1-8).
 */
/**
 * Converts a square name to zero-based file and rank indices.
 * @param square - Valid square name (e.g. "e4").
 * @returns File index (0-7) and rank index (0-7), or -1s when invalid.
 * Used by: squareToBoardCoords, isKnightJump.
 */
export declare function squareToFileRank(square: string): {
    file: number;
    rank: number;
};
/**
 * Returns the top-left coordinate in pixels on the board grid.
 */
/**
 * Converts a square to pixel coordinates for the board grid.
 * @param square - Valid square name (e.g. "e4").
 * @param orientation - Board orientation ("white" or "black").
 * @param squareSize - Pixel size of one square.
 * @returns Top-left pixel position { x, y } of the square.
 * Used by: Board layout rendering, coords tests (no current src caller).
 */
export declare function squareToBoardCoords(square: string, orientation: "white" | "black", squareSize: number): {
    x: number;
    y: number;
};
/**
 * Returns the 0..8 coordinate normalized to square centers (e.g. e4 -> { x: 4.5, y: 4.5 })
 */
/**
 * Converts a square to 0-8 ratio coordinates at the square center.
 * @param square - Valid square name (e.g. "e4").
 * @param orientation - Board orientation, defaults to "white".
 * @returns Center position in board-ratio units { x, y }, or -1s when invalid.
 * Used by: Arrows.getSquareCenter.
 */
export declare function squareToCenterRatioCoords(square: string, orientation?: "white" | "black"): {
    x: number;
    y: number;
};
/**
 * Determines whether a move between two squares is an L-shaped knight leap.
 */
/**
 * Checks whether moving from one square to another is a knight leap.
 * @param from - Origin square name.
 * @param to - Destination square name.
 * @returns True for L-shaped (1x2) moves between valid squares.
 * Used by: Arrows.drawArrow (curved knight arrows).
 */
export declare function isKnightJump(from: string, to: string): boolean;
