import type Board from "./board.ts";
import type { BoardAnimationOptions, ChessEvents } from "../types/types.ts";
import type EventBus from "../events/event-bus.ts";
/**
 * Read-only view of square to piece-code mapping.
 *
 * Used by: BoardAnimator.renderSnapshot, Board position sync.
 */
type PositionView = ReadonlyMap<string, string | null>;
/**
 * Animates piece moves, spawns and captures between board snapshots.
 *
 * Used by: Board.applyFenDiff, Board.syncPieces flow, UI tests.
 */
export default class BoardAnimator {
    private board;
    private eventBus?;
    private lastMoveTime;
    private generation;
    private promoTimeouts;
    options: BoardAnimationOptions;
    /**
     * Creates an animator bound to a board and event bus.
     *
     * @param board - Owning board instance.
     * @param options - Animation durations and behavior flags.
     * @param eventBus - Shared chess event bus.
     * @returns Nothing.
     * Used by: Board constructor.
     */
    constructor(board: Board, options: BoardAnimationOptions, eventBus: EventBus<ChessEvents>);
    /**
     * Invalidates pending delayed animation callbacks.
     *
     * @returns Nothing.
     * Used by: Board.applyFenDiff, Board.destroy, tests.
     */
    cancelPending(): void;
    /**
     * Resolves the effective animation config with auto-speed handling.
     *
     * @param type - Animation category: move, capture or spawn.
     * @returns Effective config with duration and easing.
     * Used by: animatePieceMove, spawn, discard, promotion flow.
     */
    private getEffectiveConfig;
    /**
     * Animates one piece element from a square to another.
     *
     * @param from - Start square.
     * @param to - End square.
     * @param isCapture - Whether the move captures a piece.
     * @returns Nothing.
     * Used by: renderSnapshot move and promotion flows.
     */
    private animatePieceMove;
    /**
     * Creates a piece element with an optional fade-in.
     *
     * @param pieceCode - Piece code such as wq.
     * @param square - Target square.
     * @returns Nothing.
     * Used by: renderSnapshot spawn and promotion flows.
     */
    private spawn;
    /**
     * Removes a piece element with an optional fade-out.
     *
     * @param square - Square holding the piece to discard.
     * @returns Nothing.
     * Used by: renderSnapshot capture and discard flows.
     */
    private discard;
    /**
     * Diffs two positions and animates moves, captures and promotions.
     *
     * @param oldMap - Position before the change.
     * @param newMap - Position after the change.
     * @returns Nothing.
     * Used by: Board.applyFenDiff, tests.
     */
    renderSnapshot(oldMap: PositionView, newMap: PositionView): void;
}
export {};
