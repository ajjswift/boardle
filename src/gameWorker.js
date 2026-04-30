import gameEngine from "./game";

const SNAPSHOT_INTERVAL_MS = 150;

let state = null;
let paused = false;
let loopId = null;
let lastTickAt = Date.now();
let lastSnapshotAt = 0;

function postSnapshot(force = false) {
  if (!state) return;
  const now = Date.now();
  if (force || now - lastSnapshotAt >= SNAPSHOT_INTERVAL_MS) {
    lastSnapshotAt = now;
    postMessage({ type: "snapshot", state });
  }
}

function tick() {
  if (!state || paused) return;
  const now = Date.now();
  const delta = Math.min(0.5, (now - lastTickAt) / 1000);
  lastTickAt = now;
  state = gameEngine.tickState(state, delta, now);
  postSnapshot(false);
}

function startLoop() {
  if (loopId) return;
  lastTickAt = Date.now();
  loopId = setInterval(tick, gameEngine.TICK_INTERVAL);
}

function applyCommand(command, payload) {
  if (!state) return false;
  if (command === "replaceState") {
    state = payload.state;
    return true;
  }
  if (command === "setPaused") {
    paused = !!payload.paused;
    lastTickAt = Date.now();
    return true;
  }
  if (command === "setBuyMode") {
    state = gameEngine.setBuyMode(state, payload.mode);
    return true;
  }
  if (command === "buyGenerator") {
    const next = gameEngine.buyGenerator(state, payload.id);
    const changed = next !== state;
    if (changed) state = next;
    return changed;
  }
  if (command === "buyRack") {
    const next = gameEngine.buyRack(state);
    const changed = next !== state;
    if (changed) state = next;
    return changed;
  }
  if (command === "sellGenerator") {
    const next = gameEngine.sellGenerator(state, payload.id);
    const changed = next !== state;
    if (changed) state = next;
    return changed;
  }
  if (command === "buySkillNode") {
    const next = gameEngine.buySkillNode(state, payload.id);
    if (next !== state) state = next;
    return true;
  }
  if (command === "unlockRegion") {
    const next = gameEngine.unlockRegion(state, payload.id);
    if (next !== state) state = next;
    return true;
  }
  if (command === "setActiveDatacentre") {
    const next = gameEngine.setActiveDatacentre(state, payload.id);
    if (next !== state) state = next;
    return true;
  }
  if (command === "provision") {
    const result = gameEngine.provisionClick(state);
    state = result.state;
    return true;
  }
  if (command === "resolveIncident") {
    const next = gameEngine.resolveIncident(state);
    if (next !== state) state = next;
    return true;
  }
  if (command === "prestige") {
    state = gameEngine.applyPrestige(state);
    return true;
  }
  return false;
}

onmessage = (event) => {
  const message = event.data || {};
  if (message.type === "init") {
    state = message.state;
    paused = !!message.paused;
    startLoop();
    postSnapshot(true);
    return;
  }
  if (message.type === "command") {
    const changed = applyCommand(message.command, message.payload || {});
    if (changed) postSnapshot(true);
  }
};
