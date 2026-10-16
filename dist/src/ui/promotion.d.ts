import type { PromotionDeps, PromotionPending, PromotionRequestHandler } from "../types/types.ts";
/**
 * Re-exported promotion types for external consumers.
 * Used by: Gambix internal wiring, Promotion picker flow.
 */
export type { PromotionPending, PromotionRequestHandler, };
export type { PromotionDeps };
/**
 * Intercepts promotion moves and shows the promotion picker UI.
 * Used by: Gambix internal wiring, Promotion picker flow.
 */
export default class PromotionManager {
    private deps;
    private pending;
    private overlay;
    private backdrop;
    private unsubs;
    private requestHandlers;
    private requestId;
    private activeRequest;
    /**
     * Creates a promotion manager bound to board dependencies.
     * @param deps - Board accessors, event bus, and move callbacks.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    constructor(deps: PromotionDeps);
    /**
     * Subscribes to move requests and promotion selection forwarding.
     * @returns Nothing.
     * Used by: Gambix internal wiring.
     */
    attach(): void;
    /**
     * Removes all event subscriptions registered by attach.
     * @returns Nothing.
     * Used by: PromotionManager destroy flow, Gambix internal wiring.
     */
    detach(): void;
    /**
     * Clears pending state, handlers, subscriptions, and picker UI.
     * @returns Nothing.
     * Used by: Gambix internal wiring, Promotion teardown flow.
     */
    destroy(): void;
    /**
     * Returns the currently pending promotion choice, if any.
     * @returns The pending promotion data, or null when idle.
     * Used by: Gambix internal wiring, Promotion picker flow.
     */
    getPending(): PromotionPending | null;
    /**
     * Closes the picker and optionally cancels the pending promotion.
     * @param cancel - Whether to emit cancellation and reject the move.
     * @returns Nothing.
     * Used by: PromotionManager cancel/select/show flow.
     */
    hide(cancel: boolean): void;
    /**
     * Cancels the active promotion and rejects the move.
     * @returns Nothing.
     * Used by: Promotion picker backdrop and cancel flow.
     */
    cancel(): void;
    /**
     * Chooses a promotion piece for a move, pending or direct.
     * @param from - The origin square name.
     * @param to - The destination square name.
     * @param promotion - The requested promotion code.
     * @returns Nothing.
     * Used by: Promotion picker option and external API flow.
     */
    choose(from: string, to: string, promotion: string): void;
    /**
     * Registers a handler consulted before showing the picker.
     * @param cb - The handler receiving pending promotion data.
     * @returns An unsubscribe function that removes the handler.
     * Used by: Gambix internal wiring, Promotion auto-resolve flow.
     */
    onPromotionRequested(cb: PromotionRequestHandler): () => void;
    /**
     * Intercepts a move request and routes promotions to handlers or picker.
     * @param p - The requested move with from and to squares.
     * @returns A promise that resolves when routing completes.
     * Used by: PromotionManager attach wiring.
     */
    private intercept;
    /**
     * Confirms the pending promotion and forwards the completed move.
     * @param promotion - The chosen promotion code.
     * @returns Nothing.
     * Used by: PromotionManager choose and picker option flow.
     */
    private select;
    /**
     * Renders the promotion picker overlay for a pending promotion.
     * @param data - The pending promotion with from, to, and color.
     * @returns Nothing.
     * Used by: PromotionManager intercept flow.
     */
    private show;
}
