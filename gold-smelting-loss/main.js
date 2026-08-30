// Gold Smelting Loss
//
// The game's own moddable "structures.recipes" system (used by every
// periodic structure: condenser/steamDryer/synthesizer/snowmaker/smelter)
// only supports probabilistic outputs (a {elementType, chance} roll via
// Math.random() per cell). That can't give a guaranteed, exact ratio - a
// chance-based recipe can (and will) sometimes destroy a cell with no
// output at all, which is exactly the "maybe" behavior we don't want here.
//
// So instead this hooks "cell:process" (the low-level intercept that fires
// when a periodic structure - smelter included - is about to process a
// cell sitting on it) and replaces the game's random pick with our own
// deterministic counter: every 2 solid gold cells consumed by a given
// smelter always produce exactly 1 liquid gold cell, every time, with no
// randomness. Nothing is ever silently discarded - gold that enters a
// smelter always ends up as liquid gold, just packed 2:1.
//
// "cell:process" isn't fully documented (no args shape is published), so
// this reads several plausible field names defensively and logs once if
// none of them match, so the mismatch can be fixed from that log line
// instead of guessing blind.
//
// Compacting 2 cells into 1 would normally halve the total sellable value
// too (each cell counts as 1 unit of gold by default), which isn't what we
// want - only the physical footprint should shrink, not the payout. So
// every liquid gold cell created by this mod is tagged (via a per-cell
// data field) as worth 2x, and "resource:collection:prepare" reads that
// tag to double the amount granted only for those cells - regular,
// never-melted gold is untouched and still worth 1.
const MOD_ID = "shander.gold-smelting-loss";
const GOLD_ELEMENT_ID = "gold";
const SMELTER_STRUCTURE_ID = "smelter";
const CELLS_PER_OUTPUT = 2; // 1000 solid pixels in -> ~500 liquid pixels out
const VALUE_DATA_FIELD = 1; // unused data field slot on gold cells
const VALUE_MULTIPLIER = CELLS_PER_OUTPUT; // compensates the 2:1 compaction so total value is unchanged

const creditByStructure = new Map();
let loggedShapeIssue = false;

function getCellXY(args) {
	if (typeof args.cellX === "number" && typeof args.cellY === "number") {
		return { x: args.cellX, y: args.cellY };
	}
	if (args.position && typeof args.position.x === "number") {
		return { x: args.position.x, y: args.position.y };
	}
	if (args.cellPosition && typeof args.cellPosition.x === "number") {
		return { x: args.cellPosition.x, y: args.cellPosition.y };
	}
	return null;
}

function handleCellProcess(args, context) {
	try {
		const api = sandkit.api;
		if (!args) return;

		const cell = getCellXY(args);
		if (!cell) {
			if (!loggedShapeIssue) {
				loggedShapeIssue = true;
				log("warn", MOD_ID, "cell:process args did not match any known cell-position field: " + JSON.stringify(args));
			}
			return;
		}

		const structure = args.structure || api.structures.getAtCell(cell.x, cell.y);
		if (!structure || !api.structures.isType(structure, SMELTER_STRUCTURE_ID)) return;

		const key = structure.x + "," + structure.y;
		const credit = (creditByStructure.get(key) || 0) + 1;

		// Always consume the solid gold - melting itself never fails.
		api.elements.removeAtCell(cell.x, cell.y);

		if (credit >= CELLS_PER_OUTPUT) {
			creditByStructure.set(key, 0);
			api.elements.createAtCell(cell.x, cell.y, GOLD_ELEMENT_ID);
			// Mark this cell as "compacted" gold so the collection hook below
			// grants it VALUE_MULTIPLIER worth of value instead of 1 - the
			// pool has half as many cells, but each one counts for two, so
			// smelting never loses value versus collecting the gold raw.
			api.elements.setDataFieldAtCell(cell.x, cell.y, VALUE_DATA_FIELD, VALUE_MULTIPLIER);
		} else {
			creditByStructure.set(key, credit);
		}

		// Stop the default (chance-based) handling from running as well.
		if (context && typeof context.cancel === "function") context.cancel();
	} catch (err) {
		log("error", MOD_ID, "cell:process handler failed: " + (err && err.message ? err.message : String(err)));
	}
}

sandkit.api.hooks.intercept("cell:process", handleCellProcess, {
	guard: { elementType: GOLD_ELEMENT_ID },
});

function handleResourceCollection(args) {
	try {
		if (!args || args.resourceId !== GOLD_ELEMENT_ID) return;
		if (typeof args.cellX !== "number" || typeof args.cellY !== "number") return;

		const multiplier = sandkit.api.elements.getDataFieldAtCell(args.cellX, args.cellY, VALUE_DATA_FIELD);
		if (multiplier && multiplier > 1) {
			args.amount = args.amount * multiplier;
		}
	} catch (err) {
		log("error", MOD_ID, "resource:collection:prepare handler failed: " + (err && err.message ? err.message : String(err)));
	}
}

sandkit.api.hooks.modify("resource:collection:prepare", handleResourceCollection, {
	resourceIds: [GOLD_ELEMENT_ID],
});
