/**
 * Tests for DOM translate/transform reading utilities.
 */
import { describe, expect, it } from "vitest";
import { readCurrentTranslate } from "../../ts/src/utils/dom.ts";

/**
 * Creates a detached div element for translate tests.
 * @returns A fresh HTMLElement with no applied styles.
 */
function makeElement(): HTMLElement {
  return document.createElement("div");
}

// Covers reading inline translate, computed style and matrix fallbacks.
describe("readCurrentTranslate", () => {
  it("reads inline translate style", () => {
    const el = makeElement();
    el.style.translate = "10px 20px";
    expect(readCurrentTranslate(el)).toEqual({ x: 10, y: 20 });
  });

  it("handles negative and fractional values", () => {
    const el = makeElement();
    el.style.translate = "-5.5px 0.25px";
    expect(readCurrentTranslate(el)).toEqual({ x: -5.5, y: 0.25 });
  });

  it("returns null when translate is none and no transform", () => {
    const el = makeElement();
    document.body.appendChild(el);
    try {
      expect(readCurrentTranslate(el)).toBeNull();
    } finally {
      el.remove();
    }
  });

  // Invalid inline values are dropped by the CSS parser, so computed style is null.
  it("returns null for unparseable translate values", () => {
    const el = makeElement();
    el.style.translate = "oops";
    document.body.appendChild(el);
    try {
      // inline "oops" is dropped by the CSS parser -> falls back to computed
      expect(readCurrentTranslate(el)).toBeNull();
    } finally {
      el.remove();
    }
  });

  it("parses 2d matrix transforms", () => {
    const el = makeElement();
    el.style.transform = "matrix(1, 0, 0, 1, 30, 40)";
    document.body.appendChild(el);
    try {
      expect(readCurrentTranslate(el)).toEqual({ x: 30, y: 40 });
    } finally {
      el.remove();
    }
  });

  it("parses 3d matrix transforms via indices 12/13", () => {
    const el = makeElement();
    el.style.transform =
      "matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 11, 22, 0, 1)";
    document.body.appendChild(el);
    try {
      expect(readCurrentTranslate(el)).toEqual({ x: 11, y: 22 });
    } finally {
      el.remove();
    }
  });
});
