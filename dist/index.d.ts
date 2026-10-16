import Board from "./src/ui/board.ts";
import Interaction from "./src/ui/interaction.ts";
import PluginManager from "./src/plugins/plugin-manager.ts";
import type { BoardAnimationOptions, GambixPlugin } from "./src/types/types.ts";
import type { ChessEvents } from "./src/types/types.ts";
import "./src/style/style.css";
import type { ThemeConfig, InteractionConfig, DrawingConfig, HighlightsConfig, ChessOptions, HighlightRecord, MoveRequestPayload } from "./src/types/types.ts";
import Arrows from "./src/ui/arrows.ts";
import Highlights from "./src/ui/highlights.ts";
/**
 * Main chessboard UI facade: owns the board, interaction, drawing,
 * highlights, promotion flow, FEN store, and plugins.
 * Used by: library consumers via `new Gambix(selector, options)`.
 */
declare class Gambix {
    rootElement: HTMLElement;
    theme: ThemeConfig;
    board: Board;
    interactionSettings: InteractionConfig;
    interaction?: Interaction;
    drawing: DrawingConfig;
    draw?: Arrows;
    highlights: HighlightsConfig;
    highlighter: Highlights;
    private fenStore;
    private promotion;
    plugins: PluginManager;
    private eventBus;
    private coreUnsubs;
    /**
     * Creates the board inside the given selector and wires all subsystems.
     * @param element - CSS selector of the container HTMLElement.
     * @param props - Optional ChessOptions (theme, fen, callbacks, plugins).
     * @returns Nothing (constructor). Throws when the selector matches nothing.
     * Used by: library consumers.
     */
    constructor(element: string, props?: ChessOptions);
    /**
     * Subscribes the callbacks passed via ChessOptions to internal events.
     * @param safeProps - Normalized constructor options.
     * @returns Nothing.
     * Used by: Gambix constructor.
     */
    private bindOptionCallbacks;
    /**
     * Re-initializes interaction and drawing overlays after layout changes.
     * @returns Nothing.
     * Used by: flipBoard, resize, setTheme, reStyle* methods.
     */
    private refreshOverlays;
    /**
     * Forwards interaction:* events to their public board:* counterparts.
     * @returns Nothing.
     * Used by: Gambix constructor.
     */
    private bindCoreEvents;
    /**
     * Tears down all subsystems, listeners, and plugins.
     * @returns Nothing.
     * Used by: library consumers, test teardown.
     */
    destroy(): void;
    /**
     * Installs a plugin after construction.
     * @param plugin - The GambixPlugin to install.
     * @returns Nothing. Throws when a plugin with the same name exists.
     * Used by: library consumers.
     */
    usePlugin(plugin: GambixPlugin): void;
    /**
     * Toggles the board orientation between white and black.
     * @returns Nothing.
     * Used by: library consumers.
     */
    flipBoard(): void;
    /**
     * Resizes the board to the given width in pixels.
     * @param width - New board width in pixels.
     * @returns Nothing.
     * Used by: library consumers, auto-resize observer.
     */
    resize(width: number): void;
    /**
     * Deep-merges a partial theme into the current theme and re-renders.
     * @param theme - Partial ThemeConfig to apply.
     * @returns Nothing.
     * Used by: library consumers.
     */
    setTheme(theme: Partial<ThemeConfig>): void;
    /**
     * Updates legal-move dot/ring size ratios.
     * @param dotRatio - Dot diameter ratio. @param ringRatio - Ring thickness ratio.
     * @returns Nothing.
     * Used by: library consumers.
     */
    setLegalMoveRatio(dotRatio: number, ringRatio: number): void;
    /**
     * Recomputes legal-move marker scale for the current board size.
     * @returns Nothing.
     * Used by: library consumers.
     */
    updateLegalMoveScale(): void;
    /**
     * Returns the live theme object (kept in sync with Board.theme).
     * @returns The current ThemeConfig.
     * Used by: library consumers, PromotionManager theme lookup.
     */
    getTheme(): ThemeConfig;
    /**
     * Returns the current position as a FEN string.
     * @returns The current FEN.
     * Used by: library consumers.
     */
    getFEN(): string;
    /**
     * Loads a new position, diffing and animating only changed squares.
     * Reloading the current FEN is a silent no-op (no redraw, no event).
     * @param fen - The FEN string to load.
     * @returns True when the FEN is valid, false otherwise.
     * Used by: library consumers (usually after logic.move succeeds).
     */
    loadFEN(fen: string): boolean;
    /**
     * Returns every square with its current piece code (or null).
     * @returns Array of { square, piece } entries for all 64 squares.
     * Used by: library consumers.
     */
    getBoard(): Array<{
        square: string;
        piece: string | null;
    }>;
    /**
     * Returns the piece on a square, if any.
     * @param square - Square name (e.g. "e4").
     * @returns { type, color } or null when the square is empty.
     * Used by: library consumers.
     */
    getPiece(square: string): {
        type: string;
        color: string;
    } | null;
    /**
     * Returns which side(s) the user can move pieces for.
     * @returns "white" | "black" | "both" | "none".
     * Used by: library consumers.
     */
    getPlayer(): "white" | "black" | "both" | "none";
    /**
     * Snaps back any displaced piece and clears legal moves.
     * @returns Nothing.
     * Used by: library consumers, onMoveRequested rejection flow.
     */
    rejectMove(): void;
    /**
     * Snaps back the piece moved from/to the given squares.
     * @param from - Origin square. @param to - Drop square (or null).
     * @returns Nothing.
     * Used by: onMoveRequested handlers, PromotionManager cancellations.
     */
    rejectMoveFrom(from: string, to?: string | null): void;
    /**
     * Enables board resizing that follows the parent element width.
     * @returns Nothing.
     * Used by: library consumers, constructor when theme.autoResize is set.
     */
    enableAutoResize(): void;
    /**
     * Disables the parent-following auto-resize observer.
     * @returns Nothing.
     * Used by: library consumers, setTheme when autoResize is turned off.
     */
    disableAutoResize(): void;
    /**
     * Draws a persistent arrow between two squares.
     * @param start - Origin square. @param end - Target square.
     * @param color - Optional arrow color. @param width - Optional line width.
     * @returns True when the arrow was added.
     * Used by: library consumers.
     */
    drawArrow(start: string, end: string, color?: string, width?: number): boolean;
    /**
     * Removes the arrow between two squares, if present.
     * @param start - Origin square. @param end - Target square.
     * @returns True when an arrow was removed.
     * Used by: library consumers.
     */
    removeArrow(start: string, end: string): boolean;
    /**
     * Clears non-persistent arrows from the board.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearArrows(): void;
    /**
     * Clears all arrows, including persistent ones.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearArrowsAll(): void;
    /**
     * Returns all currently drawn arrows.
     * @returns Array of { from, to, color, persistent } records.
     * Used by: library consumers.
     */
    getArrows(): Array<{
        from: string;
        to: string;
        color: string;
        persistent: boolean;
    }>;
    /**
     * Enables right-button arrow drawing.
     * @returns Nothing.
     * Used by: library consumers.
     */
    enableDraw(): void;
    /**
     * Disables right-button arrow drawing.
     * @returns Nothing.
     * Used by: library consumers.
     */
    disableDraw(): void;
    /**
     * Adds a persistent highlight to a square.
     * @param square - Square name. @param color - Optional highlight color.
     * @returns Nothing.
     * Used by: library consumers.
     */
    setHighlight(square: string, color?: string): void;
    /**
     * Removes the persistent highlight from a square.
     * @param square - Square name.
     * @returns Nothing.
     * Used by: library consumers.
     */
    removeHighlight(square: string): void;
    /**
     * Clears non-persistent highlights.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearHighlights(): void;
    /**
     * Clears all highlights, including persistent ones.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearHighlightsAll(): void;
    /**
     * Returns all active highlight records.
     * @returns Array of HighlightRecord entries.
     * Used by: library consumers.
     */
    getHighlights(): HighlightRecord[];
    /**
     * Enables square highlights.
     * @returns Nothing.
     * Used by: library consumers.
     */
    enableHighlights(): void;
    /**
     * Disables square highlights.
     * @returns Nothing.
     * Used by: library consumers.
     */
    disableHighlights(): void;
    /**
     * Marks the last-move squares (or clears them when null).
     * @param from - Origin square or null. @param to - Target square or null.
     * @returns Nothing.
     * Used by: library consumers (usually after loadFEN).
     */
    setLastMove(from: string | null, to: string | null): void;
    /**
     * Returns the currently marked last-move squares.
     * @returns { from, to } or null when none is marked.
     * Used by: library consumers.
     */
    getLastMove(): {
        from: string;
        to: string;
    } | null;
    /**
     * Marks the king square currently in check.
     * @param square - King square or null to clear.
     * @returns Nothing.
     * Used by: library consumers.
     */
    setCheck(square: string | null): void;
    /**
     * Clears the in-check marker.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearCheck(): void;
    /**
     * Marks the checkmate winner/loser squares.
     * @param winnerSquare - Winner king square or null.
     * @param loserSquare - Loser king square or null.
     * @returns Nothing.
     * Used by: library consumers.
     */
    setCheckmate(winnerSquare: string | null, loserSquare: string | null): void;
    /**
     * Clears the checkmate markers.
     * @returns Nothing.
     * Used by: library consumers.
     */
    clearCheckmate(): void;
    /**
     * Enables move animations.
     * @returns Nothing.
     * Used by: library consumers.
     */
    enableAnimations(): void;
    /**
     * Disables move animations.
     * @returns Nothing.
     * Used by: library consumers.
     */
    disableAnimations(): void;
    /**
     * Merges animation options (and snapback options) into the live config.
     * @param cfg - Partial BoardAnimationOptions to apply.
     * @returns Nothing.
     * Used by: library consumers.
     */
    updateAnimationConfig(cfg: BoardAnimationOptions): void;
    /**
     * Restyles light/dark square colors and re-syncs the live theme.
     * @param whiteSquareColor - New light-square color.
     * @param blackSquareColor - New dark-square color.
     * @returns Nothing.
     * Used by: library consumers.
     */
    reStyleBoard(whiteSquareColor: string, blackSquareColor: string): void;
    /**
     * Restyles board coordinates and re-syncs the live theme.
     * @param cfg - Partial coordinate theme to apply.
     * @returns Nothing.
     * Used by: library consumers.
     */
    reStyleCoords(cfg: Partial<ThemeConfig["coord"]>): void;
    /**
     * Restyles pieces and re-syncs the live theme.
     * @param cfg - Partial pieces theme to apply.
     * @returns Nothing.
     * Used by: library consumers.
     */
    reStylePiece(cfg: Partial<ThemeConfig["pieces"]>): void;
    /**
     * Returns the current board orientation.
     * @returns "white" or "black".
     * Used by: library consumers.
     */
    getOrientation(): "white" | "black";
    /**
     * Enables piece interaction for the given side(s), creating it if needed.
     * @param player - "white" | "black" | "both".
     * @returns Nothing.
     * Used by: library consumers.
     */
    enableInteractionFor(player: "white" | "black" | "both"): void;
    /**
     * Disables all piece interaction (control becomes "none").
     * @returns Nothing.
     * Used by: library consumers.
     */
    disableInteractionFor(): void;
    /**
     * Returns the live interaction settings.
     * @returns The current InteractionConfig.
     * Used by: library consumers.
     */
    getInteractionSettings(): InteractionConfig;
    /**
     * Subscribes to piece selection; returning squares shows them as legal moves.
     * @param cb - Callback receiving { square, piece }, may return string[].
     * @returns Unsubscribe function.
     * Used by: library consumers (usually wired to chess.js moves).
     */
    onPieceSelected(cb: (data: {
        square: string;
        piece: string | null;
    }) => string[] | void): () => void;
    /**
     * Subscribes to square selection events.
     * @param cb - Callback receiving { square, piece }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onSquareSelected(cb: (data: {
        square: string;
        piece: string | null;
    }) => void): () => void;
    /**
     * Subscribes to move requests; return false (or Promise<false>) to snap back.
     * A rejected/thrown async handler is logged and treated as a rejection.
     * @param cb - Callback receiving { from, to, promotion? }.
     * @returns Unsubscribe function.
     * Used by: library consumers (game-logic validation layer).
     */
    onMoveRequested(cb: (data: MoveRequestPayload) => boolean | void | Promise<boolean | void>): () => void;
    /**
     * Subscribes to FEN changes applied via loadFEN.
     * @param cb - Callback receiving the new FEN string.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onFenChanged(cb: (fen: string) => void): () => void;
    /**
     * Subscribes to piece drag-start events.
     * @param cb - Callback receiving { square, piece }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDragStart(cb: (data: {
        square: string;
        piece: string | null;
    }) => void): () => void;
    /**
     * Subscribes to piece drag-end events.
     * @param cb - Callback receiving { from, to, piece }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDragEnd(cb: (data: {
        from: string;
        to: string | null;
        piece: string | null;
    }) => void): () => void;
    /**
     * Subscribes to promotion requests; return a piece ("q"|"r"|"b"|"n") to
     * auto-pick, false to reject, or nothing to show the picker UI.
     * @param cb - Callback receiving { from, to, color, piece }.
     * @returns Unsubscribe function.
     * Used by: library consumers, PromotionManager intercept flow.
     */
    onPromotionRequested(cb: (data: {
        from: string;
        to: string;
        color: string;
        piece: string | null;
    }) => string | false | void | Promise<string | false | void>): () => void;
    /**
     * Subscribes to promotion choices (exactly one emit per choice).
     * @param cb - Callback receiving { from, to, promotion }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onPromotionSelected(cb: (data: {
        from: string;
        to: string;
        promotion: string;
    }) => void): () => void;
    /**
     * Subscribes to promotion cancellations.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onPromotionCancelled(cb: (data: {
        from: string;
        to: string;
    }) => void): () => void;
    /**
     * Programmatically answers a pending promotion (or a real candidate move).
     * Non-promotion moves are ignored with a dev warning.
     * @param from - Origin square. @param to - Target square.
     * @param promotion - "q" | "r" | "b" | "n" (case-insensitive).
     * @returns Nothing.
     * Used by: library consumers.
     */
    choosePromotion(from: string, to: string, promotion: string): void;
    /**
     * Cancels the pending promotion picker, if any, with a snapback.
     * @returns Nothing.
     * Used by: library consumers.
     */
    cancelPromotion(): void;
    /**
     * Returns the currently pending promotion, if any.
     * @returns { from, to, color } or null when no picker is open.
     * Used by: library consumers.
     */
    getPromotionPending(): {
        from: string;
        to: string;
        color: string;
    } | null;
    /**
     * Subscribes to arrow-drawing start events.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDrawStart(cb: (data: {
        from: string;
        to: string;
    }) => void): () => void;
    /**
     * Subscribes to arrow-drawing move events.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDrawMove(cb: (data: {
        from: string;
        to: string;
    }) => void): () => void;
    /**
     * Subscribes to arrow-drawing end events.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDrawEnd(cb: (data: {
        from: string;
        to: string;
    }) => void): () => void;
    /**
     * Subscribes to drawing-cleared events.
     * @param cb - Callback receiving no payload.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onDrawCleared(cb: () => void): () => void;
    /**
     * Subscribes to arrow-added events.
     * @param cb - Callback receiving { from, to, color }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onArrowAdded(cb: (data: {
        from: string;
        to: string;
        color: string;
    }) => void): () => void;
    /**
     * Subscribes to arrow-removed events.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onArrowRemoved(cb: (data: {
        from: string;
        to: string;
    }) => void): () => void;
    /**
     * Subscribes to arrows-cleared events.
     * @param cb - Callback receiving no payload.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onArrowsCleared(cb: () => void): () => void;
    /**
     * Subscribes to highlight-toggled events.
     * @param cb - Callback receiving { square, active, color? }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onHighlightToggled(cb: (data: {
        square: string;
        active: boolean;
        color?: string;
    }) => void): () => void;
    /**
     * Subscribes to highlights-cleared events.
     * @param cb - Callback receiving no payload.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onHighlightsCleared(cb: () => void): () => void;
    /**
     * Subscribes to right-click square-highlight intents.
     * @param cb - Callback receiving the square name.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onSquareHighlight(cb: (square: string) => void): () => void;
    /**
     * Subscribes to piece-placed events (customizable board editing).
     * @param cb - Callback receiving { to, piece }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onPiecePlaced(cb: (data: {
        to: string;
        piece: string;
    }) => void): () => void;
    /**
     * Subscribes to piece-removed events (dropping a piece off the board).
     * @param cb - Callback receiving { from }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onPieceRemoved(cb: (data: {
        from: string;
    }) => void): () => void;
    /**
     * Subscribes to key-pressed events while interacting with the board.
     * @param cb - Callback receiving the pressed key.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onKeyPressed(cb: (key: string) => void): () => void;
    /**
     * Subscribes to key-up events while interacting with the board.
     * @param cb - Callback receiving the released key.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onKeyUp(cb: (key: string) => void): () => void;
    /**
     * Subscribes to move-animation completion events.
     * @param cb - Callback receiving { from, to, isCapture }.
     * @returns Unsubscribe function.
     * Used by: library consumers.
     */
    onMoveAnimatedEnd(cb: (data: {
        from: string;
        to: string;
        isCapture: boolean;
    }) => void): () => void;
    /**
     * Subscribes to snapback events fired after move rejections.
     * @param cb - Callback receiving { from, to }.
     * @returns Unsubscribe function.
     * Used by: library consumers, rejection-flow tests.
     */
    onSnapbackTriggered(cb: (data: {
        from: string;
        to: string | null;
    }) => void): () => void;
    /**
     * Generic subscription to any typed ChessEvents event.
     * @param event - Event name. @param cb - Callback receiving the payload.
     * @returns Unsubscribe function.
     * Used by: library consumers, plugins.
     */
    on<T extends keyof ChessEvents>(event: T, cb: (payload: ChessEvents[T]) => void): () => void;
    /**
     * Removes a previously registered event handler.
     * @param event - Event name. @param cb - The exact callback to remove.
     * @returns Nothing.
     * Used by: library consumers, plugins.
     */
    off<T extends keyof ChessEvents>(event: T, cb: (payload: ChessEvents[T]) => void): void;
    /**
     * Subscribes a one-shot handler that auto-removes after the first emit.
     * @param event - Event name. @param cb - Callback receiving the payload.
     * @returns Unsubscribe function that cancels before the first emit.
     * Used by: library consumers, plugins.
     */
    once<T extends keyof ChessEvents>(event: T, cb: (payload: ChessEvents[T]) => void): () => void;
    /**
     * Shows the given squares as legal-move markers.
     * @param squares - Square names to highlight.
     * @returns Nothing.
     * Used by: onPieceSelected flow, library consumers.
     */
    setLegalMoves(squares: string[]): void;
    /**
     * Clears all legal-move markers.
     * @returns Nothing.
     * Used by: rejectMove/rejectMoveFrom, library consumers.
     */
    clearLegalMoves(): void;
}
export { PluginManager };
export type { GambixPlugin, GambixPluginContext } from "./src/types/types.ts";
export default Gambix;
