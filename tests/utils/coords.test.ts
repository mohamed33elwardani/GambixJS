/**
 * Tests for chessboard coordinate and geometry utilities.
 */
import { describe, expect, it } from "vitest";
import {
  isKnightJump,
  isValidSquare,
  squareToBoardCoords,
  squareToCenterRatioCoords,
  squareToFileRank,
} from "../../ts/src/utils/coords.ts";

// Covers square-name validation for files a-h and ranks 1-8.
describe("isValidSquare", () => {
  it("accepts valid squares", () => {
    expect(isValidSquare("a1")).toBe(true);
    expect(isValidSquare("h8")).toBe(true);
    expect(isValidSquare("e4")).toBe(true);
  });

  it("rejects invalid squares", () => {
    expect(isValidSquare("i1")).toBe(false);
    expect(isValidSquare("a9")).toBe(false);
    expect(isValidSquare("e")).toBe(false);
    expect(isValidSquare("")).toBe(false);
    expect(isValidSquare("E4")).toBe(false);
    expect(isValidSquare("a10")).toBe(false);
  });
});

// Covers conversion from square names to file/rank indices.
describe("squareToFileRank", () => {
  it("maps corners correctly", () => {
    expect(squareToFileRank("a1")).toEqual({ file: 0, rank: 0 });
    expect(squareToFileRank("h1")).toEqual({ file: 7, rank: 0 });
    expect(squareToFileRank("a8")).toEqual({ file: 0, rank: 7 });
    expect(squareToFileRank("h8")).toEqual({ file: 7, rank: 7 });
  });

  it("maps a middle square", () => {
    expect(squareToFileRank("e4")).toEqual({ file: 4, rank: 3 });
  });
});

// Covers pixel-coordinate mapping with orientation and square size.
describe("squareToBoardCoords", () => {
  it("computes white-orientation pixel coords", () => {
    // file=4, rank=1 -> x=4*100, y=(7-1)*100
    expect(squareToBoardCoords("e2", "white", 100)).toEqual({ x: 400, y: 600 });
    expect(squareToBoardCoords("a8", "white", 100)).toEqual({ x: 0, y: 0 });
    expect(squareToBoardCoords("h1", "white", 100)).toEqual({ x: 700, y: 700 });
  });

  it("flips coords for black orientation", () => {
    expect(squareToBoardCoords("e2", "black", 100)).toEqual({ x: 300, y: 100 });
    expect(squareToBoardCoords("a8", "black", 100)).toEqual({ x: 700, y: 700 });
    expect(squareToBoardCoords("h1", "black", 100)).toEqual({ x: 0, y: 0 });
  });

  it("scales with square size", () => {
    expect(squareToBoardCoords("a1", "white", 50)).toEqual({ x: 0, y: 350 });
  });
});

// Covers ratio-coordinate mapping to square centers with mirroring.
describe("squareToCenterRatioCoords", () => {
  it("returns center ratios for white orientation", () => {
    expect(squareToCenterRatioCoords("e4")).toEqual({ x: 4.5, y: 4.5 });
    expect(squareToCenterRatioCoords("a8", "white")).toEqual({ x: 0.5, y: 0.5 });
    expect(squareToCenterRatioCoords("h1", "white")).toEqual({ x: 7.5, y: 7.5 });
  });

  it("mirrors ratios for black orientation", () => {
    expect(squareToCenterRatioCoords("e4", "black")).toEqual({ x: 3.5, y: 3.5 });
    expect(squareToCenterRatioCoords("a8", "black")).toEqual({ x: 7.5, y: 7.5 });
  });
});

// Covers L-shaped knight-move detection including invalid input.
describe("isKnightJump", () => {
  it("detects L-shaped jumps", () => {
    expect(isKnightJump("b1", "c3")).toBe(true);
    expect(isKnightJump("g1", "f3")).toBe(true);
    expect(isKnightJump("e4", "d6")).toBe(true);
    expect(isKnightJump("e4", "c5")).toBe(true);
  });

  it("rejects non-knight moves", () => {
    expect(isKnightJump("e2", "e4")).toBe(false);
    expect(isKnightJump("e4", "e4")).toBe(false);
    expect(isKnightJump("a1", "b2")).toBe(false);
    expect(isKnightJump("a1", "c3")).toBe(false);
  });

  it("rejects invalid squares", () => {
    expect(isKnightJump("e4", "z9")).toBe(false);
    expect(isKnightJump("", "e4")).toBe(false);
  });
});
