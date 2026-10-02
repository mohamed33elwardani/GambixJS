/**
 * Suite covering EventBus subscribe, once, unsubscribe, and emit behavior.
 */
import { describe, expect, it, vi } from "vitest";
import EventBus from "../../ts/src/events/event-bus.ts";

interface TestEvents {
  ping: { n: number };
  pong: Record<string, never>;
  text: string;
}

/**
 * Creates a fresh typed bus for a single test.
 * @returns A new EventBus instance.
 * Used by: EventBus test cases.
 */
function makeBus(): EventBus<TestEvents> {
  return new EventBus<TestEvents>();
}

/** Covers on() subscription and emit() delivery semantics. */
describe("EventBus.on / emit", () => {
  it("delivers payloads to subscribed handlers", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.on("ping", handler);
    bus.emit("ping", { n: 7 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ n: 7 });
  });

  it("supports multiple handlers per event", () => {
    const bus = makeBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("ping", a);
    bus.on("ping", b);
    bus.emit("ping", { n: 1 });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("does not call handlers of other events", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.on("pong", handler);
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("emitting with no listeners is a no-op", () => {
    const bus = makeBus();
    expect(() => bus.emit("ping", { n: 1 })).not.toThrow();
  });

  it("a throwing handler does not break the remaining handlers", () => {
    const bus = makeBus();
    const good = vi.fn();
    bus.on("ping", () => {
      throw new Error("boom");
    });
    bus.on("ping", good);
    expect(() => bus.emit("ping", { n: 1 })).not.toThrow();
    expect(good).toHaveBeenCalledTimes(1);
  });

  it("logs handler errors with the event name", () => {
    const bus = makeBus();
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      bus.on("ping", () => {
        throw new Error("boom");
      });
      bus.emit("ping", { n: 1 });
      expect(err).toHaveBeenCalledTimes(1);
      expect(String(err.mock.calls[0][0])).toContain("ping");
    } finally {
      err.mockRestore();
    }
  });
});

/** Covers unsubscribe closures and off() removal semantics. */
describe("EventBus unsubscribe / off", () => {
  it("returned unsubscribe function removes the handler", () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.on("ping", handler);
    off();
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("off removes a specific handler only", () => {
    const bus = makeBus();
    const a = vi.fn();
    const b = vi.fn();
    bus.on("ping", a);
    bus.on("ping", b);
    bus.off("ping", a);
    bus.emit("ping", { n: 1 });
    expect(a).not.toHaveBeenCalled();
    expect(b).toHaveBeenCalledTimes(1);
  });

  it("off on unknown event or handler is safe", () => {
    const bus = makeBus();
    expect(() => bus.off("ping", () => {})).not.toThrow();
  });
});

/** Covers once() single-fire, unsubscription, and re-registration behavior. */
describe("EventBus.once", () => {
  it("fires exactly once then auto-removes", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.once("ping", handler);
    bus.emit("ping", { n: 1 });
    bus.emit("ping", { n: 2 });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ n: 1 });
  });

  it("returned unsubscribe prevents the call before emit", () => {
    const bus = makeBus();
    const handler = vi.fn();
    const off = bus.once("ping", handler);
    off();
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("off removes a once-registered handler", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.once("ping", handler);
    bus.off("ping", handler);
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  // Each once() call creates an independent wrapper, so two registrations fire twice total.
  it("same handler registered once twice fires twice then never again", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.once("ping", handler);
    bus.once("ping", handler);
    bus.emit("ping", { n: 1 });
    expect(handler).toHaveBeenCalledTimes(2);
    bus.emit("ping", { n: 2 });
    expect(handler).toHaveBeenCalledTimes(2);
  });

  it("off removes every once-registration of the same handler", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.once("ping", handler);
    bus.once("ping", handler);
    bus.off("ping", handler);
    bus.emit("ping", { n: 1 });
    expect(handler).not.toHaveBeenCalled();
  });

  it("string payloads pass through untouched", () => {
    const bus = makeBus();
    const handler = vi.fn();
    bus.on("text", handler);
    bus.emit("text", "hello");
    expect(handler).toHaveBeenCalledWith("hello");
  });
});
