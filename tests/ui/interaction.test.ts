/**
 * Suite covering Interaction click, drag, draw, keyboard, and panel flows.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import Interaction from "../../ts/src/ui/interaction.ts";
import { FenStore } from "../../ts/src/utils/fen.ts";
import { STANDARD_FEN } from "../../ts/src/config/defaults.ts";
import type { InteractionConfig } from "../../ts/src/types/types.ts";
import {
  click,
  makeBoard,
  pointerDown,
  pointerUp,
  type BoardFixture,
} from "../helpers.ts";

interface InteractionFixture extends BoardFixture {
  store: FenStore;
  interaction: Interaction;
  selected: Array<{ square: string }>;
  moves: Array<{ from: string; to: string }>;
  dragStarts: Array<{ square: string; piece: string | null }>;
  dragEnds: Array<{ from: string; to: string | null; piece: string | null }>;
  drawStarts: Array<{ from: string; to: string }>;
  drawMoves: Array<{ from: string; to: string }>;
  drawEnds: Array<{ from: string; to: string }>;
  clearDraws: number;
  highlightSquares: string[];
  placed: Array<{ to: string; piece: string }>;
  removed: Array<{ from: string }>;
  keysPressed: string[];
  keysUp: string[];
}

let current: InteractionFixture | null = null;

/**
 * Builds an Interaction wired to a board fixture with captured events.
 * @param interactionPatch - Optional interaction config overrides.
 * @returns A fixture with the interaction and captured event arrays.
 * Used by: Interaction test cases.
 */
function setup(
  interactionPatch?: Partial<InteractionConfig>,
): InteractionFixture {
  const base = makeBoard();
  const store = new FenStore(STANDARD_FEN);
  const interaction = new Interaction({
    interaction: {
      control: "both",
      moveMechanic: "both",
      boardType: "customizable",
      ...interactionPatch,
    },
    board: {
      element: base.root,
      getPieceCode: (sq) => store.getPieceCode(sq),
      getBoardElement: () => base.board.getBoardElement(),
      getOrientation: () => base.board.getOrientation(),
    },
    eventBus: base.bus,
  });
  const fx: InteractionFixture = {
    ...base,
    store,
    interaction,
    selected: [],
    moves: [],
    dragStarts: [],
    dragEnds: [],
    drawStarts: [],
    drawMoves: [],
    drawEnds: [],
    clearDraws: 0,
    highlightSquares: [],
    placed: [],
    removed: [],
    keysPressed: [],
    keysUp: [],
  };
  base.bus.on("interaction:square-selected", (p) => fx.selected.push(p));
  base.bus.on("interaction:move-requested", (p) => fx.moves.push(p));
  base.bus.on("interaction:drag-start", (p) => fx.dragStarts.push(p));
  base.bus.on("interaction:drag-end", (p) => fx.dragEnds.push(p));
  base.bus.on("interaction:start-draw", (p) => fx.drawStarts.push(p));
  base.bus.on("interaction:draw-move", (p) => fx.drawMoves.push(p));
  base.bus.on("interaction:end-draw", (p) => fx.drawEnds.push(p));
  base.bus.on("interaction:clear-draw", () => fx.clearDraws++);
  base.bus.on("interaction:highlight-square", (p) =>
    fx.highlightSquares.push(p),
  );
  base.bus.on("interaction:piece-placed", (p) => fx.placed.push(p));
  base.bus.on("interaction:piece-removed", (p) => fx.removed.push(p));
  base.bus.on("interaction:key-pressed", (p) => fx.keysPressed.push(p));
  base.bus.on("interaction:key-up", (p) => fx.keysUp.push(p));
  current = fx;
  return fx;
}

/**
 * Finds a square element by name within the fixture board.
 * @param fx - The interaction fixture.
 * @param name - The square name to find.
 * @returns The matching square element.
 * Used by: Interaction test cases.
 */
function square(fx: InteractionFixture, name: string): HTMLElement {
  return fx.root.querySelector(`.square[data-square="${name}"]`)!;
}

/**
 * Finds a piece element by square within the fixture board.
 * @param fx - The interaction fixture.
 * @param name - The square name holding the piece.
 * @returns The matching piece element.
 * Used by: Interaction test cases.
 */
function piece(fx: InteractionFixture, name: string): HTMLElement {
  return fx.root.querySelector(`.piece[data-square="${name}"]`)!;
}

/**
 * Mocks the board wrapper bounding rect for drop-position tests.
 * @param fx - The interaction fixture.
 * @param rect - The partial rect fields to apply.
 * @returns Nothing.
 * Used by: Interaction drag and panel test cases.
 */
function mockWrapperRect(fx: InteractionFixture, rect: Partial<DOMRect>): void {
  const wrapper = fx.root.querySelector(".gambix-wrapper") as HTMLElement;
  vi.spyOn(wrapper, "getBoundingClientRect").mockReturnValue({
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    right: 0,
    bottom: 0,
    width: 0,
    height: 0,
    toJSON: () => ({}),
    ...rect,
  } as DOMRect);
}

afterEach(() => {
  current?.interaction.destroy();
  current?.board.destroy();
  current = null;
  vi.restoreAllMocks();
});

/** Covers player control, move mechanic, reInit, and destroy behavior. */
describe("Interaction configuration", () => {
  it("exposes the player control and move mechanic", () => {
    const fx = setup();
    expect(fx.interaction.getPlayer()).toBe("both");
    fx.interaction.setMoveMechanic("drag");
    fx.interaction.updateConfig({ control: "white" });
    expect(fx.interaction.getPlayer()).toBe("white");
  });

  it("reInit refreshes without throwing", () => {
    const fx = setup();
    expect(() => fx.interaction.reInit()).not.toThrow();
  });

  it("destroy silences further events", () => {
    const fx = setup();
    fx.interaction.destroy();
    click(square(fx, "e2"));
    expect(fx.selected).toEqual([]);
  });
});

/** Covers click selection, deselection, and move-request emission. */
describe("Interaction click selection", () => {
  it("selects a square on click", () => {
    const fx = setup();
    click(square(fx, "e2"));
    expect(fx.selected).toEqual([{ square: "e2" }]);
  });

  it("selects empty squares too when control is both", () => {
    const fx = setup();
    click(square(fx, "e4"));
    expect(fx.selected).toEqual([{ square: "e4" }]);
  });

  it("clicking a second square requests a move", () => {
    const fx = setup();
    click(square(fx, "e2"));
    click(square(fx, "e4"));
    expect(fx.moves).toEqual([{ from: "e2", to: "e4" }]);
  });

  it("clicking the selected square again deselects it", () => {
    const fx = setup();
    click(square(fx, "e2"));
    click(square(fx, "e2"));
    expect(fx.selected).toEqual([{ square: "e2" }, { square: "" }]);
    expect(fx.moves).toEqual([]);
  });

  it("clicking another own piece reselects instead of moving", () => {
    const fx = setup();
    click(square(fx, "e2"));
    click(square(fx, "d2"));
    expect(fx.moves).toEqual([]);
    expect(fx.selected).toEqual([{ square: "e2" }, { square: "d2" }]);
  });

  // A legal piece click fires both drag-start selection and click selection for the same square.
  it("respects the player color restriction on piece clicks", () => {
    const fx = setup({ control: "white" });
    // black pawn element — must target the .piece node (squares hold no pieces)
    click(piece(fx, "a7"));
    expect(fx.selected).toEqual([]);
    // NOTE: pressing a .piece fires both the drag-start selection and the
    // click selection, so a legal piece click selects twice (same square).
    click(piece(fx, "a2"));
    expect(fx.selected).toEqual([{ square: "a2" }, { square: "a2" }]);
  });

  it("ignores clicks when control is none", () => {
    const fx = setup({ control: "none" });
    click(square(fx, "e2"));
    expect(fx.selected).toEqual([]);
  });

  it("ignores clicks when mechanic is drag-only", () => {
    const fx = setup({ moveMechanic: "drag" });
    click(square(fx, "e2"));
    expect(fx.selected).toEqual([]);
  });
});

/** Covers piece drag start, drop moves, cancel, and off-board removal. */
describe("Interaction drag and drop", () => {
  it("emits drag-start on piece pointerdown and move on drop", () => {
    const fx = setup();
    pointerDown(piece(fx, "e2"), { button: 0, clientX: 10, clientY: 10 });
    expect(fx.selected).toEqual([{ square: "e2" }]);
    expect(fx.dragStarts).toEqual([{ square: "e2", piece: "wp" }]);

    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    pointerUp(window, { button: 0, clientX: 300, clientY: 300 });

    expect(fx.dragEnds).toHaveLength(1);
    expect(fx.dragEnds[0]).toMatchObject({ from: "e2", piece: "wp" });
    expect(fx.moves).toEqual([
      { from: "e2", to: fx.dragEnds[0]!.to as string },
    ]);
  });

  it("pointer cancel ends the drag with a null target", () => {
    const fx = setup();
    pointerDown(piece(fx, "e2"), { button: 0, clientX: 10, clientY: 10 });
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    window.dispatchEvent(new PointerEvent("pointercancel"));
    expect(fx.dragEnds).toEqual([{ from: "e2", to: null, piece: "wp" }]);
    expect(fx.moves).toEqual([]);
  });

  it("ignores drags for the wrong color and when control is none", () => {
    const fx = setup({ control: "white" });
    pointerDown(piece(fx, "a7"), { button: 0, clientX: 10, clientY: 10 });
    expect(fx.dragStarts).toEqual([]);

    fx.interaction.updateConfig({ control: "none" });
    pointerDown(piece(fx, "a2"), { button: 0, clientX: 10, clientY: 10 });
    expect(fx.dragStarts).toEqual([]);
  });

  it("emits piece-removed when dropped outside a customizable board", () => {
    const fx = setup();
    mockWrapperRect(fx, {
      left: 5000,
      top: 5000,
      right: 6000,
      bottom: 6000,
      width: 1000,
      height: 1000,
    });
    pointerDown(piece(fx, "e2"), { button: 0, clientX: 10, clientY: 10 });
    window.dispatchEvent(
      new PointerEvent("pointermove", { clientX: 300, clientY: 300 }),
    );
    pointerUp(window, { button: 0, clientX: 300, clientY: 300 });
    expect(fx.removed).toEqual([{ from: "e2" }]);
    // Outside drops emit piece-removed only (no drag-end for one action).
    expect(fx.dragEnds).toEqual([]);
    expect(fx.moves).toEqual([]);
  });
});

/** Covers right-button arrow drawing, highlight, and dblclick clearing. */
describe("Interaction right-button drawing", () => {
  it("emits start-draw / draw-move / end-draw", () => {
    const fx = setup();
    pointerDown(square(fx, "e2"), { button: 2, clientX: 5, clientY: 5 });
    expect(fx.drawStarts).toEqual([{ from: "e2", to: "e2" }]);

    square(fx, "e4").dispatchEvent(
      new PointerEvent("pointermove", {
        bubbles: true,
        clientX: 50,
        clientY: 50,
      }),
    );
    expect(fx.drawMoves).toEqual([{ from: "e2", to: "e4" }]);

    pointerUp(window, { button: 2 });
    expect(fx.drawEnds).toEqual([{ from: "e2", to: "e4" }]);
  });

  it("contextmenu highlights a square", () => {
    const fx = setup();
    square(fx, "d4").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(fx.highlightSquares).toEqual(["d4"]);
  });

  // After a completed draw the next contextmenu is swallowed to avoid an extra highlight.
  it("the first contextmenu after a draw is consumed", () => {
    const fx = setup();
    pointerDown(square(fx, "e2"), { button: 2, clientX: 5, clientY: 5 });
    square(fx, "e4").dispatchEvent(
      new PointerEvent("pointermove", { bubbles: true }),
    );
    pointerUp(window, { button: 2 });
    expect(fx.drawEnds).toHaveLength(1);

    square(fx, "e4").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(fx.highlightSquares).toEqual([]);
    square(fx, "e4").dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true }),
    );
    expect(fx.highlightSquares).toEqual(["e4"]);
  });

  it("double-click clears the drawings", () => {
    const fx = setup();
    fx.root
      .querySelector(".gambix-wrapper")!
      .dispatchEvent(new MouseEvent("dblclick", { bubbles: true }));
    expect(fx.clearDraws).toBe(1);
  });
});

/** Covers document key forwarding and square keyboard navigation. */
describe("Interaction keyboard", () => {
  it("forwards key-pressed and key-up from the document", () => {
    const fx = setup();
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Control" }));
    expect(fx.keysPressed).toEqual(["Control"]);
    document.dispatchEvent(new KeyboardEvent("keyup"));
    expect(fx.keysUp).toEqual([""]);
  });

  it("Enter on a square selects it", () => {
    const fx = setup();
    square(fx, "e2").dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", bubbles: true }),
    );
    expect(fx.selected).toEqual([{ square: "e2" }]);
  });

  it("arrow keys move square focus with orientation awareness", () => {
    const fx = setup();
    // squares are not focusable by default; the app is expected to add
    // tabindex for keyboard navigation — simulate that here.
    square(fx, "e2").setAttribute("tabindex", "0");
    square(fx, "f2").setAttribute("tabindex", "0");
    square(fx, "e2").focus();
    square(fx, "e2").dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    expect(document.activeElement?.getAttribute("data-square")).toBe("f2");
  });
});

/** Covers customizable-board panel piece placement and standard-board opt-out. */
describe("Interaction panel dragging (customizable)", () => {
  /**
   * Adds a mock panel piece to the board wrapper for drop tests.
   * @param fx - The interaction fixture.
   * @returns The created panel piece element.
   * Used by: Interaction panel dragging test cases.
   */
  function addPanelPiece(fx: InteractionFixture): HTMLElement {
    const panel = document.createElement("div");
    panel.className = "panel-piece";
    panel.setAttribute("data-piece", "wq");
    fx.root.querySelector(".gambix-wrapper")!.appendChild(panel);
    return panel;
  }

  it("drops a panel piece onto the board as piece-placed", () => {
    const fx = setup();
    mockWrapperRect(fx, {
      left: 0,
      top: 0,
      right: 1000,
      bottom: 1000,
      width: 1000,
      height: 1000,
    });
    const panel = addPanelPiece(fx);
    pointerDown(panel, { button: 0, clientX: 200, clientY: 200 });
    pointerUp(window, { button: 0 });
    expect(fx.placed).toHaveLength(1);
    expect(fx.placed[0]?.piece).toBe("wq");
    expect(fx.placed[0]?.to).toMatch(/^[a-h][1-8]$/);
  });

  it("does not bind panel dragging for standard boards", () => {
    const fx = setup({ boardType: "standard" });
    const panel = addPanelPiece(fx);
    pointerDown(panel, { button: 0, clientX: 200, clientY: 200 });
    pointerUp(window, { button: 0 });
    expect(fx.placed).toEqual([]);
  });
});
