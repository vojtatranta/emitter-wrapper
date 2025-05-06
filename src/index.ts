import events from "events";

export interface IEventEmitter<S = any> {
  emit(event: string, ...args: any[]): void;
  on(event: string, listener: (...args: any[]) => void): void;
  off(event: string, listener: (...args: any[]) => void): void;
  getState(): S;
}

export interface IInternalEventEmitter extends IEventEmitter {
  afterAny(listener: (...args: any[]) => void): void;
  ofAfterAny(listener: (...args: any[]) => void): void;
}

const ANY_EVENT = "InternalEventEmitter:ANY" as const;

export class InternalEventEmitter<S = any>
  extends events.EventEmitter
  implements IInternalEventEmitter
{
  constructor(private emitter: IEventEmitter) {
    super();
    const previousEmiter = emitter.emit.bind(emitter);
    emitter.emit = (event, ...args: any[]) => {
      previousEmiter(event, ...args);
      this.emit(ANY_EVENT);
    };
  }

  static fromEventEmitter(emitter: IEventEmitter): InternalEventEmitter {
    return new InternalEventEmitter(emitter);
  }

  afterAny(listener: (...args: any[]) => void): void {
    this.on(ANY_EVENT, listener);
  }

  ofAfterAny(listener: (...args: any[]) => void): void {
    this.off(ANY_EVENT, listener);
  }

  getState(): S {
    return this.emitter.getState() as S;
  }
}

export class EmitterWrapper<E extends IEventEmitter> {
  private emitter: IInternalEventEmitter;
  private originalEmitter: E;
  private defaultTimeout?: number;
  private matcher: (
    fixedState: ReturnType<E["getState"]>,
    state: ReturnType<E["getState"]>,
  ) => boolean;
  constructor(
    emitter: E,
    options: {
      defaultTimeout?: number;
      matcher?: (
        fixedState: ReturnType<E["getState"]>,
        state: ReturnType<E["getState"]>,
      ) => boolean;
    } = {},
  ) {
    this.originalEmitter = emitter;
    this.defaultTimeout = options.defaultTimeout;
    this.matcher =
      options.matcher ?? ((fixedState, state) => state === fixedState);
    this.emitter = InternalEventEmitter.fromEventEmitter(emitter);
  }

  static wrap<T extends IEventEmitter>(emitter: T): EmitterWrapper<T> {
    return new EmitterWrapper(emitter);
  }

  getState(): ReturnType<E["getState"]> {
    return this.emitter.getState();
  }

  inState<R extends ReturnType<E["getState"]>>(
    state: R,
    callback: (state: R, emitter: E) => any,
  ): EmitterWrapper<E> {
    const currentState = this.getState();
    if (this.matcher(state, currentState)) {
      callback(currentState, this.originalEmitter);
      return EmitterWrapper.wrap(this.originalEmitter);
    }

    const listener = () => {
      const localCurrentState = this.getState();
      if (this.matcher(state, localCurrentState)) {
        callback(localCurrentState, this.originalEmitter);
        this.emitter.ofAfterAny(listener);
      }
    };
    this.emitter.afterAny(listener);

    return EmitterWrapper.wrap(this.originalEmitter);
  }

  promised<R extends ReturnType<E["getState"]>>(
    state: R,
    options: {
      timeout?: number;
    } = {},
  ): Promise<E> {
    const abort = new AbortController();
    const timeout = options.timeout ?? this.defaultTimeout;
    const timeoutPromise = timeout
      ? new Promise<E>((_, reject) => {
          setTimeout(() => {
            abort.abort();
            reject(new Error("Timeout"));
          }, timeout);
        })
      : null;

    return Promise.race<E>([
      new Promise((resolve) => {
        this.inState(state, (_, emitter) => {
          abort.abort();
          resolve(emitter);
        });
      }),
      ...(timeoutPromise ? [timeoutPromise] : []),
    ]);
  }
}
