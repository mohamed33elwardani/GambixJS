import type { EventHandler } from "../types/types.ts";
/**
 * Typed publish/subscribe bus for chess UI events.
 * Used by: Gambix internal wiring, Interaction pointer flow, Promotion flow.
 */
export default class EventBus<TEvents extends object> {
    private listeners;
    private wrapperMap;
    /**
     * Subscribes a handler to an event.
     * @param eventName - The event name to listen to.
     * @param handler - The callback invoked with the event payload.
     * @returns An unsubscribe function that removes the handler.
     * Used by: Gambix internal wiring, Interaction pointer flow, Promotion flow.
     */
    on<TKey extends keyof TEvents>(eventName: TKey, handler: EventHandler<TEvents[TKey]>): () => void;
    /**
     * Subscribes a handler that fires only once then auto-removes.
     * @param eventName - The event name to listen to.
     * @param handler - The callback invoked once with the event payload.
     * @returns An unsubscribe function that cancels the pending handler.
     * Used by: Gambix internal wiring, one-shot event consumers.
     */
    once<TKey extends keyof TEvents>(eventName: TKey, handler: EventHandler<TEvents[TKey]>): () => void;
    /**
     * Removes a previously registered handler for an event.
     * @param eventName - The event name to unsubscribe from.
     * @param handler - The original handler passed to on or once.
     * @returns Nothing.
     * Used by: EventBus on/once unsubscribe closures.
     */
    off<TKey extends keyof TEvents>(eventName: TKey, handler: EventHandler<TEvents[TKey]>): void;
    /**
     * Emits an event payload to all subscribed handlers.
     * @param eventName - The event name to emit.
     * @param payload - The payload passed to each handler.
     * @returns Nothing.
     * Used by: Interaction pointer flow, Promotion flow, Gambix internal wiring.
     */
    emit<TKey extends keyof TEvents>(eventName: TKey, payload?: TEvents[TKey]): void;
}
