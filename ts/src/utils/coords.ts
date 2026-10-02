/**
 * GAMBIX Chessboard Coordinate & Geometry Utilities
 */

/**
 * Matches valid chess squares (files a-h, ranks 1-8).
 * Used by: isValidSquare.
 */
export const SQUARE_REGEX = /^[a-h][1-8]$/;

/**
 * Checks whether a string is a valid chess square name.
 * @param square - Candidate square string (e.g. "e4").
 * @returns True when the string matches files a-h and ranks 1-8.
 * Used by: isKnightJump, Arrows arrow validation.
 */
export function isValidSquare(square: string): boolean {
  return typeof square === "string" && SQUARE_REGEX.test(square);
}

/**
 * Returns the file index (0-7 for a-h) and rank index (0-7 for 1-8).
 */
/**
 * Converts a square name to zero-based file and rank indices.
 * @param square - Valid square name (e.g. "e4").
 * @returns File index (0-7) and rank index (0-7), or -1s when invalid.
 * Used by: squareToBoardCoords, isKnightJump.
 */
export function squareToFileRank(square: string): { file: number; rank: number } {
  if (!isValidSquare(square)) return { file: -1, rank: -1 };
  const file = square.charCodeAt(0) - 97; // 'a' -> 0
  const rank = parseInt(square[1]!, 10) - 1; // '1' -> 0
  return { file, rank };
}

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
export function squareToBoardCoords(
  square: string,
  orientation: "white" | "black",
  squareSize: number,
): { x: number; y: number } {
  const { file, rank } = squareToFileRank(square);
  const isFlipped = orientation === "black";
  const x = (isFlipped ? 7 - file : file) * squareSize;
  const y = (isFlipped ? rank : 7 - rank) * squareSize;
  return { x, y };
}

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
export function squareToCenterRatioCoords(
  square: string,
  orientation: "white" | "black" = "white",
): { x: number; y: number } {
  if (!isValidSquare(square)) return { x: -1, y: -1 };
  let file = square.charCodeAt(0) - 97;
  let rank = 7 - (square.charCodeAt(1) - 49);
  if (orientation === "black") {
    file = 7 - file;
    rank = 7 - rank;
  }
  return { x: file + 0.5, y: rank + 0.5 };
}

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
export function isKnightJump(from: string, to: string): boolean {
  if (!isValidSquare(from) || !isValidSquare(to)) return false;
  const f1 = squareToFileRank(from);
  const f2 = squareToFileRank(to);
  const df = Math.abs(f2.file - f1.file);
  const dr = Math.abs(f2.rank - f1.rank);
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}
