import type EventBus from "../events/event-bus.ts";
import type { ChessEvents, PlayerControl, InteractionConfig } from "../types/types.ts";
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
 * Handles pointer, click, draw, and keyboard interaction on the board.
 * Used by: Gambix internal wiring, Interaction pointer flow.
 */
declare class Interaction {
    private static activeKeyboardOwner;
    private element;
    private boardRef;
    private boardWrapper;
    private interactionConfig;
    private eventBus;
    private player;
    private selectedSquare;
    private squares;
    private abortController;
    private destroyed;
    private isDrawing;
    private drawStartSquare;
    private drawEndSquare;
    private activeKey;
    private suppressNextClick;
    private suppressHighlightOnce;
    private activePanelClone;
    /**
     * Creates the handler and binds board pointer events.
     * @param props - Interaction config, board adapter, and event bus.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    constructor(props: InteractionProps);
    /**
     * Updates the allowed move mechanic (click, drag, or both).
     * @param mechanic - The new move mechanic setting.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    setMoveMechanic(mechanic: InteractionConfig["moveMechanic"]): void;
    /**
     * Merges partial config and resets selection on control change.
     * @param config - The partial interaction config to apply.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    updateConfig(config: Partial<InteractionConfig>): void;
    /**
     * Returns the currently controlled player color.
     * @returns The active player control setting.
     * Used by: Gambix internal wiring.
     */
    getPlayer(): PlayerControl;
    /**
     * Refreshes cached squares and rebinds events after DOM changes.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    reInit(): void;
    /**
     * Tears down listeners and clears interaction state.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    destroy(): void;
    /**
     * Returns the abort signal for bound listeners, if active.
     * @returns The abort signal, or undefined when destroyed.
     * Used by: Interaction event binding flow.
     */
    private get signal();
    /**
     * Builds listener options tied to the current abort signal.
     * @returns Listener options with the signal, or undefined.
     * Used by: Interaction draw and drag flow.
     */
    private windowOpts;
    /**
     * Recaches the list of square elements from the board DOM.
     * @returns Nothing.
     * Used by: Interaction constructor and reInit flow.
     */
    private refreshSquares;
    /**
     * Binds click, drag, draw, and keyboard handlers together.
     * @returns Nothing.
     * Used by: Interaction constructor and reInit flow.
     */
    private bindAllEvents;
    /**
     * Binds pointer click detection plus dblclick draw clearing.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupClickListeners;
    /**
     * Checks whether click-based moves are currently allowed.
     * @returns True when the mechanic allows clicks.
     * Used by: Interaction click and keyboard flow.
     */
    private isClickAllowed;
    /**
     * Checks whether drag-based moves are currently allowed.
     * @returns True when the mechanic allows dragging.
     * Used by: Interaction drag setup flow.
     */
    private isDragAllowed;
    /**
     * Binds native drag suppression and piece pointer-drag start.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupDraggables;
    /**
     * Binds panel piece dragging for customizable boards.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupPanelDraggables;
    /**
     * Binds right-button arrow drawing and square highlighting.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupDrawHandler;
    /**
     * Resolves the color of the piece occupying a square.
     * @param square - The square name to inspect.
     * @returns The piece color, or null when empty.
     * Used by: Interaction click selection flow.
     */
    private getPieceColor;
    /**
     * Handles click selection, deselection, and move requests.
     * @param clickedTarget - The clicked piece or square element.
     * @returns Nothing.
     * Used by: Interaction click and keyboard flow.
     */
    private handleClick;
    /**
     * Starts pointer dragging for a board piece with drop handling.
     * @param event - The initiating pointerdown event.
     * @param pieceElement - The dragged piece element.
     * @param boardElement - The board container element.
     * @returns Nothing.
     * Used by: Interaction drag setup flow.
     */
    private handleDragStart;
    /**
     * Toggles dragging styles on a square and its piece.
     * @param boardElement - The board container element.
     * @param squareName - The origin square name.
     * @param pieceElement - The dragged piece element.
     * @param isDragging - Whether dragging visuals are active.
     * @returns Nothing.
     * Used by: Interaction drag and drop flow.
     */
    private setDraggingState;
    /**
     * Finds the nearest square to a dragged piece center.
     * @param pieceElement - The dragged piece element.
     * @returns The closest square name, or null when none.
     * Used by: Interaction drag and drop flow.
     */
    private getClosestSquare;
    /**
     * Finds the nearest square to a viewport point.
     * @param cx - The client X coordinate.
     * @param cy - The client Y coordinate.
     * @returns The closest square name, or null when none.
     * Used by: Interaction drag and panel drop flow.
     */
    private getClosestSquareByPoint;
    /**
     * Resolves the square name from a clicked element.
     * @param target - The clicked piece or square element.
     * @returns The square name, or null when not found.
     * Used by: Interaction click selection flow.
     */
    private getSquareFromTarget;
    /**
     * Checks whether a clicked target may become the selection.
     * @param target - The clicked piece or square element.
     * @returns True when the target is selectable by the player.
     * Used by: Interaction click selection flow.
     */
    private canSelectTarget;
    /**
     * Resolves the board container element from the adapter or DOM.
     * @returns The board element, or null when not found.
     * Used by: Interaction drag, snap, and keyboard flow.
     */
    private getBoardElement;
    /**
     * Clamps a drag offset within board bounds.
     * @param value - The value to clamp.
     * @param min - The minimum allowed value.
     * @param max - The maximum allowed value.
     * @returns The clamped value.
     * Used by: Interaction drag and drop flow.
     */
    private clamp;
    /**
     * Reads the configured snapback animation for cancelled drags.
     * @returns The snap duration, easing, and enabled flag.
     * Used by: Interaction snap piece flow.
     */
    private snapConfig;
    /**
     * Animates a piece back to its origin square.
     * @param pieceElement - The piece element to move.
     * @param squareName - The square to snap back to.
     * @returns Nothing.
     * Used by: Interaction drag cancel and drop flow.
     */
    private snapPieceToSquare;
    /**
     * Drags a panel piece clone onto the board as a placement.
     * @param event - The initiating pointerdown event.
     * @param sourcePiece - The panel piece element being dragged.
     * @returns Nothing.
     * Used by: Interaction panel drag setup flow.
     */
    private handlePanelDragStart;
    /**
     * Forwards global key press and release events to the bus.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupKeyBoardHandlers;
    /**
     * Binds Enter and arrow-key navigation between squares.
     * @returns Nothing.
     * Used by: Interaction bindAllEvents flow.
     */
    private setupKeyboardNavigation;
}
export default Interaction;
