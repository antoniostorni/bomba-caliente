class EventBus {
  constructor() {
    this.listeners = {};
  }

  on(event, cb) {
    (this.listeners[event] ||= []).push(cb);
  }

  off(event, cb) {
    this.listeners[event] = (this.listeners[event] || []).filter((f) => f !== cb);
  }

  emit(event, data) {
    for (const cb of this.listeners[event] || []) {
      try { cb(data); } catch (err) { console.error(`EventBus error in ${event}:`, err); }
    }
  }
}

export const eventBus = new EventBus();
