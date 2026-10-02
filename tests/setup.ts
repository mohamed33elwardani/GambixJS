import { beforeEach, vi } from "vitest";

/**
 * Global test setup for the Gambix test suite (vitest + jsdom).
 *
 * - Stubs ResizeObserver (not implemented by jsdom).
 * - Stubs the Web Animations API (Element.animate / getAnimations).
 * - Polyfills CSS.escape if the environment lacks it.
 * - Exposes a controllable mock clock helper for ResizeObserver callbacks.
 */

/**
 * Controllable ResizeObserver stub for jsdom (records instances/targets).
 * Used by: auto-resize tests via MockResizeObserver.instances.
 */
class MockResizeObserver {
  public static instances: MockResizeObserver[] = [];

  public readonly targets = new Set<Element>();
  private readonly callback: ResizeObserverCallback;

  /**
   * Stores the observe callback and registers the instance.
   * @param callback - ResizeObserver callback to invoke on trigger().
   * @returns Nothing (constructor).
   * Used by: Board.enableAutoResize.
   */
  public constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    MockResizeObserver.instances.push(this);
  }

  /**
   * Starts observing a target element.
   * @param target - Element to observe.
   * @returns Nothing.
   * Used by: Board.enableAutoResize.
   */
  public observe(target: Element): void {
    this.targets.add(target);
  }

  /**
   * Stops observing a target element.
   * @param target - Element to stop observing.
   * @returns Nothing.
   * Used by: Board teardown paths.
   */
  public unobserve(target: Element): void {
    this.targets.delete(target);
  }

  /**
   * Clears all observed targets.
   * @returns Nothing.
   * Used by: Board.disableAutoResize.
   */
  public disconnect(): void {
    this.targets.clear();
  }

  /**
   * Simulates a resize notification for all observed targets.
   * @param width - Reported content width. @param height - Reported content height.
   * @returns Nothing.
   * Used by: auto-resize tests.
   */
  public trigger(width = 600, height = 600): void {
    const entries = [...this.targets].map(
      (target) =>
        ({
          target,
          contentRect: { width, height },
        }) as unknown as ResizeObserverEntry,
    );
    this.callback(entries, this as unknown as ResizeObserver);
  }
}

vi.stubGlobal("ResizeObserver", MockResizeObserver);

interface MockAnimation {
  onfinish: (() => void) | null;
  oncancel: (() => void) | null;
  finished: Promise<void>;
  finish(): void;
  cancel(): void;
}

/**
 * Creates a mock Web Animation with manually fired finish/cancel.
 * @returns A MockAnimation tied to a deferred finished promise.
 * Used by: Element.animate stub in jsdom.
 */
function createMockAnimation(): MockAnimation {
  let resolveFinished!: () => void;
  const finished = new Promise<void>((resolve) => {
    resolveFinished = resolve;
  });
  const anim: MockAnimation = {
    onfinish: null,
    oncancel: null,
    finished,
    finish() {
      resolveFinished();
      anim.onfinish?.();
    },
    cancel() {
      resolveFinished();
      anim.oncancel?.();
    },
  };
  return anim;
}

if (typeof Element.prototype.animate !== "function") {
  (Element.prototype as unknown as Record<string, unknown>).animate = function (
    this: Element,
  ): MockAnimation {
    void this;
    return createMockAnimation();
  };
}

if (typeof Element.prototype.getAnimations !== "function") {
  (Element.prototype as unknown as Record<string, unknown>).getAnimations =
    function (this: Element): Animation[] {
      void this;
      return [];
    };
}

const cssGlobal = (globalThis as unknown as Record<string, unknown>).CSS as
  | { escape?: (value: string) => string }
  | undefined;

if (!cssGlobal || typeof cssGlobal.escape !== "function") {
  vi.stubGlobal("CSS", {
    ...(typeof cssGlobal === "object" && cssGlobal !== null ? cssGlobal : {}),
    escape: (value: string): string =>
      String(value).replace(/[^a-zA-Z0-9_-]/g, (ch) => `\\${ch}`),
  });
}

beforeEach(() => {
  MockResizeObserver.instances.length = 0;
  document.body.innerHTML = "";
});

export { MockResizeObserver };
