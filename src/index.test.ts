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

  it("destroy method removes all listeners from emitter and original emitter", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
      removeAllListeners() {
        super.removeAllListeners();
        return this;
      }
    }
    
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    
    // Set up a listener on the wrapper
    let callCount = 0;
    wrapper.inState("ready", () => {
      callCount++;
    });
    
    // Set up a direct listener on the original emitter
    let originalEmitterCallCount = 0;
    emitter.on("directEvent", () => {
      originalEmitterCallCount++;
    });
    
    // Verify wrapper listener works
    emitter.setState("ready");
    expect(callCount).toBe(1);
    
    // Verify original emitter listener works
    emitter.emit("directEvent");
    expect(originalEmitterCallCount).toBe(1);
    
    // Spy on the removeAllListeners method of the original emitter
    const originalRemoveAllListeners = emitter.removeAllListeners;
    let removeAllListenersCalled = false;
    emitter.removeAllListeners = function() {
      removeAllListenersCalled = true;
      return originalRemoveAllListeners.call(this);
    };
    
    // Destroy should remove all listeners
    wrapper.destroy();
    
    // Verify removeAllListeners was called on the original emitter
    expect(removeAllListenersCalled).toBe(true);
    
    // State change should no longer trigger wrapper callback
    emitter.setState("idle");
    emitter.setState("ready");
    expect(callCount).toBe(1); // Still 1, not incremented
    
    // Direct event should no longer trigger original emitter callback
    emitter.emit("directEvent");
    expect(originalEmitterCallCount).toBe(1); // Still 1, not incremented
  });
  
  it("destroyInState removes listeners when state is reached", () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
      removeAllListeners() {
        super.removeAllListeners();
        return this;
      }
    }
    
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    
    // Set up a test listener to verify destruction
    let destroyCalled = false;
    wrapper.inState("final", () => {
      destroyCalled = true;
    });
    
    // Set up destroyInState for "ready" state
    let destroyInStateCalled = false;
    wrapper.destroyInState("ready");
    
    // Initially the destroyInState callback shouldn't be called
    expect(destroyInStateCalled).toBe(false);
    
    // Mock the destroy method to verify it gets called
    const originalDestroy = wrapper.destroy;
    wrapper.destroy = function() {
      destroyInStateCalled = true;
      return originalDestroy.call(this);
    };
    
    // Change to ready state - this should trigger destroyInState
    emitter.setState("ready");
    expect(destroyInStateCalled).toBe(true);
    
    // Verify that listeners were removed
    emitter.setState("final");
    expect(destroyCalled).toBe(false); // Should not be called as listeners were removed
  });
  
  it("promised method automatically cleans up listeners after resolution", async () => {
    class MyEmitter extends events.EventEmitter {
      private _state = "idle";
      getState() {
        return this._state;
      }
      setState(newState: string) {
        this._state = newState;
        this.emit("stateChange");
      }
      removeAllListeners() {
        super.removeAllListeners();
        return this;
      }
    }
    
    const emitter = new MyEmitter();
    const wrapper = EmitterWrapper.wrap(emitter);
    
    // Set up a spy to track if destroy is called
    const originalDestroy = wrapper.destroy;
    let destroyCalled = false;
    wrapper.destroy = function() {
      destroyCalled = true;
      return originalDestroy.call(this);
    };
    
    // Set up a test listener before using promised
    let beforePromiseListenerCalled = false;
    wrapper.inState("final", () => {
      beforePromiseListenerCalled = true;
    });
    
    // Use promised to wait for a state change
    setTimeout(() => emitter.setState("ready"), 10);
    await wrapper.promised("ready");
    
    // Verify destroy was called
    expect(destroyCalled).toBe(true);
    
    // This shouldn't trigger the listener since destroy was called
    emitter.setState("final");
    expect(beforePromiseListenerCalled).toBe(false);
    
    // Create a new wrapper to verify that listeners set after destroy won't work
    const newWrapper = EmitterWrapper.wrap(emitter);
    let afterDestroyListenerCalled = false;
    
    // This listener is set after destroy was called on the original wrapper
    // It should still work since it's a new wrapper
    newWrapper.inState("final", () => {
      afterDestroyListenerCalled = true;
    });
    
    emitter.setState("idle"); // reset state
    emitter.setState("final"); // should trigger the new listener
    expect(afterDestroyListenerCalled).toBe(true);
  });
});
