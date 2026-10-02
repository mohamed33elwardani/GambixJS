// Shared test helpers: board fixtures, event dispatchers, and async flush.
// Used by: all tests under tests/ui and tests/gambix.test.ts.
import EventBus from "../ts/src/events/event-bus.ts";
import Board from "../ts/src/ui/board.ts";
import { DEFAULT_CONFIG, STANDARD_FEN } from "../ts/src/config/defaults.ts";
import { deepMerge } from "../ts/src/utils/object.ts";
import { parseFenToMap } from "../ts/src/utils/fen.ts";
import type {
  BoardAnimationOptions,
  ChessEvents,
  ThemeConfig,
} from "../ts/src/types/types.ts";

export interface BoardFixture {
  root: HTMLElement;
  bus: EventBus<ChessEvents>;
  theme: ThemeConfig;
  animations: BoardAnimationOptions;
  board: Board;
}

/**
 * Creates a fresh typed event bus for a test.
 * @returns A new EventBus<ChessEvents>.
 * Used by: makeBoard and interaction/promotion test fixtures.
 */
export function makeEventBus(): EventBus<ChessEvents> {
  return new EventBus<ChessEvents>();
}

/**
 * Builds a real Board inside an attached container.
 * @param options - Optional fen, boardSize, orientation, animationsEnabled.
 * @returns A BoardFixture with root, bus, theme, animations, and board.
 * Used by: board, interaction, highlights, and animator tests.
 */
export function makeBoard(options?: {
  fen?: string;
  boardSize?: number;
  orientation?: "white" | "black";
  animationsEnabled?: boolean;
}): BoardFixture {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const bus = makeEventBus();
  // structuredClone first: deepMerge() would otherwise share nested
  // references with DEFAULT_CONFIG across tests in the same file.
  const theme = deepMerge(structuredClone(DEFAULT_CONFIG.theme), {
    boardSize: options?.boardSize ?? 800,
    ...(options?.orientation ? { orientation: options.orientation } : {}),
  });
  const animations = structuredClone(DEFAULT_CONFIG.animations);
  if (options?.animationsEnabled === false) animations.enabled = false;
  const board = new Board({
    element: root,
    boardTheme: theme,
    position: parseFenToMap(options?.fen ?? STANDARD_FEN),
    eventBus: bus,
    animations,
  });
  return { root, bus, theme, animations, board };
}

/**
 * Flushes pending microtasks / promise continuations.
 * @returns A promise resolving on the next macrotask.
 * Used by: async promotion and move-rejection tests.
 */
export function flushAsync(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Dispatches a synthetic pointerdown on a target.
 * @param target - Element receiving the event. @param init - Event overrides.
 * @returns The dispatched PointerEvent.
 * Used by: interaction drag/click/drawing tests.
 */
export function pointerDown(
  target: Element,
  init?: PointerEventInit,
): PointerEvent {
  const event = new PointerEvent("pointerdown", {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 10,
    clientY: 10,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/**
 * Dispatches a synthetic pointerup on a target.
 * @param target - Element or window receiving the event. @param init - Overrides.
 * @returns The dispatched PointerEvent.
 * Used by: interaction drag/click/drawing tests.
 */
export function pointerUp(
  target: Element | Window,
  init?: PointerEventInit,
): PointerEvent {
  const event = new PointerEvent("pointerup", {
    bubbles: true,
    cancelable: true,
    button: 0,
    clientX: 10,
    clientY: 10,
    ...init,
  });
  (target as unknown as EventTarget).dispatchEvent(event);
  return event;
}

/**
 * Left-clicks (pointerdown + pointerup at the same point) on a target.
 * @param target - Element to click. @param x - Client X. @param y - Client Y.
 * @returns Nothing.
 * Used by: click-selection and move-request tests.
 */
export function click(target: Element, x = 10, y = 10): void {
  pointerDown(target, { button: 0, clientX: x, clientY: y });
  pointerUp(target, { button: 0, clientX: x, clientY: y });
}
