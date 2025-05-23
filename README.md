# emitter-wrapper

[![CI](https://github.com/vojtaTranta/emitter-wrapper/actions/workflows/main.yml/badge.svg?branch=main)](https://github.com/vojtaTranta/emitter-wrapper/actions/workflows/main.yml)

**A robust utility for handling event-driven state and callback chains with Node.js EventEmitters.**

- **TypeScript-first**: Full type safety and typings.
- **Dual module support**: Works with both CommonJS (`require`) and ESM (`import`).
- **Runtime state checks**: Wait for, chain, and react to emitter state transitions with ease.
- **Cleaner event code**: Avoid callback hell and complex event logic.

---

## ✨ Why use emitter-wrapper?

`emitter-wrapper` helps you:

- Chain callbacks and promises based on emitter state.
- React immediately if an emitter is already in a desired state.
- Clean up event listeners automatically after state transitions.
- Use custom matchers for complex state objects.

Great for orchestrating async workflows, stateful resources, and any advanced event-driven logic.

---

## 🚀 Installation

```bash
npm install emitter-wrapper
```

---

## 🛠️ Usage Example

```ts
import { EmitterWrapper } from "emitter-wrapper";
import { EventEmitter } from "events";

class MyEmitter extends EventEmitter {
  private state = "idle";
  getState() {
    return this.state;
  }
  setState(s: string) {
    this.state = s;
    this.emit("stateChange");
  }
}

const emitter = new MyEmitter();
const wrapper = new EmitterWrapper(emitter);

// Wait for the emitter to reach a state, then run a callback
wrapper.inState("ready", (state) => {
  console.log("Emitter is ready!", state);
});

// Or, use a promise-based approach
await wrapper.promised("ready");

// Change state somewhere else
emitter.setState("ready");
```

---

## ℹ️ Callback Arguments Example

The callback passed to `inState` receives both the new state and the original emitter instance (not the wrapper):

```ts
wrapper.inState("ready", (state, emitterInstance) => {
  console.log("State is now:", state);
  emitterInstance.setState("done"); // you can interact with the emitter here
});
```

---

## 🔗 Chaining Example

You can chain state transitions and promises for complex workflows:

```ts
wrapper
  .inState("loading", () => {
    console.log("Loading started");
  })
  .inState("ready", () => {
    console.log("Now ready!");
  })
  .promised("done")
  .then(() => {
    console.log("Process is done!");
  });

// ...
emitter.setState("loading");
emitter.setState("ready");
emitter.setState("done");
```

---

## 🧹 Cleanup and Destruction

EmitterWrapper provides methods to clean up event listeners to prevent memory leaks:

### Manual Destruction

```ts
// Remove all listeners from both the wrapper and original emitter
wrapper.destroy();
```

### Conditional Destruction

```ts
// Destroy the wrapper when a specific state is reached
wrapper.destroyInState("completed");
```

### Automatic Cleanup with Promises

The `promised` method automatically cleans up listeners after resolution:

```ts
// Listeners are automatically removed when the promise resolves
const result = await wrapper.promised("ready");
// No need to manually call destroy() here
```

This automatic cleanup helps prevent memory leaks in long-running applications.

---

## 📦 Module Support

- **ESM**: `import { EmitterWrapper } from 'emitter-wrapper'`
- **CommonJS**: `const { EmitterWrapper } = require('emitter-wrapper')`

---

## 📝 License

MIT
