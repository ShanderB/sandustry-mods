// Resource Signal Readers
//
// Adds three fixed 1x1 Logic-tab blocks: Gold Reader, Energy Reader,
// Fluxite Reader. Each one has no physical behavior of its own - it never
// touches cells or recipes - it just continuously reports true/false onto
// the signal-wire network based on a per-instance threshold. Click a
// placed block (with no other tool mid-action) to open a small panel and
// set that block's own threshold - each placed reader remembers its own
// value independently, in structure.data.threshold. Options -> Mods still
// has a threshold field per resource, used only as the starting value for
// newly placed blocks that haven't been configured yet.
//
// The game's public Sandkit API only exposes registering a structure as a
// signal RECEIVER (sandkit.api.signals.targets.register - used by lamps,
// doors, gates). There is no public way to register a structure as a
// signal SOURCE, even though the engine has a complete internal mechanism
// for it (session.mods.signals.senderTypes / senderOutputGetters, used by
// the game's own signalSensor, signalPresenceSensor, etc). patches.json
// adds one small, purely additive patch to bundle.js that exposes that
// same internal mechanism as sandkit.api.signals.registerSenderType,
// mirroring the exact code the vanilla senders use - it does not modify
// any existing behavior, only adds a new method next to the existing one.
//
// registerSenderType alone is not enough to make a lamp track a *live*
// value: the wire network only calls that getter once, at the moment a
// link is drawn with the Signal Linker, to seed the link's cached `.on`
// flag - after that the per-frame propagation tick only ever reads that
// cached flag back. Traced signalPresenceSensor's own code for how vanilla
// sensors stay live: on every relevant change they call
// `sandkit.api.signals.setAll(senderPos, boolean)`, a method the game
// assigns onto its signals object at runtime, once its own signals system
// finishes initializing - not in the officially documented API, and (this
// took two tries to learn) not reliably reachable through sandkit.api
// either: that object looks like a one-time snapshot/wrapper built when
// this mod's script starts running, taken *before* the game's later
// signals init adds setAll to the real, underlying object, so the copy
// this mod can see never gains that method, in any frame, ever. What *is*
// reliably live every frame is session.mods.signals itself, reached
// through sandkit.state (the same read/write window the community's
// "Power Monitor" mod uses for live resource totals) - the actual object
// the game's own propagation tick reads from, not a wrapper. setAll's own
// source is only a few lines (set every outgoing link's `.on`, mark each
// receiver dirty), so this reimplements exactly that against
// session.mods.signals.links / .dirtyReceivers directly, unconditionally
// every frame, driven by "frame:update" - the same event the signal
// network's own propagation tick listens to.
//
// The click-to-configure panel hooks the public "action:intercept" hook
// (not the internal, runtime-only interactableHandlers system vanilla
// clickable structures use, for the same "might not exist yet" reason as
// setAll above) and renders a small React panel via api.ui.inject, the
// same injection point the community's "Power Monitor" mod uses for its
// HUD.
const api = sandkit.api;
const React = sandkit.react;
const h = React.createElement;

function safe(fn, fallback = null) {
	try {
		return fn();
	} catch (e) {
		return fallback;
	}
}

const READERS = [
	{ id: "goldReader", name: "Gold Reader", resourceKey: "gold", settingKey: "goldThreshold", defaultThreshold: 1000 },
	{ id: "energyReader", name: "Energy Reader", resourceKey: "energy", settingKey: "energyThreshold", defaultThreshold: 1000 },
	{ id: "fluxiteReader", name: "Fluxite Reader", resourceKey: "fluxite", settingKey: "fluxiteThreshold", defaultThreshold: 100 },
];

// structure is optional: with one, a per-instance threshold (set via the
// click panel) wins if present; without one (nothing placed yet, or the
// definition's own default data), this falls back to the per-mod setting.
function getThreshold(reader, structure) {
	const perInstance = structure && structure.data ? structure.data.threshold : undefined;
	if (typeof perInstance === "number" && Number.isFinite(perInstance)) return perInstance;
	const fromSettings = safe(() => api.settings.get(reader.settingKey));
	return typeof fromSettings === "number" && Number.isFinite(fromSettings) ? fromSettings : reader.defaultThreshold;
}

function getCurrentValue(reader) {
	return safe(() => sandkit.state.store.resources[reader.resourceKey]) || 0;
}

function computeReaderOutput(reader, structure) {
	return getCurrentValue(reader) >= getThreshold(reader, structure);
}

function summaryText(reader, structure) {
	const limit = getThreshold(reader, structure);
	return `Outputs true when stored ${reader.resourceKey} is >= ${limit} (currently ${getCurrentValue(reader)}). Click to change the threshold.`;
}

// Hover tooltip: shows the configured threshold and the current amount,
// read from structure.data.summary the same way the community's "Atomic
// Age" mod reports its machines' status (a translated template with one
// placeholder, filled in with a plain sentence computed by the mod).
function refreshTooltips() {
	for (const reader of READERS) {
		safe(() =>
			api.i18n.register("en", {
				[`structures|${reader.id}|status`]: "{summary}",
			}),
		);
		safe(() =>
			api.structures.updateDefinition(reader.id, {
				defaultData: { summary: summaryText(reader, null) },
			}),
		);
		safe(() =>
			api.structures.forEachOfType(reader.id, (structure) => {
				safe(() => api.structures.setData(structure, { summary: summaryText(reader, structure) }));
			}),
		);
	}
}

async function registerReader(reader) {
	await safe(() => api.sprites.loadFromMod(reader.id, `${reader.id}.png`));

	safe(() =>
		api.structures.register({
			id: reader.id,
			name: reader.name,
			description: `Emits a true signal when stored ${reader.resourceKey} is at least a threshold you set by clicking the placed block.`,
			categoryKey: "logic",
			// Gating this behind research hit a real limitation in the tech API
			// (see the notes further down), so these are available from the
			// start instead - getting the blocks to actually show up reliably
			// matters more than the progression nicety.
			alwaysUnlocked: true,
			buildModes: [{ type: "single" }],
			variants: [{ id: reader.id, angles: [0] }],
			render: {
				imageName: reader.id,
				size: { width: 16, height: 16 },
				offset: { x: 0, y: 0 },
				ui: { outline: true },
			},
			defaultData: { summary: summaryText(reader, null) },
			tooltipHover: {
				type: "custom",
				dataFieldMessage: {
					messageKey: `structures|${reader.id}|status`,
					fields: [{ field: "summary", param: "summary", fallback: "" }],
				},
			},
		}),
	);

	// Belt and suspenders: alwaysUnlocked is a flag on the definition, this is
	// a direct write to the player's own unlocked-buildings list (the same
	// data underlying the build menu's "have I unlocked this" check). If one
	// of the two mechanisms turns out not to be respected, the other should
	// still make the block buildable.
	safe(() => api.player.buildings.unlockByType(reader.id));

	// registerSenderType's callback receives (session, structure) - the
	// structure is what makes a per-instance threshold possible here.
	safe(() => api.signals.registerSenderType(reader.id, (session, structure) => computeReaderOutput(reader, structure)));
}

for (const reader of READERS) {
	await registerReader(reader);
}

refreshTooltips();
safe(() => api.settings.onChange(refreshTooltips));

// Tried gating this behind research instead of alwaysUnlocked, twice:
//   1. Appending to the existing "Signal Devices" tech's unlocks via
//      tech.getDefinitionById/updateDefinition - getDefinitionById returned
//      nothing for a confirmed-correct numeric id.
//   2. Registering a brand new tech node (tech.registerNode) requiring
//      Signal Devices as its parent, the same call the community's "Atomic
//      Age" mod uses for its own machines - failed with "missing parent",
//      which traces back to the engine's own duplicate/parent check only
//      recognizing tech nodes that were themselves added via registerNode,
//      not the ~110 built-in vanilla techs (SignalDevices included).
// Both are real limitations in this version of the tech API, not bugs in
// this mod, so the blocks are simply always buildable instead (see
// alwaysUnlocked above).

// Keep wired lamps (and anything else) honest, every frame: recompute each
// reader's value (now per-instance) and write it straight into
// session.mods.signals - see the big comment near the top of the file for
// why this talks to that object directly instead of calling signals.setAll.
function refreshLiveSignalOutputs() {
	const signals = safe(() => sandkit.state.session.mods.signals);
	if (!signals || !signals.links || !signals.dirtyReceivers) return;
	for (const reader of READERS) {
		safe(() =>
			api.structures.forEachOfType(reader.id, (structure) => {
				const value = computeReaderOutput(reader, structure);
				const links = signals.links[`${structure.x},${structure.y}`];
				if (!links || !links.length) return;
				for (const link of links) {
					link.on = value;
					signals.dirtyReceivers.add(`${link.x},${link.y}`);
				}
			}),
		);
	}
}
safe(() => api.events.on("frame:update", refreshLiveSignalOutputs));

// =================== CLICK-TO-CONFIGURE PANEL ===================

// Plain mutable object, not React state - the panel component below polls
// it (same pattern the community's "Power Monitor" mod uses for its HUD)
// so it can be written to from the click handler outside of React.
const panelState = { open: false, structure: null, reader: null };

function findReaderByStructure(structure) {
	return READERS.find((reader) => safe(() => api.structures.isType(structure, reader.id)));
}

safe(() =>
	api.hooks.intercept("action:intercept", (args, context) => {
		if (typeof args.cellX !== "number" || typeof args.cellY !== "number") return;
		// Don't hijack clicks meant for wiring or demolishing the block.
		const active = safe(() => api.action.getActive());
		if (active && (active.id === "signalLinker" || active.id === "demolisher")) return;
		const structure = safe(() => api.structures.getAtCell(args.cellX, args.cellY));
		if (!structure) return;
		const reader = findReaderByStructure(structure);
		if (!reader) return;
		panelState.open = true;
		panelState.structure = structure;
		panelState.reader = reader;
		if (context && typeof context.cancel === "function") context.cancel();
	}),
);

const overlayStyle = {
	position: "fixed",
	inset: 0,
	zIndex: 2147483647,
	background: "rgba(5,7,10,0.6)",
	display: "flex",
	alignItems: "center",
	justifyContent: "center",
	pointerEvents: "auto",
};
const panelStyle = {
	minWidth: "280px",
	padding: "16px 18px",
	background: "rgba(12,15,20,0.97)",
	border: "1px solid rgba(255,196,107,0.4)",
	borderRadius: "6px",
	color: "#e6e2d5",
	font: "13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace",
	boxShadow: "0 8px 30px rgba(0,0,0,0.6)",
};
const titleStyle = { color: "#ffc46b", fontWeight: "bold", marginBottom: "10px" };
const rowStyle = { display: "flex", flexDirection: "column", gap: "4px", marginBottom: "14px" };
const inputStyle = {
	background: "#0a0d12",
	border: "1px solid rgba(255,255,255,0.2)",
	borderRadius: "4px",
	color: "#e6e2d5",
	padding: "6px 8px",
	font: "inherit",
	width: "100%",
	boxSizing: "border-box",
};
const buttonRowStyle = { display: "flex", gap: "8px", justifyContent: "flex-end" };
function buttonStyle(primary) {
	return {
		padding: "6px 14px",
		borderRadius: "4px",
		border: primary ? "1px solid #ffc46b" : "1px solid rgba(255,255,255,0.25)",
		background: primary ? "#ffc46b" : "transparent",
		color: primary ? "#151006" : "#e6e2d5",
		font: "inherit",
		fontWeight: primary ? "bold" : "normal",
		cursor: "pointer",
	};
}

function ReaderConfigPanel() {
	const [, bump] = React.useState(0);
	const inputRef = React.useRef(null);

	React.useEffect(() => {
		const id = setInterval(() => bump((v) => v + 1), 150);
		return () => clearInterval(id);
	}, []);

	if (!panelState.open || !panelState.structure || !panelState.reader) return null;
	const { structure, reader } = panelState;
	const currentValue = getThreshold(reader, structure);

	const close = () => {
		panelState.open = false;
		panelState.structure = null;
		panelState.reader = null;
	};
	const save = () => {
		const raw = inputRef.current ? inputRef.current.value : "";
		const num = Number(raw);
		if (Number.isFinite(num)) {
			safe(() => api.structures.setData(structure, { threshold: num }));
			safe(() => api.structures.setData(structure, { summary: summaryText(reader, structure) }));
		}
		close();
	};
	const onKeyDown = (event) => {
		if (event.key === "Enter") save();
		else if (event.key === "Escape") close();
	};

	return h(
		"div",
		{ style: overlayStyle, onClick: close, onKeyDown },
		h(
			"div",
			{ style: panelStyle, onClick: (e) => e.stopPropagation() },
			h("div", { style: titleStyle }, `${reader.name} - threshold`),
			h(
				"div",
				{ style: rowStyle },
				h("label", null, `Fire true when stored ${reader.resourceKey} is at least:`),
				h("input", {
					key: `${structure.x},${structure.y}`,
					ref: inputRef,
					type: "number",
					defaultValue: currentValue,
					style: inputStyle,
					autoFocus: true,
					onKeyDown,
				}),
			),
			h(
				"div",
				{ style: buttonRowStyle },
				h("button", { style: buttonStyle(false), onClick: close }, "Cancel"),
				h("button", { style: buttonStyle(true), onClick: save }, "Save"),
			),
		),
	);
}

safe(() => api.ui.inject("resource-signal-readers-panel", ReaderConfigPanel));
