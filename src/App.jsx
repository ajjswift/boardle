import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import gameEngine from "./game";

const NAVS = ["main", "skill-tree", "globe", "regions"];
const NODE_POSITIONS = {
    "ops-core": { x: 50, y: 10 },

    "vendor-negotiations": { x: 12, y: 24 },
    "bulk-procurement": { x: 12, y: 38 },
    "reserved-capacity": { x: 12, y: 52 },
    "hardware-lifecycle": { x: 12, y: 66 },
    "hyperscale-contracts": { x: 12, y: 80 },

    "bgp-routing": { x: 30, y: 24 },
    "peering-agreements": { x: 30, y: 38 },
    "cdn-layer": { x: 30, y: 52 },
    "subsea-expansion": { x: 30, y: 66 },
    "leo-uplink": { x: 30, y: 80 },

    "runbook-standardisation": { x: 50, y: 24 },
    "cicd-pipeline": { x: 50, y: 38 },
    iac: { x: 50, y: 52 },
    "kubernetes-orchestration": { x: 50, y: 66 },
    "autonomous-ops": { x: 50, y: 80 },

    "on-call-rota": { x: 70, y: 24 },
    "sla-framework": { x: 70, y: 38 },
    "chaos-engineering": { x: 70, y: 52 },
    "multi-az-redundancy": { x: 70, y: 66 },
    "five-nines": { x: 70, y: 80 },

    "sales-enablement": { x: 88, y: 24 },
    "enterprise-pipeline": { x: 88, y: 38 },
    "analyst-coverage": { x: 88, y: 52 },
    "pre-ipo-roadshow": { x: 88, y: 66 },
    "market-maker": { x: 88, y: 80 },
};

function latLngToVector3(lat, lng, radius = 5) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return {
        x: -radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.cos(phi),
        z: radius * Math.sin(phi) * Math.sin(theta),
    };
}

function formatPercent(value) {
    return `${(value * 100).toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}%`;
}

function generateEarthTexture(THREE) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 512;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = "#1a4a7a";
    ctx.fillRect(0, 0, 1024, 512);

    ctx.fillStyle = "#2d5a27";
    ctx.beginPath();
    ctx.ellipse(220, 160, 80, 90, -0.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(270, 330, 45, 80, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(500, 140, 40, 50, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(500, 270, 55, 90, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(680, 160, 130, 80, -0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(760, 340, 50, 35, 0.1, 0, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 3000; i += 1) {
        const x = Math.random() * 1024;
        const y = Math.random() * 512;
        ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.15})`;
        ctx.fillRect(x, y, 2, 2);
    }

    ctx.fillStyle = "rgba(220,235,255,0.6)";
    ctx.fillRect(0, 0, 1024, 30);
    ctx.fillRect(0, 482, 1024, 30);

    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;
    return texture;
}

function useGlobe(
    enabled,
    regions,
    datacentres,
    cables,
    satellites,
    onRegionPick,
) {
    const mountRef = useRef(null);
    const runtimeRef = useRef(null);
    const onRegionPickRef = useRef(onRegionPick);

    useEffect(() => {
        onRegionPickRef.current = onRegionPick;
    }, [onRegionPick]);

    useEffect(() => {
        if (!enabled) {
            return undefined;
        }
        const THREE = window.THREE;
        if (!THREE || !mountRef.current) {
            return undefined;
        }

        const mount = mountRef.current;
        const width = mount.clientWidth || 900;
        const height = mount.clientHeight || 560;
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x060b16);
        const camera = new THREE.PerspectiveCamera(
            45,
            width / height,
            0.1,
            1000,
        );
        camera.position.set(0, 0, 13);

        const renderer = new THREE.WebGLRenderer({
            antialias: true,
            alpha: true,
        });
        renderer.setSize(width, height);
        mount.innerHTML = "";
        mount.appendChild(renderer.domElement);

        const ambient = new THREE.AmbientLight(0x8899ff, 0.7);
        const point = new THREE.PointLight(0xffffff, 1.1);
        point.position.set(8, 8, 8);
        scene.add(ambient, point);

        const earthGroup = new THREE.Group();
        scene.add(earthGroup);
        const earthTexture = generateEarthTexture(THREE);
        const earth = new THREE.Mesh(
            new THREE.SphereGeometry(5, 64, 64),
            new THREE.MeshPhongMaterial({
                map: earthTexture || undefined,
                color: earthTexture ? 0xffffff : 0x15386f,
                specular: new THREE.Color(0x1a3a5c),
                shininess: 15,
            }),
        );
        earthGroup.add(earth);
        const atmosphere = new THREE.Mesh(
            new THREE.SphereGeometry(5.15, 64, 64),
            new THREE.MeshPhongMaterial({
                color: 0x4488ff,
                transparent: true,
                opacity: 0.08,
                side: THREE.FrontSide,
            }),
        );
        earthGroup.add(atmosphere);

        const overlay = document.createElement("div");
        overlay.className = "globe-label-layer";
        mount.appendChild(overlay);

        const markerMeshes = [];
        const markerRegistry = [];
        regions
            .filter((region) => datacentres[region.id]?.unlocked)
            .forEach((region) => {
                const posObj = latLngToVector3(region.lat, region.lng, 5.08);
                const pos = new THREE.Vector3(posObj.x, posObj.y, posObj.z);

                const cone = new THREE.Mesh(
                    new THREE.ConeGeometry(0.04, 0.2, 8),
                    new THREE.MeshBasicMaterial({ color: 0x00ff88 }),
                );
                cone.position.copy(pos);
                cone.lookAt(new THREE.Vector3(0, 0, 0));
                cone.rotateX(Math.PI / 2);
                cone.userData.regionId = region.id;
                earthGroup.add(cone);
                markerMeshes.push(cone);

                const ring = new THREE.Mesh(
                    new THREE.RingGeometry(0.06, 0.1, 16),
                    new THREE.MeshBasicMaterial({
                        color: 0x00ff88,
                        transparent: true,
                        opacity: 0.6,
                        side: THREE.DoubleSide,
                    }),
                );
                ring.position.copy(pos);
                ring.lookAt(new THREE.Vector3(0, 0, 0));
                ring.userData = {
                    isPulseRing: true,
                    phase: Math.random() * Math.PI * 2,
                };
                earthGroup.add(ring);

                const labelEl = document.createElement("div");
                labelEl.className = "globe-label";
                labelEl.textContent = region.name;
                overlay.appendChild(labelEl);

                markerRegistry.push({ region, cone, labelEl });
            });

        const cableLines = [];
        const movers = [];
        cables.forEach((cable, index) => {
            if (!cable.active) return;
            const route = gameEngine.CABLE_ROUTES[cable.route];
            if (!route) return;
            const from = regions.find((entry) => entry.id === route.from);
            const to = regions.find((entry) => entry.id === route.to);
            if (!from || !to) return;

            const start = latLngToVector3(from.lat, from.lng, 4.9);
            const end = latLngToVector3(to.lat, to.lng, 4.9);
            const s = new THREE.Vector3(start.x, start.y, start.z);
            const e = new THREE.Vector3(end.x, end.y, end.z);
            const mid = s
                .clone()
                .add(e)
                .multiplyScalar(0.5)
                .normalize()
                .multiplyScalar(4.6);
            const curve = new THREE.QuadraticBezierCurve3(s, mid, e);
            const points = curve.getPoints(60);
            const geo = new THREE.BufferGeometry().setFromPoints(points);
            const line = new THREE.Line(
                geo,
                new THREE.LineBasicMaterial({
                    color: 0x00aaff,
                    transparent: true,
                    opacity: 0.6,
                }),
            );
            earthGroup.add(line);
            cableLines.push(line);

            const mover = new THREE.Mesh(
                new THREE.SphereGeometry(0.04, 8, 8),
                new THREE.MeshBasicMaterial({ color: 0x88ddff }),
            );
            mover.userData.curve = curve;
            mover.userData.t = (index * 0.23) % 1;
            earthGroup.add(mover);
            movers.push(mover);
        });

        const satelliteMeshes = [];
        satellites.forEach((sat, idx) => {
            if (!sat.active) return;
            const mesh = new THREE.Mesh(
                new THREE.OctahedronGeometry(0.08),
                new THREE.MeshBasicMaterial({ color: 0xffffff }),
            );
            mesh.userData.angle = idx;
            mesh.userData.inclination = 20 + ((idx * 17) % 40);
            mesh.userData.speed = 0.008 + idx * 0.0012;
            earthGroup.add(mesh);
            satelliteMeshes.push(mesh);
        });

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        let isDragging = false;
        let movedDuringDrag = false;
        let previousMousePosition = { x: 0, y: 0 };
        let autoRotate = true;

        const onMouseDown = (event) => {
            isDragging = true;
            movedDuringDrag = false;
            autoRotate = false;
            previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const onMouseMove = (event) => {
            if (!isDragging) return;
            const delta = {
                x: event.clientX - previousMousePosition.x,
                y: event.clientY - previousMousePosition.y,
            };
            if (Math.abs(delta.x) + Math.abs(delta.y) > 0)
                movedDuringDrag = true;
            earthGroup.rotation.y += delta.x * 0.005;
            earthGroup.rotation.x += delta.y * 0.005;
            earthGroup.rotation.x = Math.max(
                -Math.PI / 2,
                Math.min(Math.PI / 2, earthGroup.rotation.x),
            );
            previousMousePosition = { x: event.clientX, y: event.clientY };
        };

        const onMouseUp = (event) => {
            if (!isDragging) return;
            isDragging = false;
            if (movedDuringDrag) return;
            const rect = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            raycaster.setFromCamera(pointer, camera);
            const hits = raycaster.intersectObjects(markerMeshes);
            if (hits.length) {
                const regionId = hits[0].object.userData.regionId;
                if (regionId) onRegionPickRef.current?.(regionId);
            }
        };
        const onWheel = (event) => {
            camera.position.z += event.deltaY * 0.004;
            camera.position.z = Math.max(6, Math.min(20, camera.position.z));
        };

        renderer.domElement.addEventListener("mousedown", onMouseDown);
        window.addEventListener("mousemove", onMouseMove);
        window.addEventListener("mouseup", onMouseUp);
        renderer.domElement.addEventListener("wheel", onWheel, {
            passive: true,
        });

        const projectPoint = new THREE.Vector3();
        const updateMarkerLabels = () => {
            const rect = renderer.domElement.getBoundingClientRect();
            markerRegistry.forEach(({ cone, labelEl }) => {
                projectPoint.copy(cone.position);
                earthGroup.localToWorld(projectPoint);
                projectPoint.project(camera);
                const x = (projectPoint.x * 0.5 + 0.5) * rect.width;
                const y = (-projectPoint.y * 0.5 + 0.5) * rect.height;
                labelEl.style.display = projectPoint.z > 1 ? "none" : "block";
                labelEl.style.left = `${x + 10}px`;
                labelEl.style.top = `${y - 8}px`;
            });
        };

        let rafId = 0;
        const renderLoop = () => {
            if (autoRotate) {
                earthGroup.rotation.y += 0.001;
            }

            earthGroup.children.forEach((child) => {
                if (!child.userData?.isPulseRing) return;
                child.userData.phase += 0.05;
                child.scale.setScalar(1 + Math.sin(child.userData.phase) * 0.4);
                child.material.opacity =
                    0.3 + Math.cos(child.userData.phase) * 0.3;
            });

            movers.forEach((mover) => {
                mover.userData.t = (mover.userData.t + 0.004) % 1;
                const pointAt = mover.userData.curve.getPoint(mover.userData.t);
                mover.position.copy(pointAt);
            });

            satelliteMeshes.forEach((mesh) => {
                mesh.userData.angle += mesh.userData.speed;
                const r = 5.8;
                const inc = (mesh.userData.inclination * Math.PI) / 180;
                mesh.position.set(
                    r * Math.cos(mesh.userData.angle),
                    r * Math.sin(mesh.userData.angle) * Math.sin(inc),
                    r * Math.sin(mesh.userData.angle) * Math.cos(inc),
                );
            });

            updateMarkerLabels();
            renderer.render(scene, camera);
            rafId = requestAnimationFrame(renderLoop);
        };
        renderLoop();

        runtimeRef.current = {
            renderer,
            scene,
            camera,
            cleanup: () => {
                cancelAnimationFrame(rafId);
                renderer.domElement.removeEventListener(
                    "mousedown",
                    onMouseDown,
                );
                window.removeEventListener("mousemove", onMouseMove);
                window.removeEventListener("mouseup", onMouseUp);
                renderer.domElement.removeEventListener("wheel", onWheel);
                markerRegistry.forEach(({ labelEl }) => labelEl.remove());
                overlay.remove();
                markerMeshes.forEach((marker) => earthGroup.remove(marker));
                cableLines.forEach((line) => earthGroup.remove(line));
                movers.forEach((mover) => earthGroup.remove(mover));
                satelliteMeshes.forEach((mesh) => earthGroup.remove(mesh));
                earthGroup.remove(earth);
                earthGroup.remove(atmosphere);
                scene.remove(earthGroup);
                if (earthTexture) earthTexture.dispose();
                renderer.dispose();
                if (mount.contains(renderer.domElement)) {
                    mount.removeChild(renderer.domElement);
                }
            },
        };

        return () => {
            runtimeRef.current?.cleanup();
            runtimeRef.current = null;
        };
    }, [enabled]);

    return mountRef;
}

export default function App() {
    const [state, setState] = useState(() => gameEngine.loadState());
    const [activeNav, setActiveNav] = useState("main");
    const [prestigeOverlay, setPrestigeOverlay] = useState({
        visible: false,
        showDecision: false,
        showSummary: false,
        summary: null,
    });
    const workerRef = useRef(null);
    const telemetryRef = useRef([gameEngine.getTelemetrySnapshot(state)]);
    const skillTooltipRef = useRef(null);
    const uiTooltipRef = useRef(null);
    const prestigeTimersRef = useRef([]);

    const syncFromWorker = useCallback((nextState) => {
        setState(nextState);
        telemetryRef.current = [
            ...telemetryRef.current.filter(
                (entry) => entry.t >= Date.now() - 70000,
            ),
            gameEngine.getTelemetrySnapshot(nextState),
        ];
    }, []);

    useEffect(() => {
        const worker = new Worker(new URL("./gameWorker.js", import.meta.url), {
            type: "module",
        });
        workerRef.current = worker;
        worker.onmessage = (event) => {
            if (event.data?.type === "snapshot" && event.data.state) {
                syncFromWorker(event.data.state);
            }
        };
        worker.postMessage({ type: "init", state, paused: false });
        return () => {
            worker.terminate();
            workerRef.current = null;
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        const timer = window.setInterval(() => {
            gameEngine.saveState(state);
        }, gameEngine.SAVE_INTERVAL);
        const onUnload = () => gameEngine.saveState(state);
        window.addEventListener("beforeunload", onUnload);
        return () => {
            window.clearInterval(timer);
            window.removeEventListener("beforeunload", onUnload);
        };
    }, [state]);

    const sendCommand = useCallback((command, payload = {}) => {
        if (!workerRef.current) return;
        workerRef.current.postMessage({ type: "command", command, payload });
    }, []);

    const patchState = useCallback((next) => {
        setState(next);
    }, []);

    const resetTelemetry = useCallback((nextState) => {
        telemetryRef.current = [gameEngine.getTelemetrySnapshot(nextState)];
    }, []);

    const withOptimistic = useCallback(
        (next, workerCommand, payload = {}) => {
            if (next === state) return;
            patchState(next);
            sendCommand(workerCommand, payload);
        },
        [state, patchState, sendCommand],
    );

    const clearSkillTooltip = useCallback(() => {
        if (skillTooltipRef.current) {
            skillTooltipRef.current.remove();
            skillTooltipRef.current = null;
        }
    }, []);

    const clearUiTooltip = useCallback(() => {
        if (uiTooltipRef.current) {
            uiTooltipRef.current.remove();
            uiTooltipRef.current = null;
        }
    }, []);

    useEffect(() => {
        return () => {
            clearSkillTooltip();
            clearUiTooltip();
            prestigeTimersRef.current.forEach((id) => window.clearTimeout(id));
            prestigeTimersRef.current = [];
        };
    }, [clearSkillTooltip, clearUiTooltip]);

    useEffect(() => {
        if (activeNav !== "skill-tree") {
            clearSkillTooltip();
        }
        clearUiTooltip();
    }, [activeNav, clearSkillTooltip, clearUiTooltip]);

    const showSkillTooltip = useCallback(
        (node, event) => {
            clearSkillTooltip();
            const target = event.currentTarget;
            if (!target) return;
            const tooltip = document.createElement("div");
            tooltip.className = "skill-tooltip";
            const status = node.unlocked
                ? "Purchased"
                : node.purchasable
                  ? "Available"
                  : "Locked";
            const requires = node.requires.length
                ? node.requires.join(", ")
                : "None";
            tooltip.innerHTML = `
      <div class="tt-name">${node.label}</div>
      <div class="tt-row"><span>Status</span><span>${status}</span></div>
      <div class="tt-row"><span>Effect</span><span>${node.effectText}</span></div>
      <div class="tt-row"><span>Requires</span><span>${requires}</span></div>
      ${node.prestigeRequired > 0 ? `<div class="tt-row"><span>Prestige</span><span>${node.prestigeRequired}+</span></div>` : ""}
      <div class="tt-divider"></div>
      <div class="tt-flavour">${node.flavour}</div>
      <div class="tt-cost">Cost ${node.tokenCost} tokens</div>
    `;
            document.body.appendChild(tooltip);
            const nodeRect = target.getBoundingClientRect();
            const tipRect = tooltip.getBoundingClientRect();
            let left = nodeRect.right + 12;
            let top = event.clientY - 20;
            if (left + tipRect.width > window.innerWidth - 8) {
                left = nodeRect.left - tipRect.width - 12;
            }
            if (top + tipRect.height > window.innerHeight - 8) {
                top = window.innerHeight - tipRect.height - 8;
            }
            if (top < 8) top = 8;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            skillTooltipRef.current = tooltip;
        },
        [clearSkillTooltip],
    );

    const spawnFloatingCU = useCallback((clientX, clientY, clickValue) => {
        const el = document.createElement("div");
        el.className = "float-cu";
        el.textContent = `+${gameEngine.formatNumber(clickValue)} CU`;
        el.style.left = `${clientX}px`;
        el.style.top = `${clientY}px`;
        document.body.appendChild(el);
        el.addEventListener("animationend", () => el.remove(), { once: true });
    }, []);

    const showUiTooltip = useCallback(
        (html, event, anchorEl) => {
            clearUiTooltip();
            const tooltip = document.createElement("div");
            tooltip.className = "ui-tooltip";
            tooltip.innerHTML = html;
            document.body.appendChild(tooltip);
            const anchorRect = (
                anchorEl || event.currentTarget
            ).getBoundingClientRect();
            const tipRect = tooltip.getBoundingClientRect();
            let left = anchorRect.right + 12;
            let top =
                (event?.clientY ?? anchorRect.top + anchorRect.height / 2) - 20;
            if (left + tipRect.width > window.innerWidth - 8) {
                left = anchorRect.left - tipRect.width - 12;
            }
            if (top + tipRect.height > window.innerHeight - 8) {
                top = window.innerHeight - tipRect.height - 8;
            }
            if (top < 8) top = 8;
            tooltip.style.left = `${left}px`;
            tooltip.style.top = `${top}px`;
            uiTooltipRef.current = tooltip;
        },
        [clearUiTooltip],
    );

    const buildGeneratorUnlockReason = useCallback(
        (generatorId) => {
            if (generatorId === "shared" || generatorId === "vps")
                return "Available from start.";
            if (generatorId === "dedicated") {
                return `Requires 25 clients (${gameEngine.formatNumber(state.clients)} / 25).`;
            }
            if (generatorId === "rack") {
                const rate = gameEngine.getTotalProductionRate(state);
                return `Requires 75 CU/s total production (${gameEngine.formatNumber(rate)} / 75).`;
            }
            if (generatorId === "pod") {
                const owned = gameEngine.getTotalOwnedAcrossRegions(
                    state,
                    "rack",
                );
                return `Requires 6 Server Racks (${owned} / 6).`;
            }
            if (generatorId === "region") {
                const owned = gameEngine.getTotalOwnedAcrossRegions(
                    state,
                    "pod",
                );
                return `Requires 4 Data Centre Pods (${owned} / 4).`;
            }
            if (generatorId === "cable") {
                const owned = gameEngine.getTotalOwnedAcrossRegions(
                    state,
                    "region",
                );
                return `Requires 2 Hyperscale Regions (${owned} / 2).`;
            }
            if (generatorId === "orbital") {
                return "Requires 350,000 lifetime CU.";
            }
            return "Progression threshold not met.";
        },
        [state],
    );

    const handleBuyGenerator = (id) => {
        const next = gameEngine.buyGenerator(state, id);
        withOptimistic(next, "buyGenerator", { id });
    };

    const handleSellGenerator = (id) => {
        const next = gameEngine.sellGenerator(state, id);
        withOptimistic(next, "sellGenerator", { id });
    };

    const handleBuyRack = () => {
        const next = gameEngine.buyRack(state);
        withOptimistic(next, "buyRack");
    };

    const handleProvision = (event) => {
        const result = gameEngine.provisionClick(state);
        if (result.state === state) return;
        patchState(result.state);
        sendCommand("provision");
        spawnFloatingCU(event.clientX, event.clientY, result.gain);
    };

    const handleSetBuyMode = (mode) => {
        const next = gameEngine.setBuyMode(state, mode);
        withOptimistic(next, "setBuyMode", { mode });
    };

    const handleBuyNode = (nodeId) => {
        const next = gameEngine.buySkillNode(state, nodeId);
        withOptimistic(next, "buySkillNode", { id: nodeId });
    };

    const handleResolveIncident = () => {
        const next = gameEngine.resolveIncident(state);
        withOptimistic(next, "resolveIncident");
    };

    const handleUnlockRegion = (regionId) => {
        const next = gameEngine.unlockRegion(state, regionId);
        withOptimistic(next, "unlockRegion", { id: regionId });
    };

    const handleSetRegion = (regionId) => {
        const next = gameEngine.setActiveDatacentre(state, regionId);
        withOptimistic(next, "setActiveDatacentre", { id: regionId });
    };

    const handlePrestige = () => {
        if (!gameEngine.maybeOpenPrestige(state)) return;
        const preState = state;
        const next = gameEngine.applyPrestige(state);
        const tokensAwarded = Math.max(
            0,
            (next.prestigeTokens || 0) - (preState.prestigeTokens || 0),
        );
        const summary = {
            lifetimeCU: preState.lifetimeCU || 0,
            peakRate: preState.peakRate || 0,
            clients: preState.clients || 0,
            tokensAwarded,
            prestigeCount: next.prestigeCount || 0,
        };

        prestigeTimersRef.current.forEach((id) => window.clearTimeout(id));
        prestigeTimersRef.current = [];
        setPrestigeOverlay({
            visible: true,
            showDecision: false,
            showSummary: false,
            summary,
        });
        const decisionTimer = window.setTimeout(() => {
            setPrestigeOverlay((current) => ({
                ...current,
                showDecision: true,
            }));
        }, 2000);
        const summaryTimer = window.setTimeout(() => {
            setPrestigeOverlay((current) => ({
                ...current,
                showSummary: true,
            }));
        }, 7000);
        prestigeTimersRef.current = [decisionTimer, summaryTimer];

        resetTelemetry(next);
        patchState(next);
        sendCommand("prestige");
    };

    const handleReset = () => {
        const ok = window.confirm("Reset all progress and save data?");
        if (!ok) return;
        localStorage.removeItem(gameEngine.STORAGE_KEY);
        const fresh = gameEngine.createInitialState();
        patchState(fresh);
        sendCommand("replaceState", { state: fresh });
    };

    const handleDownload = () => {
        const blob = new Blob(
            [JSON.stringify(gameEngine.prepareSaveState(state), null, 2)],
            { type: "application/json" },
        );
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = "datacentre-save.json";
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
        URL.revokeObjectURL(url);
    };

    const handleImport = async (file) => {
        try {
            const raw = await file.text();
            const parsed = JSON.parse(raw);
            localStorage.setItem(
                gameEngine.STORAGE_KEY,
                JSON.stringify(parsed),
            );
            const loaded = gameEngine.loadState();
            patchState(loaded);
            sendCommand("replaceState", { state: loaded });
        } catch (error) {
            console.warn(error);
            window.alert("Failed to import save file.");
        }
    };

    const telemetry = useMemo(
        () => gameEngine.getTelemetryDeltas(telemetryRef.current),
        [state.cu, state.lifetimeCU, state.clients],
    );
    const totalRate = gameEngine.getTotalProductionRate(state);
    const ipoRatio = state.lifetimeCU / Math.max(1, state.ipoTarget);
    const ipoPercent = Math.min(100, ipoRatio * 100);
    const incidentBanner = gameEngine.getIncidentBanner(state);
    const incidentResolveCost = gameEngine.getIncidentResolveCost(state);
    const canResolveIncident = state.cu >= incidentResolveCost;
    const regionsUi = gameEngine.getRegionUi(state);
    const activeDc = state.datacentres[state.activeDatacentreId];
    const usedSlots = gameEngine.getUsedSlotsForDatacentre(state);
    const totalSlots = gameEngine.getTotalSlotsForDatacentre(state);
    const nextRackCost = gameEngine.getRackCost(activeDc.racks);
    const canBuyRack = state.cu >= nextRackCost;
    const slotContents = useMemo(() => {
        if (!activeDc) return [];
        const slots = [];
        gameEngine.GENERATORS.forEach((generator) => {
            const ownedInRegion =
                activeDc.generators?.[generator.id]?.owned || 0;
            for (let i = 0; i < ownedInRegion; i += 1) {
                slots.push({
                    id: generator.id,
                    short: generator.short,
                    delays: Array.from(
                        { length: 8 },
                        () => `${Math.floor(Math.random() * 400)}ms`,
                    ),
                });
            }
        });
        return slots;
    }, [activeDc]);

    const rackRows = Array.from({ length: activeDc.racks }, (_, rackIndex) => {
        const start = rackIndex * state.slotsPerRack;
        const row = Array.from({ length: state.slotsPerRack }, (_, slot) => {
            const flat = start + slot;
            return slotContents[flat] || null;
        });
        return row;
    });

    const rackVisualBlocks = rackRows.map((rackSlots) => {
        const rows = [];
        for (let i = 0; i < rackSlots.length; i += 4) {
            rows.push(rackSlots.slice(i, i + 4));
        }
        return rows;
    });

    const regionRates = Object.keys(state.datacentres).map((id) => ({
        id,
        rate: gameEngine.getRegionProductionRate(state, id),
    }));
    const visibleNodes = gameEngine
        .getVisibleNodes(state)
        .map((node) => gameEngine.getNodeUi(state, node));
    const nodeMap = Object.fromEntries(
        visibleNodes.map((node) => [node.id, node]),
    );
    const links = visibleNodes
        .flatMap((node) =>
            node.requires.map((dep) => ({ from: dep, to: node.id })),
        )
        .filter((link) => nodeMap[link.from] && nodeMap[link.to]);

    const globeRef = useGlobe(
        activeNav === "globe",
        gameEngine.REGIONS,
        state.datacentres,
        state.cables,
        state.satellites,
        handleSetRegion,
    );
    const fileInputRef = useRef(null);

    const getGeneratorTooltipHtml = (generator) => {
        const owned = gameEngine.getGeneratorOwned(state, generator.id);
        const thresholdUnlocked = gameEngine.isGeneratorThresholdUnlocked(
            generator.id,
            state,
        );
        const spaceUnlocked = gameEngine.isGeneratorUnlocked(
            generator.id,
            state,
        );
        const availableSlots = Math.max(0, totalSlots - usedSlots);
        const mode = state.buyMode || "x1";
        const requestedQty =
            mode === "x1" ? 1 : mode === "x10" ? 10 : availableSlots;
        const slotLimitedQty = Math.min(requestedQty, availableSlots);

        let affordableQty = 0;
        let runningCost = 0;
        for (let i = 0; i < slotLimitedQty; i += 1) {
            const stepCost =
                generator.baseCost *
                Math.pow(1.15, owned + i) *
                (state.generatorCostMultiplier || 1);
            if (runningCost + stepCost > state.cu + 1e-9) break;
            runningCost += stepCost;
            affordableQty += 1;
        }
        const purchaseQty = Math.max(0, affordableQty);
        const singleRate =
            generator.baseRate *
            (activeDc.productionMultiplier || 1) *
            (state.globalProductionMultiplier || 1) *
            gameEngine.getSkillTreeMultiplier(state, generator.id) *
            gameEngine.getPrestigeMultiplier(state) *
            gameEngine.getPolicyMultiplier(state, generator.id);
        const currentRate = singleRate * owned;
        const netGain = singleRate * purchaseQty;
        const afterRate = currentRate + netGain;
        const payback = netGain > 0 ? Math.round(runningCost / netGain) : null;

        const status = !thresholdUnlocked
            ? buildGeneratorUnlockReason(generator.id)
            : !spaceUnlocked
              ? `Rack full (${usedSlots}/${totalSlots}). Buy another rack.`
              : "Available.";

        return `
      <div class="tt-name">${generator.name}</div>
      <div class="tt-divider"></div>
      <div class="tt-row"><span>Purchase</span><span>${purchaseQty} units</span></div>
      <div class="tt-row"><span>Current owned</span><span>${owned}</span></div>
      <div class="tt-row"><span>Current rate</span><span>${gameEngine.formatNumber(currentRate)} CU/s</span></div>
      <div class="tt-row"><span>Rate after buy</span><span>${gameEngine.formatNumber(afterRate)} CU/s</span></div>
      <div class="tt-row"><span>Net gain</span><span>${netGain > 0 ? `+${gameEngine.formatNumber(netGain)} CU/s` : "n/a"}</span></div>
      <div class="tt-row"><span>Total cost</span><span>${gameEngine.formatCU(runningCost)}</span></div>
      <div class="tt-divider"></div>
      <div class="tt-row"><span>Status</span><span>${status}</span></div>
      <div class="tt-row"><span>Payback</span><span>${payback !== null ? `${payback}s` : "n/a"}</span></div>
    `;
    };

    return (
        <div className="app">
            <header className="nav">
                <div className="brand">DataCentre Game</div>
                <div className="tabs">
                    {NAVS.map((tab) => (
                        <button
                            key={tab}
                            type="button"
                            className={`tab${activeNav === tab ? " active" : ""}`}
                            onClick={() => setActiveNav(tab)}
                        >
                            {tab === "skill-tree"
                                ? "Skill Tree"
                                : tab[0].toUpperCase() + tab.slice(1)}
                        </button>
                    ))}
                </div>
            </header>

            {incidentBanner ? (
                <div className="incident-banner">
                    <span>{incidentBanner}</span>
                    <button
                        type="button"
                        className="resolve-button"
                        disabled={!canResolveIncident}
                        title={
                            canResolveIncident
                                ? ""
                                : "Insufficient CU to resolve incident"
                        }
                        onClick={handleResolveIncident}
                    >
                        {`Resolve Incident (${gameEngine.formatCU(incidentResolveCost)})`}
                    </button>
                </div>
            ) : null}

            <div className="layout">
                <aside className="sidebar">
                    <div className="stat">
                        <div className="stat-corner">
                            Lifetime {gameEngine.formatCU(state.lifetimeCU)}
                        </div>
                        <span className="stat-label">
                            Compute Units
                            <button
                                type="button"
                                className="info-dot"
                                onMouseEnter={(event) =>
                                    showUiTooltip(
                                        "<div class='tt-name'>Compute Units</div><div class='tt-divider'></div><div class='tt-flavour'>Primary currency used for infrastructure, regions, and expansion.</div>",
                                        event,
                                    )
                                }
                                onMouseLeave={clearUiTooltip}
                            >
                                ?
                            </button>
                        </span>
                        <strong>{gameEngine.formatCU(state.cu)}</strong>
                    </div>
                    <div className="stat">
                        <span>Production</span>
                        <strong>{gameEngine.formatRate(totalRate)}</strong>
                    </div>
                    <div className="stat">
                        <span>Clients</span>
                        <strong>
                            {gameEngine.formatNumber(state.clients)}
                        </strong>
                    </div>
                    <div className="stat">
                        <span>Prestige</span>
                        <strong>{state.prestigeCount}</strong>
                    </div>
                    <div className="stat">
                        <span>Prestige Tokens</span>
                        <strong>
                            {gameEngine.formatNumber(state.prestigeTokens)}
                        </strong>
                    </div>
                    <div className="stat">
                        <span className="stat-label">
                            Rate Δ / min
                            <button
                                type="button"
                                className="info-dot"
                                onMouseEnter={(event) =>
                                    showUiTooltip(
                                        "<div class='tt-name'>Rate Delta</div><div class='tt-divider'></div><div class='tt-flavour'>Change in total CU/s compared to one minute ago. Positive values mean your production is accelerating.</div>",
                                        event,
                                    )
                                }
                                onMouseLeave={clearUiTooltip}
                            >
                                ?
                            </button>
                        </span>
                        <strong>
                            {gameEngine.formatNumber(telemetry.rateDeltaMinute)}{" "}
                            CU/s
                        </strong>
                    </div>
                    <div className="sidebar-actions">
                        <button
                            type="button"
                            className="ghost"
                            onClick={handleDownload}
                        >
                            Download Save
                        </button>
                        <button
                            type="button"
                            className="ghost"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            Import Save
                        </button>
                        <input
                            ref={fileInputRef}
                            className="hidden-input"
                            type="file"
                            accept="application/json,.json"
                            onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) handleImport(file);
                                event.target.value = "";
                            }}
                        />
                        <button
                            type="button"
                            className="danger"
                            onClick={handleReset}
                        >
                            Reset Save
                        </button>
                    </div>
                </aside>

                <main className="content">
                    {activeNav === "main" ? (
                        <section className="panel">
                            <div className="panel-head">
                                <h2>{activeDc?.name || "Region"} Datacentre</h2>
                                <div className="buy-modes">
                                    {["x1", "x10", "MAX"].map((mode) => (
                                        <button
                                            key={mode}
                                            type="button"
                                            className={`mode${(state.buyMode || "x1") === mode ? " active" : ""}`}
                                            onClick={() =>
                                                handleSetBuyMode(mode)
                                            }
                                        >
                                            {mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="capacity">
                                <div>
                                    Racks: {activeDc.racks} | Slots used:{" "}
                                    {usedSlots} / {totalSlots}
                                </div>
                                <button
                                    type="button"
                                    className="buy-rack"
                                    disabled={!canBuyRack}
                                    title={
                                        canBuyRack
                                            ? ""
                                            : "Insufficient CU for next rack"
                                    }
                                    onClick={handleBuyRack}
                                >
                                    Buy Rack (
                                    {gameEngine.formatCU(nextRackCost)})
                                </button>
                            </div>

                            <div className="rack-grid">
                                {rackVisualBlocks.map((rack, index) => (
                                    <div key={index} className="rack-block">
                                        {rack.map((row, rowIndex) => (
                                            <div
                                                key={rowIndex}
                                                className="rack-row"
                                            >
                                                {row.map((slot, slotIndex) => (
                                                    <div
                                                        key={slotIndex}
                                                        className={`rack-unit${slot ? " filled" : ""}${slot && state.activeIncident ? " incident" : ""}`}
                                                    >
                                                        <div className="rack-led"></div>
                                                        {slot ? (
                                                            <>
                                                                <div className="rack-activity">
                                                                    {slot.delays.map(
                                                                        (
                                                                            delay,
                                                                            driveIndex,
                                                                        ) => (
                                                                            <span
                                                                                key={
                                                                                    driveIndex
                                                                                }
                                                                                className="rack-drive"
                                                                                style={{
                                                                                    "--delay":
                                                                                        delay,
                                                                                }}
                                                                            ></span>
                                                                        ),
                                                                    )}
                                                                </div>
                                                                <div className="rack-label">
                                                                    {slot.short}
                                                                </div>
                                                            </>
                                                        ) : null}
                                                    </div>
                                                ))}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>

                            <div className="generators">
                                {gameEngine.GENERATORS.map((generator) => {
                                    const owned = gameEngine.getGeneratorOwned(
                                        state,
                                        generator.id,
                                    );
                                    const thresholdUnlocked =
                                        gameEngine.isGeneratorThresholdUnlocked(
                                            generator.id,
                                            state,
                                        );
                                    const spaceUnlocked =
                                        gameEngine.isGeneratorUnlocked(
                                            generator.id,
                                            state,
                                        );
                                    const cost = gameEngine.getGeneratorCost(
                                        state,
                                        generator.id,
                                    );
                                    const buyQtyPreview =
                                        gameEngine.getGeneratorBuyQuantity(
                                            state,
                                            generator.id,
                                        );
                                    const sellRefund =
                                        gameEngine.getGeneratorSellRefund(
                                            state,
                                            generator.id,
                                        );
                                    const mode = state.buyMode || "x1";
                                    const canAfford = state.cu >= cost;
                                    const canBuy =
                                        thresholdUnlocked &&
                                        buyQtyPreview > 0;
                                    const canSell = owned > 0;
                                    let buttonLabel = "Buy";
                                    let disabledReason = "";
                                    let lockReasonShort = "";
                                    if (!thresholdUnlocked) {
                                        buttonLabel = "Locked";
                                        lockReasonShort =
                                            buildGeneratorUnlockReason(
                                                generator.id,
                                            );
                                        disabledReason = lockReasonShort;
                                    } else if (!spaceUnlocked) {
                                        buttonLabel = "Rack Full";
                                        lockReasonShort = `Rack full (${usedSlots}/${totalSlots}). Buy another rack.`;
                                        disabledReason = lockReasonShort;
                                    } else if (
                                        mode === "x10" &&
                                        buyQtyPreview === 0 &&
                                        totalSlots - usedSlots >= 10
                                    ) {
                                        buttonLabel = "Insufficient SU";
                                        disabledReason =
                                            "Insufficient CU to buy 10 units in x10 mode.";
                                    } else if (
                                        mode === "x10" &&
                                        buyQtyPreview === 0 &&
                                        totalSlots - usedSlots < 10
                                    ) {
                                        buttonLabel = "Need 10 Slots";
                                        disabledReason =
                                            "x10 mode requires 10 free slots.";
                                    } else if (!canAfford) {
                                        buttonLabel = "Insufficient CU";
                                        disabledReason =
                                            "Insufficient CU for the next unit.";
                                    }
                                    const regionRate =
                                        generator.baseRate *
                                        owned *
                                        (activeDc.productionMultiplier || 1) *
                                        (state.globalProductionMultiplier ||
                                            1) *
                                        gameEngine.getSkillTreeMultiplier(
                                            state,
                                            generator.id,
                                        ) *
                                        gameEngine.getPrestigeMultiplier(
                                            state,
                                        ) *
                                        gameEngine.getPolicyMultiplier(
                                            state,
                                            generator.id,
                                        );
                                    return (
                                        <div
                                            key={generator.id}
                                            className="generator-card"
                                            onMouseEnter={(event) =>
                                                showUiTooltip(
                                                    getGeneratorTooltipHtml(
                                                        generator,
                                                    ),
                                                    event,
                                                )
                                            }
                                            onMouseLeave={clearUiTooltip}
                                        >
                                            <div className="row-a">
                                                <div>
                                                    {generator.icon}{" "}
                                                    {generator.name}
                                                </div>
                                                <div>{owned}</div>
                                            </div>
                                            <div className="row-b">
                                                {gameEngine.formatRate(
                                                    regionRate,
                                                )}{" "}
                                                · Cost{" "}
                                                {gameEngine.formatCU(cost)}
                                            </div>
                                            {lockReasonShort ? (
                                                <div className="lock-hint">
                                                    {lockReasonShort}
                                                </div>
                                            ) : null}
                                            <div className="generator-actions">
                                                <button
                                                    type="button"
                                                    title={disabledReason}
                                                    disabled={!canBuy}
                                                    onClick={() =>
                                                        handleBuyGenerator(
                                                            generator.id,
                                                        )
                                                    }
                                                >
                                                    {canBuy
                                                        ? `Buy ${buyQtyPreview}`
                                                        : buttonLabel}
                                                </button>
                                                <button
                                                    type="button"
                                                    className="sell-button"
                                                    title={
                                                        canSell
                                                            ? `Refund ${gameEngine.formatCU(sellRefund)}`
                                                            : "No units owned"
                                                    }
                                                    disabled={!canSell}
                                                    onClick={() =>
                                                        handleSellGenerator(
                                                            generator.id,
                                                        )
                                                    }
                                                >
                                                    Sell
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="ipo-progress">
                                <div>
                                    IPO progress:{" "}
                                    {gameEngine.formatCU(state.lifetimeCU)} /{" "}
                                    {gameEngine.formatCU(state.ipoTarget)} (
                                    {formatPercent(ipoRatio)})
                                </div>
                                <div className="bar">
                                    <span
                                        style={{ width: `${ipoPercent}%` }}
                                    ></span>
                                </div>
                            </div>

                            <div className="action-row">
                                <button
                                    type="button"
                                    unselectable="on"
                                    onselectstart="return false;"
                                    className="provision"
                                    onClick={handleProvision}
                                >
                                    Click to Provision
                                </button>
                                <button
                                    type="button"
                                    className="ipo"
                                    disabled={
                                        !gameEngine.maybeOpenPrestige(state)
                                    }
                                    onClick={handlePrestige}
                                >
                                    {gameEngine.maybeOpenPrestige(state)
                                        ? "Proceed to IPO"
                                        : "IPO Locked"}
                                </button>
                            </div>
                        </section>
                    ) : null}

                    {activeNav === "skill-tree" ? (
                        <section className="panel skill-tree">
                            <div className="panel-head">
                                <h2>Skill Tree</h2>
                                <div className="panel-head-meta">
                                    Prestige Tokens:{" "}
                                    {gameEngine.formatNumber(
                                        state.prestigeTokens,
                                    )}
                                </div>
                            </div>
                            <svg viewBox="0 0 100 92" className="tree-svg">
                                {links.map((link, index) => {
                                    const from = NODE_POSITIONS[link.from];
                                    const to = NODE_POSITIONS[link.to];
                                    if (!from || !to) return null;
                                    const active =
                                        state.unlockedNodes.includes(
                                            link.from,
                                        ) &&
                                        state.unlockedNodes.includes(link.to);
                                    return (
                                        <line
                                            key={index}
                                            x1={from.x}
                                            y1={from.y}
                                            x2={to.x}
                                            y2={to.y}
                                            className={
                                                active ? "link active" : "link"
                                            }
                                        />
                                    );
                                })}
                                {visibleNodes.map((node) => {
                                    const pos = NODE_POSITIONS[node.id];
                                    if (!pos) return null;
                                    const unlocked = node.unlocked;
                                    const purchasable = node.purchasable;
                                    const terminal = node.tier === 5;
                                    return (
                                        <g
                                            key={node.id}
                                            transform={`translate(${pos.x}, ${pos.y})`}
                                            className={`node${unlocked ? " unlocked" : ""}${purchasable ? " purchasable" : ""}${terminal ? " terminal" : ""}`}
                                            onMouseEnter={(event) =>
                                                showSkillTooltip(node, event)
                                            }
                                            onMouseLeave={clearSkillTooltip}
                                            onClick={() =>
                                                handleBuyNode(node.id)
                                            }
                                        >
                                            <circle r="2.8"></circle>
                                            <text y="0.3" textAnchor="middle">
                                                {node.icon}
                                            </text>
                                        </g>
                                    );
                                })}
                            </svg>
                        </section>
                    ) : null}

                    {activeNav === "regions" ? (
                        <section className="panel">
                            <div className="panel-head">
                                <h2>Regions</h2>
                                <div className="panel-head-meta">Active: {activeDc.name}</div>
                            </div>
                            <div className="regions-grid">
                                {regionsUi.map((region) => (
                                    <div
                                        key={region.id}
                                        className={`region-card${region.active ? " active" : ""}`}
                                    >
                                        <div className="row-a">
                                            <strong>{region.name}</strong>
                                            <span>
                                                {region.unlocked ? "Unlocked" : "Locked"}
                                            </span>
                                        </div>
                                        <div className="row-b">
                                            Power {region.powerCost} · Cooling{" "}
                                            {region.coolingBonus}
                                            <button
                                                type="button"
                                                className="info-dot inline"
                                                onMouseEnter={(event) => {
                                                    const effective =
                                                        region.coolingBonus /
                                                        region.powerCost;
                                                    showUiTooltip(
                                                        `<div class='tt-name'>Regional Efficiency</div>
                             <div class='tt-divider'></div>
                             <div class='tt-row'><span>Power</span><span>${region.powerCost}</span></div>
                             <div class='tt-row'><span>Cooling</span><span>${region.coolingBonus}</span></div>
                             <div class='tt-row'><span>Net multiplier</span><span>${effective.toFixed(2)}x</span></div>
                             <div class='tt-divider'></div>
                             <div class='tt-flavour'>Higher cooling and lower power cost are better. Effective output in this region is Cooling / Power.</div>`,
                                                        event,
                                                    );
                                                }}
                                                onMouseLeave={clearUiTooltip}
                                            >
                                                ?
                                            </button>
                                        </div>
                                        <div className="row-b">
                                            Effective{" "}
                                            {`${(region.coolingBonus / region.powerCost).toFixed(2)}x`}
                                        </div>
                                        <div className="row-b">
                                            Rate{" "}
                                            {gameEngine.formatRate(
                                                region.production,
                                            )}
                                        </div>
                                        <div className="row-b">
                                            Racks {region.racks}
                                        </div>
                                        {!region.unlocked ? (
                                            <button
                                                type="button"
                                                disabled={
                                                    state.prestigeCount < region.unlockPrestige ||
                                                    state.cu < region.unlockCost
                                                }
                                                onClick={() =>
                                                    handleUnlockRegion(
                                                        region.id,
                                                    )
                                                }
                                            >
                                                {state.prestigeCount < region.unlockPrestige
                                                    ? `Requires Prestige ${region.unlockPrestige}`
                                                    : `Unlock (${gameEngine.formatCU(region.unlockCost)})`}
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                disabled={region.active}
                                                onClick={() =>
                                                    handleSetRegion(region.id)
                                                }
                                            >
                                                {region.active
                                                    ? "Active"
                                                    : "Switch"}
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </section>
                    ) : null}

                    {activeNav === "globe" ? (
                        <section className="panel globe-panel">
                            <div className="panel-head">
                                <h2>Global Infrastructure Globe</h2>
                                <div className="panel-head-meta">
                                    Drag to rotate · Scroll to zoom · Click
                                    markers to switch region
                                </div>
                            </div>
                            <div className="globe-canvas" ref={globeRef}></div>
                            <div className="globe-legend">
                                ● Active Datacenter | — Submarine Cable | ○
                                Satellite
                            </div>
                            <div className="globe-list">
                                {regionRates.map((entry) => (
                                    <span key={entry.id}>
                                        {entry.id}:{" "}
                                        {gameEngine.formatRate(entry.rate)}
                                    </span>
                                ))}
                            </div>
                        </section>
                    ) : null}
                </main>
            </div>

            {prestigeOverlay.visible ? (
                <div className="prestige-overlay">
                    <div className="prestige-overlay-panel">
                        <div className="prestige-company">NimbusCore™</div>
                        {prestigeOverlay.showDecision ? (
                            <div className="prestige-decision">
                                The board has made a decision.
                            </div>
                        ) : null}
                        {prestigeOverlay.showSummary &&
                        prestigeOverlay.summary ? (
                            <div className="prestige-summary">
                                <div className="prestige-summary-row">
                                    <span>Playthrough Lifetime CU</span>
                                    <strong>
                                        {gameEngine.formatCU(
                                            prestigeOverlay.summary.lifetimeCU,
                                        )}
                                    </strong>
                                </div>
                                <div className="prestige-summary-row">
                                    <span>Peak CU/s</span>
                                    <strong>
                                        {gameEngine.formatNumber(
                                            prestigeOverlay.summary.peakRate,
                                        )}{" "}
                                        CU/s
                                    </strong>
                                </div>
                                <div className="prestige-summary-row">
                                    <span>Clients Served</span>
                                    <strong>
                                        {gameEngine.formatNumber(
                                            prestigeOverlay.summary.clients,
                                        )}
                                    </strong>
                                </div>
                                <div className="prestige-summary-row">
                                    <span>Prestige Tokens Awarded</span>
                                    <strong>
                                        {gameEngine.formatNumber(
                                            prestigeOverlay.summary
                                                .tokensAwarded,
                                        )}
                                    </strong>
                                </div>
                                <div className="prestige-summary-row">
                                    <span>New Prestige Count</span>
                                    <strong>
                                        {prestigeOverlay.summary.prestigeCount}
                                    </strong>
                                </div>
                                <button
                                    type="button"
                                    className="prestige-close"
                                    onClick={() =>
                                        setPrestigeOverlay({
                                            visible: false,
                                            showDecision: false,
                                            showSummary: false,
                                            summary: null,
                                        })
                                    }
                                >
                                    Return to Operations
                                </button>
                            </div>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
