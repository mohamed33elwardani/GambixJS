import BoardAnimator from "./BoardAnimator.ts";
import type { BoardProps, FenDiff, ThemeConfig } from "../types/types.ts";
/**
 * Partial theme patch for restyling the board without full replacement.
 *
 * Used by: Board.reStyle, Gambix theme updates.
 */
interface ThemePatch {
    orientation?: ThemeConfig["orientation"];
    boardSize?: number;
    boardType?: ThemeConfig["boardType"];
    squares?: Partial<ThemeConfig["squares"]>;
    coord?: Partial<ThemeConfig["coord"]>;
    pieces?: Partial<ThemeConfig["pieces"]>;
    autoResize?: boolean;
}
/**
 * Renders the chessboard DOM and owns square and piece elements.
 *
 * Used by: Gambix facade, BoardAnimator, UI tests.
 */
export default class Board {
    element: HTMLElement | null;
    theme: ThemeConfig;
    animator: BoardAnimator;
    readonly uid: string;
    private boardElement;
    private wrapperElement;
    private containerElement;
    private squaresContainer;
    private piecesContainer;
    private rankBox;
    private fileBox;
    private outerRankCells;
    private outerFileCells;
    private squareEls;
    private pieceEls;
    private eventBus;
    private resizeObserver;
    private lastPosition;
    /**
     * Builds board DOM, layout and initial pieces.
     *
     * @param props - Board element, theme, event bus and position.
     * @returns Nothing.
     * Used by: Gambix setup, test helpers.
     */
    constructor(props: BoardProps);
    /**
     * Stores a copy of the current position map.
     *
     * @param position - Read-only square to piece mapping.
     * @returns Nothing.
     * Used by: Board constructor, syncPosition, applyFenDiff.
     */
    private setPositionSnapshot;
    /**
     * Replaces the position snapshot and syncs pieces without animation.
     *
     * @param position - New square to piece mapping.
     * @returns Nothing.
     * Used by: Gambix position updates, tests.
     */
    syncPosition(position: ReadonlyMap<string, string | null>): void;
    /**
     * Applies a FEN diff with optional animation.
     *
     * @param diff - Old and new position maps.
     * @param options - Set animate false to sync instantly.
     * @returns Nothing.
     * Used by: Gambix FEN updates, tests.
     */
    applyFenDiff(diff: FenDiff, options?: {
        animate?: boolean;
    }): void;
    /**
     * Builds wrapper, coordinate boxes, squares and containers.
     *
     * @returns Nothing.
     * Used by: Board constructor.
     */
    private buildDOM;
    /**
     * Updates layout classes and outer coordinates for orientation.
     *
     * @returns Nothing.
     * Used by: Board constructor, flipBoard, reStyle.
     */
    private updateLayout;
    /**
     * Writes board size, square and coordinate CSS variables.
     *
     * @returns Nothing.
     * Used by: updateLayout, resize.
     */
    private applyCssVars;
    /**
     * Returns display-ordered files for the current orientation.
     *
     * @returns File letters from a to h, reversed for black.
     * Used by: updateLayout, renderBoard.
     */
    private orderedFiles;
    /**
     * Returns display-ordered ranks for the current orientation.
     *
     * @returns Rank numbers from 8 to 1, reversed for black.
     * Used by: updateLayout, renderBoard.
     */
    private orderedRanks;
    /**
     * Renders square colors and reorders squares for orientation.
     *
     * @returns Nothing.
     * Used by: Board constructor, render, flipBoard, resize, reStyle.
     */
    private renderBoard;
    /**
     * Updates inner file and rank labels on one square.
     *
     * @param el - Square element to update.
     * @param row - Display row index.
     * @param col - Display column index.
     * @param displayFiles - Ordered file labels.
     * @param displayRanks - Ordered rank labels.
     * @param isLight - Whether the square is light-colored.
     * @param squareWidth - Square size in px.
     * @param show - Whether inner coords are visible.
     * @returns Nothing.
     * Used by: renderBoard.
     */
    private updateInnerCoords;
    /**
     * Maps a piece code to its display type name.
     *
     * @param pieceCode - Piece code such as wp or bk.
     * @returns Type name like pawn, knight or king.
     * Used by: createPieceElement.
     */
    private pieceTypeName;
    /**
     * Creates a piece DOM element positioned on a square.
     *
     * @param pieceCode - Piece code such as wp.
     * @param squareName - Square name such as e2.
     * @param squareWidth - Square size in px.
     * @returns The piece element, or null when assets are missing.
     * Used by: syncPieces, createAndAppendPieceElement.
     */
    private createPieceElement;
    /**
     * Syncs piece elements to the stored position snapshot.
     *
     * @returns Nothing.
     * Used by: Board constructor, syncPosition, applyFenDiff, render.
     */
    syncPieces(): void;
    /**
     * Re-renders squares and pieces together.
     *
     * @returns Nothing.
     * Used by: flipBoard, resize, reStyle.
     */
    private render;
    /**
     * Preloads white and black piece image assets.
     *
     * @returns Nothing.
     * Used by: Board constructor, reStyle.
     */
    private preloadAssets;
    /**
     * Returns the main board DOM element.
     *
     * @returns Board element, or null when not built.
     * Used by: Arrows attachment, Gambix API, tests.
     */
    getBoardElement(): HTMLElement | null;
    /**
     * Returns the piece element on a square.
     *
     * @param squareName - Square name such as e2.
     * @returns Piece element, or null when empty or invalid.
     * Used by: BoardAnimator, Highlights occupancy checks, tests.
     */
    getPieceElement(squareName: string): HTMLElement | null;
    /**
     * Creates and registers a piece element on a square.
     *
     * @param pieceCode - Piece code such as wq.
     * @param squareName - Target square.
     * @returns The created element, or null when assets are missing.
     * Used by: BoardAnimator.spawn, tests.
     */
    createAndAppendPieceElement(pieceCode: string, squareName: string): HTMLElement | null;
    /**
     * Moves a piece element registration from one square to another.
     *
     * @param from - Start square.
     * @param to - End square.
     * @returns Nothing.
     * Used by: BoardAnimator.animatePieceMove, tests.
     */
    remapPieceElement(from: string, to: string): void;
    /**
     * Unregisters the piece element on a square.
     *
     * @param square - Square name to clear.
     * @returns Nothing.
     * Used by: BoardAnimator.discard, promotion flow, tests.
     */
    removePieceElement(square: string): void;
    /**
     * Computes pixel coordinates for a square top-left position.
     *
     * @param squareName - Square name such as e4.
     * @returns X and Y pixel coordinates.
     * Used by: piece placement, BoardAnimator, tests.
     */
    getSquareCoords(squareName: string): {
        x: number;
        y: number;
    };
    /**
     * Flips the board orientation and re-renders.
     *
     * @param orientation - New orientation, white or black.
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    flipBoard(orientation: "white" | "black"): void;
    /**
     * Resizes the board and re-renders pieces and squares.
     *
     * @param width - New board size in px.
     * @returns Nothing.
     * Used by: Gambix resize flow, auto-resize callback, tests.
     */
    resize(width: number): void;
    /**
     * Merges a theme patch and re-renders the board.
     *
     * @param options - Partial theme fields to update.
     * @returns Nothing.
     * Used by: Gambix theme updates, tests.
     */
    reStyle(options: ThemePatch): void;
    /**
     * Returns the current board orientation.
     *
     * @returns White or black orientation.
     * Used by: Gambix API, tests.
     */
    getOrientation(): "white" | "black";
    /**
     * Observes a target element and reports significant width changes.
     *
     * @param target - Element to observe, if any.
     * @param getSize - Returns the current board size.
     * @param onResize - Called with the next width when changed.
     * @returns Nothing.
     * Used by: Gambix auto-resize setup, tests.
     */
    enableAutoResize(target: HTMLElement | null, getSize: () => number, onResize: (width: number) => void): void;
    /**
     * Stops observing board size changes.
     *
     * @returns Nothing.
     * Used by: Gambix teardown, destroy, tests.
     */
    disableAutoResize(): void;
    /**
     * Tears down observers, animations and board DOM.
     *
     * @returns Nothing.
     * Used by: Gambix destroy, test teardown.
     */
    destroy(): void;
}
export {};
