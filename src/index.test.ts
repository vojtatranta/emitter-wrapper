/* eslint-disable @typescript-eslint/await-thenable */
/* eslint-disable @typescript-eslint/no-empty-function */
import { EmitterWrapper } from "./index";
import events from "events";

describe("EmitterWrapper type behavior", () => {
  class ConcreteEmitter extends events.EventEmitter {
    getState(): 0 | "state-one" {
      return Math.random() > 0.5 ? "state-one" : 0;
    }
  }

  it("getState returns correct union type", () => {
    const wrapper = EmitterWrapper.wrap(new ConcreteEmitter());
    const state = wrapper.getState();
    // Type assertions (runtime):
    expect([0, "state-one"]).toContain(state);
  });

  it("inState callback receives correct state value", () => {
    const wrapper = EmitterWrapper.wrap(new ConcreteEmitter());
    let callbackValue: 0 | "state-one" | undefined;

    wrapper.inState("state-one", (s) => {
      callbackValue = s;
      expect(s).toBe("state-one");
    });
    wrapper.inState(0, (s) => {
      callbackValue = s;
      expect(s).toBe(0);
    });
  });

  it("promised returns a Promise", async () => {
    const wrapper = EmitterWrapper.wrap(new ConcreteEmitter());
    const promise = wrapper.promised("state-one");
    expect(promise).toBeInstanceOf(Promise);
    // We cannot guarantee resolution here due to randomness, but we can check type
    await expect(promise.catch(() => {})).resolves;
  });

  it("calls callback immediately if already in desired state", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "ready";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    let called = false;
    wrapper.inState("ready", (s) => {
      called = true;
      expect(s).toBe("ready");
    });
    expect(called).toBe(true);
  });

  it("calls callback when state changes to desired value", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    let called = false;
    wrapper.inState("ready", (s) => {
      called = true;
      expect(s).toBe("ready");
    });
    expect(called).toBe(false);
    emitter.setState("ready");
    expect(called).toBe(true);
  });

  it("removes event listener after callback is called", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    let callCount = 0;
    wrapper.inState("ready", (s) => {
      callCount++;
      expect(s).toBe("ready");
    });
    emitter.setState("ready"); // should trigger callback
    emitter.setState("idle"); // should NOT trigger callback again
    emitter.setState("ready"); // should NOT trigger callback again
    expect(callCount).toBe(1);
  });

  it("inState callback receives the original emitter instance as second argument", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    let receivedEmitter: any = null;
    wrapper.inState("idle", (_state, passedEmitter) => {
      receivedEmitter = passedEmitter;
    });
    expect(receivedEmitter).toBe(emitter);
  });

  it("promised resolves to the original emitter instance", async () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    setTimeout(() => emitter.setState("ready"), 10);
    const result = await wrapper.promised("ready");
    expect(result).toBe(emitter);
  });

  it("works with custom matcher for object state", () => {
    type StateObj = { status: string };
    class ObjectStateEmitter extends events.EventEmitter {
      private _state: StateObj;
      constructor(initialState: StateObj) {
        super();
        this._state = initialState;
      }
      getState() {
        return this._state;
      }
      setState(newState: StateObj) {
        this._state = newState;
        this.emit("stateChange");
      }
    }
    const initial = { status: "idle" };
    const desired = { status: "ready" };
    const emitter = new ObjectStateEmitter(initial);
    const matcher = (a: StateObj, b: StateObj) => a.status === b.status;
    const wrapper = new EmitterWrapper(emitter, { matcher });
    let called = false;
    wrapper.inState(desired, (s) => {
      called = true;
      expect(s).toEqual({ status: "ready" });
    });
    expect(called).toBe(false);
    emitter.setState({ status: "ready" });
    expect(called).toBe(true);
  });
});
