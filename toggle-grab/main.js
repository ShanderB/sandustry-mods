// Toggle Grab
//
// All gameplay behavior is implemented via patches.json (the game has no
// stable hook to override a specific tool's "held" state, so the mouse
// action logic is patched directly). This file exists only because Sandkit
// requires a manifest to declare "entry" or another capability field, and it
// doubles as a place to log that the mod loaded.
//
// The on/off setting declared in modinfo.json's configSchema ("enabled") is
// read directly by the patched code every frame from
// session.settings.externalModSettings["shander.toggle-grab"].enabled, so no
// wiring is needed here for the toggle in the Mods tab to work.
if (typeof log === "function") {
	log("info", "shander.toggle-grab", "Toggle Grab loaded");
}
