import type EventBus from "../events/event-bus.ts";
import type {
  ChessEvents,
  PlayerControl,
  InteractionConfig,
} from "../types/types.ts";
import { readCurrentTranslate } from "../utils/dom.ts";

/**
 * Board adapter used by Interaction for DOM and piece lookups.
 * Used by: Interaction pointer flow, Gambix internal wiring.
 */
interface InteractionBoard {
  element: HTMLElement | null;
  getPieceCode?: ((square: string) => string | null) | undefined;
  getBoardElement?: (() => HTMLElement | null) | undefined;
  focusSquare?: ((square: string) => boolean) | undefined;
  getOrientation?: (() => "white" | "black") | undefined;
}

/**
 * Constructor dependencies for the Interaction handler.
 * Used by: Interaction pointer flow, Gambix internal wiring.
 */
interface InteractionProps {
  interaction: InteractionConfig;
  board: InteractionBoard;
  eventBus: EventBus<ChessEvents>;
}

/**
 * Z-index applied to the square of the piece being dragged.
 * Used by: Interaction drag and drop flow.
 */
const DRAGGING_SQUARE_Z = "30";
/**
 * Pointer travel in pixels before a press becomes a drag.
 * Used by: Interaction drag and drop flow.
 */
const DRAG_MOVE_THRESHOLD = 4;

/**
 * Handles pointer, click, draw, and keyboard interaction on the board.
 * Used by: Gambix internal wiring, Interaction pointer flow.
 */
class Interaction {
  private element: HTMLElement;
  private boardRef: InteractionBoard;
  private boardWrapper: HTMLElement | null = null;
  private interactionConfig: InteractionConfig;
  private eventBus: EventBus<ChessEvents>;
  private player: PlayerControl;
  private selectedSquare: string | null = null;
  private squares: Element[] = [];
  private abortController: AbortController | null = null;
  private destroyed = false;

  private isDrawing = false;
  private drawStartSquare = "";
  private drawEndSquare = "";
  private activeKey = "";
  private suppressNextClick = false;
  private suppressHighlightOnce = false;
  private activePanelClone: HTMLElement | null = null;

  /**
   * Creates the handler and binds board pointer events.
   * @param props - Interaction config, board adapter, and event bus.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  constructor(props: InteractionProps) {
    if (!props.board.element) {
      throw new Error("Interaction requires a board element.");
    }
    this.element = props.board.element;
    this.boardRef = props.board;
    this.interactionConfig = props.interaction;
    this.eventBus = props.eventBus;
    this.player = props.interaction.control;
    this.boardWrapper = this.element.querySelector(
      ":scope > .gambix-wrapper, .gambix-wrapper",
    ) as HTMLElement | null;

    this.abortController = new AbortController();
    this.bindAllEvents();
    this.refreshSquares();
  }

  // ==========================================
  // Public Configuration & Lifecycle API
  // ==========================================

  /**
   * Updates the allowed move mechanic (click, drag, or both).
   * @param mechanic - The new move mechanic setting.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  public setMoveMechanic(mechanic: InteractionConfig["moveMechanic"]): void {
    this.interactionConfig.moveMechanic = mechanic;
    this.bindAllEvents();
  }

  /**
   * Merges partial config and resets selection on control change.
   * @param config - The partial interaction config to apply.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  public updateConfig(config: Partial<InteractionConfig>): void {
    if (config.control !== undefined) this.player = config.control;
    Object.assign(this.interactionConfig, config);
    if (config.control !== undefined) this.selectedSquare = null;
    this.bindAllEvents();
  }

  /**
   * Returns the currently controlled player color.
   * @returns The active player control setting.
   * Used by: Gambix internal wiring.
   */
  public getPlayer(): PlayerControl {
    return this.player;
  }

  /**
   * Refreshes cached squares and rebinds events after DOM changes.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  public reInit(): void {
    if (this.destroyed) return;
    this.selectedSquare = null;
    const newWrapper = this.element.querySelector(
      ":scope > .gambix-wrapper, .gambix-wrapper",
    ) as HTMLElement | null;
    const wrapperChanged = newWrapper !== this.boardWrapper;
    this.boardWrapper = newWrapper;
    this.refreshSquares();

    if (wrapperChanged) {
      this.abortController?.abort();
      this.abortController = new AbortController();
      this.bindAllEvents();
    }
  }

  /**
   * Tears down listeners and clears interaction state.
   * @returns Nothing.
   * Used by: Gambix internal wiring.
   */
  public destroy(): void {
    this.destroyed = true;
    this.abortController?.abort();
    this.abortController = null;
    this.squares = [];
    this.selectedSquare = null;
    this.isDrawing = false;
    this.drawStartSquare = "";
    this.drawEndSquare = "";
    if (this.activePanelClone?.parentNode) this.activePanelClone.remove();
    this.activePanelClone = null;
  }

  // ==========================================
  // Private Event Binding
  // ==========================================

  /**
   * Returns the abort signal for bound listeners, if active.
   * @returns The abort signal, or undefined when destroyed.
   * Used by: Interaction event binding flow.
   */
  private get signal(): AbortSignal | undefined {
    return this.abortController?.signal;
  }

  /**
   * Builds listener options tied to the current abort signal.
   * @returns Listener options with the signal, or undefined.
   * Used by: Interaction draw and drag flow.
   */
  private windowOpts(): AddEventListenerOptions | undefined {
    const s = this.signal;
    return s ? { signal: s } : undefined;
  }

  /**
   * Recaches the list of square elements from the board DOM.
   * @returns Nothing.
   * Used by: Interaction constructor and reInit flow.
   */
  private refreshSquares(): void {
    const boardElement = this.getBoardElement();
    this.squares = boardElement
      ? [...boardElement.querySelectorAll(".squares-container .square")]
      : [];
  }

  /**
   * Binds click, drag, draw, and keyboard handlers together.
   * @returns Nothing.
   * Used by: Interaction constructor and reInit flow.
   */
  private bindAllEvents(): void {
    this.setupClickListeners();
    this.setupDraggables();
    this.setupDrawHandler();
    this.setupKeyBoardHandlers();
    this.setupKeyboardNavigation();
    if (this.interactionConfig.boardType === "customizable") {
      this.setupPanelDraggables();
    }
  }

  /**
   * Binds pointer click detection plus dblclick draw clearing.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupClickListeners(): void {
    if (!this.boardWrapper || !this.abortController) return;
    const signal = this.abortController.signal;
    let downX = 0;
    let downY = 0;
    let downTarget: HTMLElement | null = null;
    let downTime = 0;

    this.boardWrapper.addEventListener(
      "pointerdown",
      (event: PointerEvent) => {
        if (event.button !== 0 || !this.isClickAllowed()) return;
        const target = (event.target as HTMLElement).closest(
          ".piece, .square",
        ) as HTMLElement | null;
        if (!target) return;
        downX = event.clientX;
        downY = event.clientY;
        downTarget = target;
        downTime = Date.now();
      },
      { signal },
    );

    this.boardWrapper.addEventListener(
      "pointerup",
      (event: PointerEvent) => {
        if (event.button !== 0 || !downTarget) return;
        const dist = Math.hypot(event.clientX - downX, event.clientY - downY);
        const elapsed = Date.now() - downTime;
        const target = downTarget;
        downTarget = null;

        if (dist > 8 || elapsed > 400) return;
        if (this.suppressNextClick) {
          this.suppressNextClick = false;
          return;
        }
        if (!this.isClickAllowed()) return;

        const clickedTarget =
          (target.closest(".piece, .square") as HTMLElement | null) ||
          ((event.target as HTMLElement).closest(
            ".piece, .square",
          ) as HTMLElement | null);
        if (!clickedTarget) return;

        this.handleClick(clickedTarget);
      },
      { signal },
    );

    this.boardWrapper.addEventListener(
      "pointercancel",
      () => {
        downTarget = null;
      },
      { signal },
    );

    this.boardWrapper.addEventListener(
      "click",
      (event) => {
        if (this.suppressNextClick) {
          this.suppressNextClick = false;
          event.stopPropagation();
          event.preventDefault();
        }
      },
      { signal },
    );

    this.boardWrapper.addEventListener(
      "dblclick",
      () => this.eventBus.emit("interaction:clear-draw", {}),
      { signal },
    );
  }

  /**
   * Checks whether click-based moves are currently allowed.
   * @returns True when the mechanic allows clicks.
   * Used by: Interaction click and keyboard flow.
   */
  private isClickAllowed(): boolean {
    const mech = this.interactionConfig.moveMechanic;
    return mech === "both" || mech === "click";
  }

  /**
   * Checks whether drag-based moves are currently allowed.
   * @returns True when the mechanic allows dragging.
   * Used by: Interaction drag setup flow.
   */
  private isDragAllowed(): boolean {
    const mech = this.interactionConfig.moveMechanic;
    return mech === "both" || mech === "drag";
  }

  /**
   * Binds native drag suppression and piece pointer-drag start.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupDraggables(): void {
    if (!this.isDragAllowed() || !this.boardWrapper || !this.abortController)
      return;
    const signal = this.abortController.signal;

    this.boardWrapper.addEventListener(
      "dragstart",
      (event) => {
        if ((event.target as HTMLElement).closest(".piece")) {
          event.preventDefault();
        }
      },
      { signal },
    );

    this.boardWrapper.addEventListener(
      "pointerdown",
      (event: PointerEvent) => {
        if (event.button === 2 || this.player === "none") return;
        const pieceEl = (event.target as HTMLElement).closest(
          ".piece",
        ) as HTMLElement | null;
        if (!pieceEl) return;

        const pieceColor = pieceEl.getAttribute("data-color");
        if (this.player !== "both" && pieceColor !== this.player) return;

        const boardEl = this.getBoardElement();
        if (!boardEl) return;

        this.handleDragStart(event, pieceEl, boardEl);
      },
      { signal },
    );
  }

  /**
   * Binds panel piece dragging for customizable boards.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupPanelDraggables(): void {
    if (!this.boardWrapper || !this.abortController) return;
    const signal = this.abortController.signal;

    this.boardWrapper.addEventListener("dragstart", (e) => e.preventDefault(), {
      signal,
    });
    this.boardWrapper.addEventListener(
      "pointerdown",
      (event: PointerEvent) => {
        if (event.button === 2) return;
        const sourcePiece = (event.target as HTMLElement).closest(
          ".panel-piece",
        ) as HTMLElement | null;
        if (!sourcePiece) return;
        event.preventDefault();
        this.handlePanelDragStart(event, sourcePiece);
      },
      { signal },
    );
  }

  /**
   * Binds right-button arrow drawing and square highlighting.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupDrawHandler(): void {
    if (!this.boardWrapper || !this.abortController) return;
    const signal = this.abortController.signal;

    const getSquare = (target: HTMLElement): string | null => {
      const el = target.closest("[data-square]") as HTMLElement | null;
      return el?.getAttribute("data-square") ?? null;
    };

    const preventContextMenu = (e: Event): void => e.preventDefault();

    const handlePointerDown = (event: PointerEvent): void => {
      if (event.button !== 2) return;
      event.preventDefault();
      document.addEventListener("contextmenu", preventContextMenu, {
        capture: true,
        signal,
      });
      this.isDrawing = true;
      this.suppressHighlightOnce = false;

      const square = getSquare(event.target as HTMLElement);
      if (square) {
        this.drawStartSquare = square;
        this.drawEndSquare = square;
        this.eventBus.emit("interaction:start-draw", {
          from: square,
          to: square,
        });
      }

      const handlePointerMove = (moveEvent: PointerEvent): void => {
        if (!this.isDrawing) return;
        const currentSquare = getSquare(moveEvent.target as HTMLElement);
        if (!currentSquare) return;
        this.drawEndSquare = currentSquare;
        if (this.drawStartSquare) {
          this.eventBus.emit("interaction:draw-move", {
            from: this.drawStartSquare,
            to: currentSquare,
          });
        }
      };

      const cleanupDraw = (isCancelled = false): void => {
        window.removeEventListener("pointermove", handlePointerMove);
        window.removeEventListener("pointerup", handlePointerUp);
        window.removeEventListener("pointercancel", handlePointerCancel);
        document.removeEventListener("contextmenu", preventContextMenu, {
          capture: true,
        });

        if (!this.isDrawing) return;
        this.isDrawing = false;

        if (
          !isCancelled &&
          this.drawStartSquare &&
          this.drawStartSquare !== this.drawEndSquare
        ) {
          this.eventBus.emit("interaction:end-draw", {
            from: this.drawStartSquare,
            to: this.drawEndSquare,
          });
          this.suppressHighlightOnce = true;
        }

        this.drawStartSquare = "";
        this.drawEndSquare = "";
      };

      const handlePointerUp = (): void => cleanupDraw(false);

      const handlePointerCancel = (): void => cleanupDraw(true);

      const opts = this.windowOpts();
      window.addEventListener(
        "pointermove",
        handlePointerMove as EventListener,
        opts,
      );
      window.addEventListener(
        "pointerup",
        handlePointerUp as EventListener,
        opts,
      );
      window.addEventListener(
        "pointercancel",
        handlePointerCancel as EventListener,
        opts,
      );
    };

    this.boardWrapper.addEventListener("pointerdown", handlePointerDown, {
      signal,
    });
    this.boardWrapper.addEventListener(
      "contextmenu",
      (event) => {
        event.preventDefault();
        if (this.suppressHighlightOnce) {
          this.suppressHighlightOnce = false;
          return;
        }
        const clickedTarget = (event.target as HTMLElement).closest(
          ".piece, .square",
        ) as HTMLElement | null;
        if (!clickedTarget) return;
        this.eventBus.emit(
          "interaction:highlight-square",
          clickedTarget.getAttribute("data-square") || "",
        );
      },
      { signal },
    );
  }

  // ==========================================
  // Click & Selection Handling
  // ==========================================

  /**
   * Resolves the color of the piece occupying a square.
   * @param square - The square name to inspect.
   * @returns The piece color, or null when empty.
   * Used by: Interaction click selection flow.
   */
  private getPieceColor(square: string): string | null {
    if (!square) return null;
    const code = this.boardRef.getPieceCode?.(square);
    if (code) return code.charAt(0) === "w" ? "white" : "black";
    const boardEl = this.getBoardElement();
    const el = boardEl?.querySelector(
      `.piece[data-square="${CSS.escape(square)}"]`,
    ) as HTMLElement | null;
    return el?.getAttribute("data-color") || null;
  }

  /**
   * Handles click selection, deselection, and move requests.
   * @param clickedTarget - The clicked piece or square element.
   * @returns Nothing.
   * Used by: Interaction click and keyboard flow.
   */
  private handleClick(clickedTarget: HTMLElement): void {
    const clickedSquare = this.getSquareFromTarget(clickedTarget);
    if (!clickedSquare) return;

    if (!this.selectedSquare) {
      if (!this.canSelectTarget(clickedTarget)) return;
      this.selectedSquare = clickedSquare;
      this.eventBus.emit("interaction:square-selected", {
        square: clickedSquare,
      });
      return;
    }

    if (clickedSquare === this.selectedSquare) {
      this.selectedSquare = null;
      this.eventBus.emit("interaction:square-selected", { square: "" });
      return;
    }

    const selectedColor = this.getPieceColor(this.selectedSquare);
    const clickedColor = this.getPieceColor(clickedSquare);
    const isSameColor =
      selectedColor && clickedColor && selectedColor === clickedColor;

    if (clickedColor && isSameColor) {
      const canSelectClicked =
        this.player === "both" || clickedColor === this.player;
      if (canSelectClicked) {
        this.selectedSquare = clickedSquare;
        this.eventBus.emit("interaction:square-selected", {
          square: clickedSquare,
        });
        return;
      }
    }

    const from = this.selectedSquare;
    this.selectedSquare = null;
    this.eventBus.emit("interaction:move-requested", {
      from,
      to: clickedSquare,
    });
  }

  // ==========================================
  // Piece Drag & Drop Handling
  // ==========================================

  /**
   * Starts pointer dragging for a board piece with drop handling.
   * @param event - The initiating pointerdown event.
   * @param pieceElement - The dragged piece element.
   * @param boardElement - The board container element.
   * @returns Nothing.
   * Used by: Interaction drag setup flow.
   */
  private handleDragStart(
    event: PointerEvent,
    pieceElement: HTMLElement,
    boardElement: Element,
  ): void {
    if (event.button === 2) return;
    event.preventDefault();
    this.suppressNextClick = false;

    const startSquare = pieceElement.getAttribute("data-square") || "";
    if (!startSquare) return;

    this.eventBus.emit("interaction:square-selected", { square: startSquare });
    this.eventBus.emit("interaction:drag-start", {
      square: startSquare,
      piece: pieceElement.getAttribute("data-piece"),
    });

    const currentTranslate = readCurrentTranslate(pieceElement) ?? {
      x: 0,
      y: 0,
    };
    const anchorX = event.clientX;
    const anchorY = event.clientY;
    const boardRect = this.boardWrapper?.getBoundingClientRect();
    const pieceRect = pieceElement.getBoundingClientRect();
    if (!boardRect) return;

    const dragMargin =
      this.interactionConfig.boardType === "customizable" ? 150 : 0;
    const bounds = {
      minX: boardRect.left - (pieceRect.left - currentTranslate.x) - dragMargin,
      maxX:
        boardRect.right - (pieceRect.right - currentTranslate.x) + dragMargin,
      minY: boardRect.top - (pieceRect.top - currentTranslate.y) - dragMargin,
      maxY:
        boardRect.bottom - (pieceRect.bottom - currentTranslate.y) + dragMargin,
    };

    const pieceCenterX = pieceRect.left + pieceRect.width / 2;
    const pieceCenterY = pieceRect.top + pieceRect.height / 2;
    const pointerOffsetX = anchorX - pieceCenterX;
    const pointerOffsetY = anchorY - pieceCenterY;
    const initialCenteredX = currentTranslate.x + pointerOffsetX;
    const initialCenteredY = currentTranslate.y + pointerOffsetY;

    let didMove = false;

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      const movedDist = Math.hypot(
        moveEvent.clientX - anchorX,
        moveEvent.clientY - anchorY,
      );

      if (movedDist > DRAG_MOVE_THRESHOLD) {
        if (!didMove) {
          didMove = true;
          this.setDraggingState(boardElement, startSquare, pieceElement, true);
        }
      } else if (!didMove) {
        return;
      }

      this.suppressNextClick = true;
      const clampedX = this.clamp(
        moveEvent.clientX - anchorX + initialCenteredX,
        bounds.minX,
        bounds.maxX,
      );
      const clampedY = this.clamp(
        moveEvent.clientY - anchorY + initialCenteredY,
        bounds.minY,
        bounds.maxY,
      );
      pieceElement.style.translate = `${clampedX}px ${clampedY}px`;
    };

    const cleanupListeners = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handleCancel);
      if (didMove) {
        this.setDraggingState(boardElement, startSquare, pieceElement, false);
      }
    };

    const handlePointerUp = (): void => {
      cleanupListeners();

      if (!didMove) {
        this.eventBus.emit("interaction:drag-end", {
          from: startSquare,
          to: null,
          piece: pieceElement.getAttribute("data-piece"),
        });
        return;
      }

      const closestSquareName = this.getClosestSquare(pieceElement);

      if (this.interactionConfig.boardType === "customizable") {
        const dropBoardRect = this.boardWrapper?.getBoundingClientRect();
        const droppedPieceRect = pieceElement.getBoundingClientRect();
        const dropCenterX = droppedPieceRect.left + droppedPieceRect.width / 2;
        const dropCenterY = droppedPieceRect.top + droppedPieceRect.height / 2;
        if (
          dropBoardRect &&
          (dropCenterX < dropBoardRect.left ||
            dropCenterX > dropBoardRect.right ||
            dropCenterY < dropBoardRect.top ||
            dropCenterY > dropBoardRect.bottom)
        ) {
          this.eventBus.emit("interaction:piece-removed", {
            from: startSquare,
          });
          return;
        }
      }

      this.eventBus.emit("interaction:drag-end", {
        from: startSquare,
        to: closestSquareName,
        piece: pieceElement.getAttribute("data-piece"),
      });

      if (!closestSquareName || closestSquareName === startSquare) {
        this.snapPieceToSquare(pieceElement, startSquare);
        return;
      }

      this.eventBus.emit("interaction:move-requested", {
        from: startSquare,
        to: closestSquareName,
      });
    };

    const handleCancel = (): void => {
      cleanupListeners();
      if (didMove) {
        this.snapPieceToSquare(pieceElement, startSquare);
      }
      this.eventBus.emit("interaction:drag-end", {
        from: startSquare,
        to: null,
        piece: pieceElement.getAttribute("data-piece"),
      });
    };

    const opts = this.windowOpts();
    window.addEventListener(
      "pointermove",
      handlePointerMove as EventListener,
      opts,
    );
    window.addEventListener(
      "pointerup",
      handlePointerUp as EventListener,
      opts,
    );
    window.addEventListener(
      "pointercancel",
      handleCancel as EventListener,
      opts,
    );
  }

  /**
   * Toggles dragging styles on a square and its piece.
   * @param boardElement - The board container element.
   * @param squareName - The origin square name.
   * @param pieceElement - The dragged piece element.
   * @param isDragging - Whether dragging visuals are active.
   * @returns Nothing.
   * Used by: Interaction drag and drop flow.
   */
  private setDraggingState(
    boardElement: Element,
    squareName: string,
    pieceElement: HTMLElement,
    isDragging: boolean,
  ): void {
    const square = boardElement.querySelector(
      `.square[data-square="${CSS.escape(squareName)}"]`,
    ) as HTMLElement | null;
    square?.classList.toggle("dragging", isDragging);
    if (square) square.style.zIndex = isDragging ? DRAGGING_SQUARE_Z : "";
    pieceElement.style.pointerEvents = isDragging ? "none" : "auto";
    pieceElement.classList.toggle("is-dragging", isDragging);
  }

  /**
   * Finds the nearest square to a dragged piece center.
   * @param pieceElement - The dragged piece element.
   * @returns The closest square name, or null when none.
   * Used by: Interaction drag and drop flow.
   */
  private getClosestSquare(pieceElement: HTMLElement): string | null {
    const pieceRect = pieceElement.getBoundingClientRect();
    const cx = pieceRect.left + pieceRect.width / 2;
    const cy = pieceRect.top + pieceRect.height / 2;
    return this.getClosestSquareByPoint(cx, cy);
  }

  /**
   * Finds the nearest square to a viewport point.
   * @param cx - The client X coordinate.
   * @param cy - The client Y coordinate.
   * @returns The closest square name, or null when none.
   * Used by: Interaction drag and panel drop flow.
   */
  private getClosestSquareByPoint(cx: number, cy: number): string | null {
    let closest: Element | null = null;
    let min = Infinity;
    this.squares.forEach((squareEl) => {
      const r = squareEl.getBoundingClientRect();
      const sx = r.left + r.width / 2;
      const sy = r.top + r.height / 2;
      const d = Math.hypot(cx - sx, cy - sy);
      if (d < min) {
        min = d;
        closest = squareEl;
      }
    });
    return (closest as HTMLElement | null)?.getAttribute("data-square") || null;
  }

  /**
   * Resolves the square name from a clicked element.
   * @param target - The clicked piece or square element.
   * @returns The square name, or null when not found.
   * Used by: Interaction click selection flow.
   */
  private getSquareFromTarget(target: HTMLElement): string | null {
    if (target.hasAttribute("data-square")) {
      return target.getAttribute("data-square");
    }
    return target.closest(".square")?.getAttribute("data-square") || null;
  }

  /**
   * Checks whether a clicked target may become the selection.
   * @param target - The clicked piece or square element.
   * @returns True when the target is selectable by the player.
   * Used by: Interaction click selection flow.
   */
  private canSelectTarget(target: HTMLElement): boolean {
    if (this.player === "none") return false;
    if (this.player === "both") return true;
    if (target.getAttribute("data-square") === this.selectedSquare)
      return false;
    const pieceInTarget = target.matches(".piece")
      ? target
      : target.querySelector(".piece");
    return pieceInTarget?.getAttribute("data-color") === this.player;
  }

  /**
   * Resolves the board container element from the adapter or DOM.
   * @returns The board element, or null when not found.
   * Used by: Interaction drag, snap, and keyboard flow.
   */
  private getBoardElement(): HTMLElement | null {
    if (this.boardRef.getBoardElement) {
      const el = this.boardRef.getBoardElement();
      if (el) return el;
    }
    return this.boardWrapper?.querySelector(
      ":scope .gambix-board, :scope #board",
    ) as HTMLElement | null;
  }

  /**
   * Clamps a drag offset within board bounds.
   * @param value - The value to clamp.
   * @param min - The minimum allowed value.
   * @param max - The maximum allowed value.
   * @returns The clamped value.
   * Used by: Interaction drag and drop flow.
   */
  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(value, max));
  }

  /**
   * Reads the configured snapback animation for cancelled drags.
   * @returns The snap duration, easing, and enabled flag.
   * Used by: Interaction snap piece flow.
   */
  private snapConfig(): { duration: number; easing: string; enabled: boolean } {
    const cfg = this.interactionConfig.snapback;
    return {
      duration: cfg?.duration ?? 150,
      easing: cfg?.easing ?? "ease-out",
      enabled: cfg?.enabled ?? true,
    };
  }

  /**
   * Animates a piece back to its origin square.
   * @param pieceElement - The piece element to move.
   * @param squareName - The square to snap back to.
   * @returns Nothing.
   * Used by: Interaction drag cancel and drop flow.
   */
  private snapPieceToSquare(
    pieceElement: HTMLElement,
    squareName: string,
  ): void {
    const boardElement = this.getBoardElement();
    if (!boardElement) {
      pieceElement.style.translate = "0px 0px";
      return;
    }
    const squareElement = boardElement.querySelector(
      `.square[data-square="${CSS.escape(squareName)}"]`,
    ) as HTMLElement | null;
    if (!squareElement) {
      pieceElement.style.translate = "0px 0px";
      return;
    }
    const boardRect = boardElement.getBoundingClientRect();
    const squareRect = squareElement.getBoundingClientRect();
    const snapX =
      squareRect.left -
      boardRect.left +
      (squareRect.width - pieceElement.offsetWidth) / 2;
    const snapY =
      squareRect.top -
      boardRect.top +
      (squareRect.height - pieceElement.offsetHeight) / 2;

    const snap = this.snapConfig();
    if (!snap.enabled || snap.duration <= 0) {
      pieceElement.style.transition = "";
      pieceElement.style.translate = `${snapX}px ${snapY}px`;
      return;
    }

    pieceElement.style.transition = `translate ${snap.duration}ms ${snap.easing}`;
    pieceElement.style.translate = `${snapX}px ${snapY}px`;
    pieceElement.addEventListener(
      "transitionend",
      () => (pieceElement.style.transition = ""),
      { once: true },
    );
  }

  // ==========================================
  // Customizable Board Piece Panel Dragging
  // ==========================================

  /**
   * Drags a panel piece clone onto the board as a placement.
   * @param event - The initiating pointerdown event.
   * @param sourcePiece - The panel piece element being dragged.
   * @returns Nothing.
   * Used by: Interaction panel drag setup flow.
   */
  private handlePanelDragStart(
    event: PointerEvent,
    sourcePiece: HTMLElement,
  ): void {
    const pieceType = sourcePiece.getAttribute("data-piece");
    if (!pieceType) return;
    this.suppressNextClick = false;

    const dragClone = sourcePiece.cloneNode(true) as HTMLElement;
    dragClone.style.position = "fixed";
    dragClone.style.zIndex = "1000";
    dragClone.style.pointerEvents = "none";
    dragClone.style.opacity = "0.85";
    dragClone.style.left = `${event.clientX - sourcePiece.offsetWidth / 2}px`;
    dragClone.style.top = `${event.clientY - sourcePiece.offsetHeight / 2}px`;
    document.body.appendChild(dragClone);
    this.activePanelClone = dragClone;

    const cleanupClone = (): void => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePanelCancel);
      this.activePanelClone = null;
      if (dragClone.parentNode) {
        dragClone.remove();
      }
    };

    const handlePointerMove = (moveEvent: PointerEvent): void => {
      this.suppressNextClick = true;
      dragClone.style.left = `${moveEvent.clientX - sourcePiece.offsetWidth / 2}px`;
      dragClone.style.top = `${moveEvent.clientY - sourcePiece.offsetHeight / 2}px`;
    };

    const handlePointerUp = (): void => {
      const cloneLeft = parseFloat(dragClone.style.left);
      const cloneTop = parseFloat(dragClone.style.top);
      const cloneWidth = sourcePiece.offsetWidth;
      const cloneHeight = sourcePiece.offsetHeight;

      cleanupClone();

      this.refreshSquares();
      const cloneCenterX = cloneLeft + cloneWidth / 2;
      const cloneCenterY = cloneTop + cloneHeight / 2;
      const closestSquareId = this.getClosestSquareByPoint(
        cloneCenterX,
        cloneCenterY,
      );
      if (!closestSquareId) return;

      const boardRect = this.boardWrapper?.getBoundingClientRect();
      if (
        boardRect &&
        cloneCenterX >= boardRect.left &&
        cloneCenterX <= boardRect.right &&
        cloneCenterY >= boardRect.top &&
        cloneCenterY <= boardRect.bottom
      ) {
        this.eventBus.emit("interaction:piece-placed", {
          to: closestSquareId,
          piece: pieceType,
        });
      }
    };

    const handlePanelCancel = (): void => {
      cleanupClone();
    };

    const opts = this.windowOpts();
    window.addEventListener(
      "pointermove",
      handlePointerMove as EventListener,
      opts,
    );
    window.addEventListener(
      "pointerup",
      handlePointerUp as EventListener,
      opts,
    );
    window.addEventListener(
      "pointercancel",
      handlePanelCancel as EventListener,
      opts,
    );
  }

  // ==========================================
  // Keyboard Handling & Navigation
  // ==========================================

  /**
   * Forwards global key press and release events to the bus.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupKeyBoardHandlers(): void {
    if (!this.abortController) return;
    const signal = this.abortController.signal;

    document.addEventListener(
      "keydown",
      (event) => {
        if (this.destroyed || event.repeat) return;
        if (this.activeKey === event.key) return;
        this.activeKey = event.key;
        this.eventBus.emit("interaction:key-pressed", this.activeKey);
      },
      { signal },
    );

    document.addEventListener(
      "keyup",
      () => {
        if (this.destroyed) return;
        this.activeKey = "";
        this.eventBus.emit("interaction:key-up", "");
      },
      { signal },
    );
  }

  /**
   * Binds Enter and arrow-key navigation between squares.
   * @returns Nothing.
   * Used by: Interaction bindAllEvents flow.
   */
  private setupKeyboardNavigation(): void {
    if (!this.boardWrapper || !this.abortController) return;
    const signal = this.abortController.signal;
    const files = ["a", "b", "c", "d", "e", "f", "g", "h"];
    const ranks = ["1", "2", "3", "4", "5", "6", "7", "8"];

    this.boardWrapper.addEventListener(
      "keydown",
      (event: KeyboardEvent) => {
        if (this.destroyed) return;
        const target = (event.target as HTMLElement).closest?.(
          ".square",
        ) as HTMLElement | null;
        if (!target || !this.boardWrapper?.contains(target)) return;

        const sq = target.getAttribute("data-square");
        if (!sq || sq.length !== 2) return;

        if (
          event.key === "Enter" ||
          event.key === " " ||
          event.key === "Spacebar"
        ) {
          if (!this.isClickAllowed()) return;
          event.preventDefault();
          this.handleClick(target);
          return;
        }

        let dx = 0;
        let dy = 0;
        switch (event.key) {
          case "ArrowUp":
            dy = 1;
            break;
          case "ArrowDown":
            dy = -1;
            break;
          case "ArrowLeft":
            dx = -1;
            break;
          case "ArrowRight":
            dx = 1;
            break;
          default:
            return;
        }

        event.preventDefault();
        const orientation = this.boardRef.getOrientation?.() ?? "white";
        if (orientation === "black") {
          dx = -dx;
          dy = -dy;
        }

        const fi = files.indexOf(sq.charAt(0)) + dx;
        const ri = ranks.indexOf(sq.charAt(1)) + dy;
        if (fi < 0 || fi > 7 || ri < 0 || ri > 7) return;

        const next = `${files[fi]}${ranks[ri]}`;
        if (this.boardRef.focusSquare) {
          this.boardRef.focusSquare(next);
          return;
        }

        const el = this.getBoardElement()?.querySelector(
          `.square[data-square="${next}"]`,
        ) as HTMLElement | null;
        el?.focus();
      },
      { signal },
    );
  }
}

export default Interaction;
