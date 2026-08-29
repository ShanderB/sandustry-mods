# Toggle Grab (Sandustry)

Makes the **Grabber** tool (picks up and drops sand/material with the left
mouse button) work as a toggle: click once to start grabbing/holding
material continuously, click again to drop it. You no longer have to keep
the button held down. Every other tool (dig, weapons, building) keeps
working exactly as before.

Includes an **on/off setting** in the mod's own panel under the game's Mods
tab ("Toggle Mode"), so it can be switched back to the default hold-to-grab
behavior at any time without uninstalling the mod.

Built on **Sandkit**, Sandustry's native mod system - no external loader or
program required.

## Install locally

1. Copy this whole folder (`toggle-grab`, with `modinfo.json`,
   `patches.json`, `main.js` and `preview.png`) into the game's local mods
   folder:

   `%APPDATA%\sandustry\mods\`

   (i.e. `C:\Users\<you>\AppData\Roaming\sandustry\mods\`). Create the
   `mods` folder if it doesn't exist yet - the game also creates it
   automatically the first time it runs.
2. Launch Sandustry normally through Steam. The game discovers the mod on
   its own at startup.
3. In-game, open the Mods tab to flip "Toggle Mode" on/off if you want to
   go back to vanilla hold-to-grab.

## How it works

The game drives every tool (dig, weapon, building, grabber) through one
generic "button held" state. `patches.json` only changes what that state
means while the Grabber tool is equipped: instead of reflecting whether the
mouse button is physically held, it flips a toggle on every real click - and
it reads the mod's own `enabled` config value (from
`session.settings.externalModSettings["shander.toggle-grab"].enabled`)
every frame, so switching the "Toggle Mode" setting in the Mods tab takes
effect immediately. No other tool is touched. The patch was verified by
running the game's own patch validator/applier (extracted from
`workshop-mods.js`) against the real installed `bundle.js`.

## Publishing to the Steam Workshop

This mod is ready to publish:

- `preview.png` (512x512) is included.
- `modinfo.json` has `name`, `description` and `version` filled in - these
  become the Workshop listing's title, description and change note.

To publish: have Steam running, open Sandustry, go to the Mods tab, find
"Toggle Grab" in your local mods list and use its upload/publish action. The
first publish creates the Workshop item as **Unlisted** - visit the item's
Steam Workshop page afterwards and set it to Public when you're ready to
share it. The game writes a `workshop.json` file into this folder once
published; don't edit or delete it, it's what links this local folder to
the Workshop item for future updates (bump `version` in `modinfo.json` and
publish again to push an update to the same item).
