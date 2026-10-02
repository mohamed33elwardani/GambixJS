/**
 * Tests for recursive object merging without mutating defaults.
 */
import { describe, expect, it } from "vitest";
import { deepMerge } from "../../ts/src/utils/object.ts";

// Covers deep merging, undefined-skipping, arrays and target immutability.
describe("deepMerge", () => {
  it("merges flat objects with source winning", () => {
    expect(deepMerge({ a: 1, b: 2 }, { b: 3 })).toEqual({ a: 1, b: 3 });
  });

  it("merges nested objects recursively", () => {
    const target = { theme: { orientation: "white", size: 600 } };
    const out = deepMerge(target, { theme: { size: 800 } });
    expect(out).toEqual({ theme: { orientation: "white", size: 800 } });
  });

  it("ignores undefined source properties", () => {
    const out = deepMerge({ a: 1 }, { a: undefined, b: 2 });
    expect(out).toEqual({ a: 1, b: 2 });
  });

  it("overrides arrays and primitives wholesale", () => {
    expect(deepMerge({ list: [1, 2] }, { list: [3] })).toEqual({ list: [3] });
    expect(deepMerge({ a: { x: 1 } }, { a: 5 })).toEqual({ a: 5 });
    expect(deepMerge({ a: 5 }, { a: { x: 1 } })).toEqual({ a: { x: 1 } });
  });

  it("does not mutate the target", () => {
    const target = { nested: { v: 1 } };
    deepMerge(target, { nested: { v: 2 } });
    expect(target).toEqual({ nested: { v: 1 } });
  });

  it("returns a copy of target for nullish / non-object sources", () => {
    const target = { a: 1 };
    expect(deepMerge(target, null)).toEqual({ a: 1 });
    expect(deepMerge(target, undefined)).toEqual({ a: 1 });
    expect(deepMerge(target, 42)).toEqual({ a: 1 });
    const out = deepMerge(target, null);
    expect(out).not.toBe(target);
  });

  it("handles deep nesting levels", () => {
    const out = deepMerge(
      { a: { b: { c: { d: 1, e: 2 } } } },
      { a: { b: { c: { e: 3 } } } },
    );
    expect(out).toEqual({ a: { b: { c: { d: 1, e: 3 } } } });
  });
});
