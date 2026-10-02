import type { EventHandler } from "../types/types.ts";

/**
 * Internal stored handler signature used in the listener maps.
 * Used by: EventBus internal wiring.
 */
type StoredHandler = (payload: unknown) => void;

/**
 * Casts a typed event handler to the internal stored handler type.
 * @param handler - The typed event handler to store.
 * @returns The same handler as a stored handler.
 * Used by: EventBus on/once registration flow.
 */
function asStored<TPayload>(handler: EventHandler<TPayload>): StoredHandler {
  return handler as unknown as StoredHandler;
}

/**
 * Typed publish/subscribe bus for chess UI events.
 * Used by: Gambix internal wiring, Interaction pointer flow, Promotion flow.
 */
export default class EventBus<TEvents extends object> {
  private listeners = new Map<keyof TEvents, Set<StoredHandler>>();
  private wrapperMap = new Map<StoredHandler, Set<StoredHandler>>();

  /**
   * Subscribes a handler to an event.
   * @param eventName - The event name to listen to.
   * @param handler - The callback invoked with the event payload.
   * @returns An unsubscribe function that removes the handler.
   * Used by: Gambix internal wiring, Interaction pointer flow, Promotion flow.
   */
  public on<TKey extends keyof TEvents>(
    eventName: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): () => void {
    const handlers = this.listeners.get(eventName) ?? new Set();
    const stored = asStored(handler);
    handlers.add(stored);
    this.listeners.set(eventName, handlers);

    return () => this.off(eventName, handler);
  }

  /**
   * Subscribes a handler that fires only once then auto-removes.
   * @param eventName - The event name to listen to.
   * @param handler - The callback invoked once with the event payload.
   * @returns An unsubscribe function that cancels the pending handler.
   * Used by: Gambix internal wiring, one-shot event consumers.
   */
  public once<TKey extends keyof TEvents>(
    eventName: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): () => void {
    const originalStored = asStored(handler);
    let wrapperStored!: StoredHandler;
    const wrapper: EventHandler<TEvents[TKey]> = (payload) => {
      this.listeners.get(eventName)?.delete(wrapperStored);
      const wrappers = this.wrapperMap.get(originalStored);
      if (wrappers) {
        wrappers.delete(wrapperStored);
        if (wrappers.size === 0) this.wrapperMap.delete(originalStored);
      }
      handler(payload);
    };
    wrapperStored = asStored(wrapper);
    let wrappers = this.wrapperMap.get(originalStored);
    if (!wrappers) {
      wrappers = new Set();
      this.wrapperMap.set(originalStored, wrappers);
    }
    wrappers.add(wrapperStored);

    const handlers = this.listeners.get(eventName) ?? new Set();
    handlers.add(wrapperStored);
    this.listeners.set(eventName, handlers);

    return () => this.off(eventName, handler);
  }

  /**
   * Removes a previously registered handler for an event.
   * @param eventName - The event name to unsubscribe from.
   * @param handler - The original handler passed to on or once.
   * @returns Nothing.
   * Used by: EventBus on/once unsubscribe closures.
   */
  public off<TKey extends keyof TEvents>(
    eventName: TKey,
    handler: EventHandler<TEvents[TKey]>,
  ): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;

    const stored = asStored(handler);
    handlers.delete(stored);

    const wrapped = this.wrapperMap.get(stored);
    if (wrapped) {
      for (const w of wrapped) handlers.delete(w);
      this.wrapperMap.delete(stored);
    }
  }

  /**
   * Emits an event payload to all subscribed handlers.
   * @param eventName - The event name to emit.
   * @param payload - The payload passed to each handler.
   * @returns Nothing.
   * Used by: Interaction pointer flow, Promotion flow, Gambix internal wiring.
   */
  public emit<TKey extends keyof TEvents>(
    eventName: TKey,
    payload?: TEvents[TKey],
  ): void {
    const handlers = this.listeners.get(eventName);
    if (!handlers) return;
    for (const handler of [...handlers]) {
      try {
        handler(payload);
      } catch (err) {
        console.error(
          `[Gambix] handler failed for "${String(eventName)}":`,
          err,
        );
      }
    }
  }
}
