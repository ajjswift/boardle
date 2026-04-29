import gameEngine from "./game";

const UI_SYNC_INTERVAL_MS = 200;

let state = null;
let paused = false;
let loopId = null;
let lastTickAt = Date.now();
let lastSnapshotAt = 0;
let lastIncidentId = null;

function postSnapshot(force = false) {
  if (!state) {
    return;
  }
  const now = Date.now();
  const incidentId = state.activeIncident ? state.activeIncident.id : null;
  const incidentChanged = incidentId !== lastIncidentId;
  if (force || incidentChanged || now - lastSnapshotAt >= UI_SYNC_INTERVAL_MS) {
    lastSnapshotAt = now;
    lastIncidentId = incidentId;
    postMessage({ type: "snapshot", state });
  }
}

function tick() {
  if (!state || paused) {
    return;
  }
  const now = Date.now();
  const delta = Math.min(0.5, (now - lastTickAt) / 1000);
  lastTickAt = now;
  state = gameEngine.tickState(state, delta, now);
  postSnapshot(false);
}

function startLoop() {
  if (loopId) {
    return;
  }
  lastTickAt = Date.now();
  loopId = setInterval(tick, gameEngine.TICK_INTERVAL);
}

function applyCommand(command, payload) {
  if (!state) {
    return { changed: false };
  }
  if (command === "replaceState") {
    state = payload.state;
    return { changed: true };
  }
  if (command === "setBuyMode") {
    state = { ...state, buyMode: payload.mode };
    return { changed: true };
  }
  if (command === "buyGenerator") {
    const next = gameEngine.buyGenerator(state, payload.id);
    if (next !== state) {
      state = next;
      return { changed: true };
    }
    return { changed: false };
  }
  if (command === "buyUpgrade") {
    const next = gameEngine.buyUpgrade(state, payload.id);
    if (next !== state) {
      state = next;
      return { changed: true };
    }
    return { changed: false };
  }
  if (command === "buyPolicy") {
    const next = gameEngine.buyPolicy(state, payload.id);
    if (next !== state) {
      state = next;
      return { changed: true };
    }
    return { changed: false };
  }
  if (command === "resolveIncident") {
    const next = gameEngine.resolveIncident(state);
    if (next !== state) {
      state = next;
      return { changed: true };
    }
    return { changed: false };
  }
  if (command === "provision") {
    const result = gameEngine.provisionClick(state);
    state = result.state;
    return { changed: true };
  }
  return { changed: false };
}

onmessage = (event) => {
  const message = event.data || {};

  if (message.type === "init") {
    state = message.state || null;
    paused = !!message.paused;
    startLoop();
    postSnapshot(true);
    return;
  }

  if (message.type === "setPaused") {
    paused = !!message.paused;
    lastTickAt = Date.now();
    postSnapshot(true);
    return;
  }

  if (message.type === "command") {
    const result = applyCommand(message.command, message.payload || {});
    if (result.changed) {
      postSnapshot(true);
    }
  }
};
