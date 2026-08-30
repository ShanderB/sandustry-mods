// Visible Water on Map
//
// Water was practically invisible on the map/minimap. Traced it to a color
// collision, not a missing feature: the map view's fog-of-war shader uses
// the same atmospheric gradient as the live game background for open sky,
// whose top color is rgb(15, 145, 255) - and Water's own map color
// (metaColor on its element definition) is rgb(30, 144, 255). Those are
// close enough to be indistinguishable at map scale, so a lake reads as
// "more open sky" rather than as water.
//
// Fix is a call to the public, documented Sandkit API - no bundle patch
// needed. api.elements.updateDefinition writes the new color into the
// same element-definition table the map's color palette (and every other
// place that shows an element's color: tooltips, the filter picker,
// vacuum tank fill bars, etc) reads from, so this one change is picked up
// everywhere water's color shows up, not just the map.
//
// updateDefinition("water", ...) - passing the string id directly - does
// not work for a vanilla element: its internal implementation only looks
// the string up in sandkit.mods.elements, the table of mod-registered
// elements, and Water was never registered there (it is core game
// content). No match means it silently returns without changing anything
// - no error, no effect, exactly what happened when this string form was
// tried first. Passing the numeric element type instead skips that lookup
// entirely, so this resolves "water" to its type with getTypeFromId first
// (the same pattern getDefinitionByType/isTypeAtCell etc. use) and updates
// by type, matching the branch of updateDefinition that vanilla elements
// actually go through.
const api = sandkit.api;

function safe(fn) {
	try {
		fn();
	} catch (e) {
		console.error("[shander.visible-water-map]", e);
	}
}

// A teal, clearly apart from the sky's blue in hue (not just brightness),
// so it still reads as "water" without disappearing into the backdrop.
const WATER_MAP_COLOR = 0x00c8b4;

safe(() => {
	const waterType = api.elements.getTypeFromId("water");
	if (typeof waterType !== "number") throw new Error(`getTypeFromId("water") did not return a number: ${waterType}`);
	api.elements.updateDefinition(waterType, { metaColor: WATER_MAP_COLOR });
});
