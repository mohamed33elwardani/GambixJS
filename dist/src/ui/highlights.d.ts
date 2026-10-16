import EventBus from "../events/event-bus.ts";
import type { ChessEvents, HighlightRecord, HighlightsConfig } from "../types/types.ts";
/**
 * Manages square highlights for selection, moves, check and user marks.
 *
 * Used by: Gambix facade, interaction event flow, UI tests.
 */
declare class Highlights {
    highlightsConfig: HighlightsConfig;
    keys: Map<string, string>;
    activeColor: string;
    mainColor: string;
    private eventBus;
    private root;
    private getBoardSize;
    private hasPiece;
    private unsubs;
    private dotRatio;
    private ringRatio;
    private highlightMap;
    private lastMove;
    private checkSquare;
    private mateSquares;
    private selectedSquare;
    private legalMoves;
    /**
     * Creates highlight state and wires it to config and events.
     *
     * @param eventBus - Shared chess event bus.
     * @param config - Highlight colors and behavior flags.
     * @param root - Board root element for queries and CSS vars.
     * @param getBoardSize - Returns the current board size in px.
     * @param hasPiece - Optional piece-presence checker per square.
     * @returns Nothing.
     * Used by: Gambix setup, test fixtures.
     */
    constructor(eventBus: EventBus<ChessEvents>, config: HighlightsConfig, root: HTMLElement, getBoardSize: () => number, hasPiece?: (square: string) => boolean);
    /**
     * Finds the DOM element for a board square.
     *
     * @param square - Square name such as e4.
     * @returns The square element, or null when invalid or missing.
     * Used by: highlight, last-move, check and legal-move methods.
     */
    private squareEl;
    /**
     * Builds the internal map key for a highlight record.
     *
     * @param kind - Highlight kind such as user or lastmove.
     * @param square - Square name.
     * @returns Composite map key.
     * Used by: track, untrack.
     */
    private mapKey;
    /**
     * Stores a highlight record in the internal map.
     *
     * @param record - Highlight record to store.
     * @returns Nothing.
     * Used by: all highlight setters.
     */
    private track;
    /**
     * Removes a highlight record from the internal map.
     *
     * @param kind - Highlight kind.
     * @param square - Square name.
     * @returns Nothing.
     * Used by: all highlight clear methods.
     */
    private untrack;
    /**
     * Returns a snapshot of all tracked highlight records.
     *
     * @returns List of highlight records.
     * Used by: Gambix public API, tests.
     */
    getHighlights(): HighlightRecord[];
    /**
     * Returns the current square size in px.
     *
     * @returns Board size divided by 8, with fallback.
     * Used by: initRatios, setCSSVariables, setLegalMoveRatios.
     */
    private currentSquare;
    /**
     * Initializes legal-move dot and ring ratios from config.
     *
     * @returns Nothing.
     * Used by: Highlights constructor.
     */
    private initRatios;
    /**
     * Resolves the CSS background for a highlight style.
     *
     * @param style - Highlight style with type, color and enable flag.
     * @returns CSS background value or transparent when disabled.
     * Used by: setCSSVariables.
     */
    private resolveHighlightBackground;
    /**
     * Writes highlight colors and sizes to CSS variables.
     *
     * @returns Nothing.
     * Used by: constructor, updateScale, setLegalMoveRatios, refreshFromConfig.
     */
    private setCSSVariables;
    /**
     * Updates the board-size dependent CSS variables.
     *
     * @param boardSize - New board size in px.
     * @returns Nothing.
     * Used by: Gambix resize flow, tests.
     */
    updateScale(boardSize: number): void;
    /**
     * Sets legal-move dot and ring ratios with clamping.
     *
     * @param dotRatio - Dot size ratio or absolute px value.
     * @param ringRatio - Ring size ratio or absolute px value.
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    setLegalMoveRatios(dotRatio: number, ringRatio: number): void;
    /**
     * Subscribes highlights to selection and drawing events.
     *
     * @returns Nothing.
     * Used by: Highlights constructor.
     */
    private bindEvents;
    /**
     * Reloads colors and key bindings from the current config.
     *
     * @returns Nothing.
     * Used by: Gambix config updates, tests.
     */
    refreshFromConfig(): void;
    /**
     * Unsubscribes events and clears highlight state.
     *
     * @returns Nothing.
     * Used by: Gambix destroy, test teardown.
     */
    destroy(): void;
    /**
     * Highlights the selected square when it holds a piece.
     *
     * @param square - Square name to select.
     * @returns Nothing.
     * Used by: square-selected event handler, Gambix API.
     */
    highlightSelectedSquare(square: string): void;
    /**
     * Clears the selected-square highlight.
     *
     * @returns Nothing.
     * Used by: selection and move event handlers.
     */
    private clearSelectionHighlights;
    /**
     * Reports whether manual highlighting is enabled.
     *
     * @returns True when highlighting is enabled.
     * Used by: highlightSquare, highlight-square event handler.
     */
    isEnabledState(): boolean;
    /**
     * Enables or disables manual highlighting.
     *
     * @param v - True to enable, false to disable.
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    setEnabledState(v: boolean): void;
    /**
     * Toggles a user or locked highlight on a square.
     *
     * @param square - Square name to highlight.
     * @param persistent - True for a locked highlight surviving clears.
     * @returns Nothing.
     * Used by: highlight-square event, highlightSquarePersistent, tests.
     */
    highlightSquare(square: string, persistent?: boolean): void;
    /**
     * Applies a persistent highlight with an optional color override.
     *
     * @param square - Square name to highlight.
     * @param color - Optional color replacing the active color.
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    highlightSquarePersistent(square: string, color?: string): void;
    /**
     * Marks the last-move start and end squares.
     *
     * @param from - Start square.
     * @param to - End square.
     * @returns Nothing.
     * Used by: Gambix move flow, tests.
     */
    setLastMove(from: string, to: string): void;
    /**
     * Removes the last-move highlight.
     *
     * @returns Nothing.
     * Used by: setLastMove, Gambix move flow, tests.
     */
    clearLastMove(): void;
    /**
     * Returns the current last-move squares.
     *
     * @returns Last-move from/to pair, or null when none.
     * Used by: Gambix API, tests.
     */
    getLastMove(): {
        from: string;
        to: string;
    } | null;
    /**
     * Marks the square of the king in check.
     *
     * @param square - Checked king square, or null to clear.
     * @returns Nothing.
     * Used by: Gambix check flow, tests.
     */
    setCheck(square: string | null): void;
    /**
     * Removes the in-check highlight.
     *
     * @returns Nothing.
     * Used by: setCheck, Gambix check flow, tests.
     */
    clearCheck(): void;
    /**
     * Returns the currently checked square.
     *
     * @returns Checked square, or null when none.
     * Used by: Gambix API, tests.
     */
    getCheck(): string | null;
    /**
     * Marks checkmate winner and loser squares.
     *
     * @param winnerSquare - Winner square or null.
     * @param loserSquare - Loser square or null.
     * @returns Nothing.
     * Used by: Gambix checkmate flow, tests.
     */
    setCheckmate(winnerSquare: string | null, loserSquare: string | null): void;
    /**
     * Removes checkmate winner and loser highlights.
     *
     * @returns Nothing.
     * Used by: setCheckmate, Gambix checkmate flow, tests.
     */
    clearCheckmate(): void;
    /**
     * Shows legal-move dots or rings for the given squares.
     *
     * @param squares - Candidate destination squares.
     * @param hasPiece - Optional occupancy checker override.
     * @returns Nothing.
     * Used by: Gambix selection flow, tests.
     */
    setLegalMoves(squares: string[], hasPiece?: (sq: string) => boolean): void;
    /**
     * Removes all legal-move dots and rings.
     *
     * @returns Nothing.
     * Used by: setLegalMoves, Gambix selection flow, tests.
     */
    clearLegalMoves(): void;
    /**
     * Clears manual highlights for the clear-draw event.
     *
     * @returns Nothing.
     * Used by: clear-draw event handler.
     */
    private clearManualHighlights;
    /**
     * Clears non-persistent user highlights.
     *
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    clearHighlights(): void;
    /**
     * Removes user highlights while keeping locked ones.
     *
     * @returns Nothing.
     * Used by: clearManualHighlights, clearHighlights.
     */
    private clearUserHighlights;
    /**
     * Clears every highlight including locked and game state marks.
     *
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    clearHighlightsAll(): void;
    /**
     * Removes any highlight from one square and emits a toggle event.
     *
     * @param square - Square name to clear.
     * @returns Nothing.
     * Used by: Gambix API, tests.
     */
    removeHighlightSquare(square: string): void;
}
export default Highlights;
