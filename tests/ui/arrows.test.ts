// Suite covering Arrows drawing, removal, orientation, events and lifecycle.
import { afterEach, describe, expect, it, vi } from "vitest";
import Arrows from "../../ts/src/ui/arrows.ts";
import EventBus from "../../ts/src/events/event-bus.ts";
import { DEFAULT_CONFIG } from "../../ts/src/config/defaults.ts";
import { deepMerge } from "../../ts/src/utils/object.ts";
import type { ChessEvents, DrawingConfig } from "../../ts/src/types/types.ts";

interface ArrowsFixture {
  container: HTMLElement;
  bus: EventBus<ChessEvents>;
  config: DrawingConfig;
  arrows: Arrows;
}

let current: ArrowsFixture | null = null;

// setup(): builds a fresh Arrows fixture; params: none; returns: container, bus, config and arrows.
function setup(): ArrowsFixture {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const bus = new EventBus<ChessEvents>();
  const config = deepMerge(structuredClone(DEFAULT_CONFIG.drawing), {});
  const arrows = new Arrows(config, bus, "white", () => container);
  current = { container, bus, config, arrows };
  return current;
}

afterEach(() => {
  current?.arrows.destroy();
  current = null;
  vi.restoreAllMocks();
});

// Covers basic arrow creation, validation and color updates.
describe("Arrows.drawArrow", () => {
  it("draws a valid arrow and records it", () => {
    const { arrows } = setup();
    expect(arrows.drawArrow("e2", "e4")).toBe(true);
    const list = arrows.getArrows();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      from: "e2",
      to: "e4",
      persistent: false,
    });
  });

  it("rejects identical squares and invalid squares", () => {
    const { arrows } = setup();
    expect(arrows.drawArrow("e4", "e4")).toBe(false);
    expect(arrows.drawArrow("e4", "z9")).toBe(false);
    expect(arrows.drawArrow("nope", "e4")).toBe(false);
    expect(arrows.getArrows()).toHaveLength(0);
  });

  it("returns false when redrawing the same arrow in the same color", () => {
    const { arrows } = setup();
    expect(arrows.drawArrow("e2", "e4", "red")).toBe(true);
    expect(arrows.drawArrow("e2", "e4", "red")).toBe(false);
    expect(arrows.getArrows()).toHaveLength(1);
  });

  it("updates the color when redrawing the same arrow", () => {
    const { arrows } = setup();
    arrows.drawArrow("e2", "e4", "red");
    expect(arrows.drawArrow("e2", "e4", "blue")).toBe(true);
    expect(arrows.getArrows()[0]?.color).toBe("blue");
  });

// Verifies width clamping at the 10 max and NaN fallback to 2.5.
  it("clamps custom widths", () => {
    const { arrows } = setup();
    arrows.drawArrow("a2", "a3", "red", false, 99);
    expect(arrows.getArrows()[0]?.width).toBe(10);
    arrows.drawArrow("b2", "b3", "red", false, Number.NaN);
    expect(arrows.getArrows()[1]?.width).toBe(2.5);
  });

  it("emits drawing:arrow-added for persistent arrows only", () => {
    const { arrows, bus } = setup();
    const added: unknown[] = [];
    bus.on("drawing:arrow-added", (p) => added.push(p));
    arrows.drawArrow("e2", "e4");
    expect(added).toHaveLength(0);
    arrows.drawArrow("a2", "a4", "red", true);
    expect(added).toHaveLength(1);
  });

  it("drawKnightArrow renders a bent path for knight jumps", () => {
    const { arrows, container } = setup();
    expect(arrows.drawKnightArrow("b1", "c3")).toBe(true);
    const svg = container.querySelector("svg");
    expect(svg?.querySelector("path")).not.toBeNull();
  });

  it("auto-detects knight jumps in drawArrow", () => {
    const { arrows, container } = setup();
    arrows.drawArrow("g1", "f3");
    expect(container.querySelector("svg path")).not.toBeNull();
  });
});

// Covers arrow removal and bulk clear behavior.
describe("Arrows removal", () => {
  it("removeArrow deletes existing arrows", () => {
    const { arrows } = setup();
    arrows.drawArrow("e2", "e4");
    expect(arrows.removeArrow("e2", "e4")).toBe(true);
    expect(arrows.removeArrow("e2", "e4")).toBe(false);
    expect(arrows.getArrows()).toHaveLength(0);
  });

  it("clearArrows keeps persistent arrows, clearArrowsAll removes everything", () => {
    const { arrows } = setup();
    arrows.drawArrow("e2", "e4");
    arrows.drawArrow("a2", "a4", "red", true);
    arrows.clearArrows();
    expect(arrows.getArrows().map((a) => a.from)).toEqual(["a2"]);
    arrows.clearArrowsAll();
    expect(arrows.getArrows()).toHaveLength(0);
  });
});

// Covers orientation changes and coordinate conversion.
describe("Arrows orientation / coords", () => {
  it("squareToCoords returns center ratios", () => {
    const { arrows } = setup();
    expect(arrows.squareToCoords("e4")).toEqual({ x: 4.5, y: 4.5 });
    arrows.setOrientation("black");
    expect(arrows.squareToCoords("e4")).toEqual({ x: 3.5, y: 3.5 });
  });

  it("setOrientation preserves arrows across re-render", () => {
    const { arrows } = setup();
    arrows.drawArrow("e2", "e4", "red", true);
    arrows.setOrientation("black");
    expect(arrows.getArrows()).toHaveLength(1);
    expect(arrows.getArrows()[0]).toMatchObject({ from: "e2", to: "e4" });
    arrows.setOrientation("black"); // no-op when unchanged
    expect(arrows.getArrows()).toHaveLength(1);
  });
});

// Covers draw gestures and key-based color switching via events.
describe("Arrows interaction events", () => {
  it("toggles user arrows on end-draw and emits events", () => {
    const { arrows, bus } = setup();
    const added: unknown[] = [];
    const removed: unknown[] = [];
    bus.on("drawing:arrow-added", (p) => added.push(p));
    bus.on("drawing:arrow-removed", (p) => removed.push(p));

    bus.emit("interaction:end-draw", { from: "e2", to: "e4" });
    expect(arrows.getArrows()).toHaveLength(1);
    expect(added).toHaveLength(1);

    bus.emit("interaction:end-draw", { from: "e2", to: "e4" });
    expect(arrows.getArrows()).toHaveLength(0);
    expect(removed).toHaveLength(1);
  });

  it("ignores draw gestures when drawing is disabled", () => {
    const { arrows, bus } = setup();
    arrows.disableDraw();
    bus.emit("interaction:end-draw", { from: "e2", to: "e4" });
    expect(arrows.getArrows()).toHaveLength(0);
    arrows.enableDraw();
    bus.emit("interaction:end-draw", { from: "e2", to: "e4" });
    expect(arrows.getArrows()).toHaveLength(1);
  });

  it("clear-draw clears user arrows and emits arrows-cleared", () => {
    const { arrows, bus } = setup();
    const cleared: unknown[] = [];
    bus.on("drawing:arrows-cleared", (p) => cleared.push(p));
    arrows.drawArrow("e2", "e4");
    bus.emit("interaction:clear-draw", {});
    expect(arrows.getArrows()).toHaveLength(0);
    expect(cleared).toHaveLength(1);
  });

// Checks Control-key mapping to the default secondary color.
  it("key-pressed switches the active color, key-up restores it", () => {
    const { arrows, bus } = setup();
    const mainline = arrows.activeColor;
    bus.emit("interaction:key-pressed", "Control");
    expect(arrows.activeColor).toBe("rgba(248, 85, 63, 0.8)");
    bus.emit("interaction:key-up", "");
    expect(arrows.activeColor).toBe(mainline);
  });
});

// Covers re-attach, config refresh and teardown.
describe("Arrows lifecycle", () => {
  it("reInit re-attaches a detached svg", () => {
    const { arrows, container } = setup();
    const svg = container.querySelector("svg")!;
    svg.remove();
    expect(container.querySelector("svg")).toBeNull();
    arrows.reInit();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("refreshFromConfig picks up new button colors", () => {
    const { arrows, bus } = setup();
    arrows.drawConfig.buttons.push({
      button: "Meta",
      color: "pink",
      lineWidth: 3,
    });
    arrows.refreshFromConfig();
    bus.emit("interaction:key-pressed", "Meta");
    expect(arrows.activeColor).toBe("pink");
  });

  it("destroy removes the svg and stops listening", () => {
    const { container, bus } = setup();
    const arrows = current!.arrows;
    arrows.destroy();
    expect(container.querySelector("svg")).toBeNull();
    current = null; // already destroyed; skip afterEach destroy
    expect(() => bus.emit("interaction:end-draw", { from: "e2", to: "e4" })).not.toThrow();
  });
});
