// Filtered Launchers
//
// Two buildables ("Filtered Launcher" and "Advanced Filtered Launcher")
// that are, at the same time, a real vanilla-style Launcher AND a real
// Filter, occupying the same tile. Both build and drag exactly like the
// vanilla Launcher: drag straight up to place the Up segment, drag toward a
// corner to place Left/Right - one build-menu icon per buildable, direction
// chosen by dragging, not three separate buttons each. Throw anything at a
// placed segment and it launches it exactly like the standard Launcher
// (same velocity) - but only if that material is currently allowed by the
// segment's own filter. Equip either one (same as selecting the matching
// vanilla Filter/Advanced Filter) to configure what's allowed in the
// game's own filter screen before placing, or to see and click existing
// placed segments on screen to redirect that same screen to them instead.
// Filtered Launcher pairs with the plain Filter (one resource at a time,
// solids only by default); Advanced Filtered Launcher pairs with the
// Advanced Filter/Filter Mk2 (multiple resources at once, liquids and
// gases always included, launcher speed doubled to match) - see the
// FAMILIES data below and point 5's closing note for how the second
// buildable was added on top of the first. Each is unlocked through the
// Research tab like any other structure - Filtered Launcher needs Filter
// researched first, Advanced Filtered Launcher needs both Advanced Filter
// and Conveyors Mk2 - see point 8 for how that was added despite the
// public tech-registration API refusing a vanilla tech as a prerequisite.
//
// Why buildables like these instead of "just place a Filter next to a
// Launcher" (which already works today, natively, with zero mods): this
// saves the extra tile and extra click, and is what was actually asked
// for - one buildable that is both at once, not a recipe for combining two
// vanilla ones.
//
// ============================= HOW THIS WORKS =============================
//
// Traced this from the game's own bundle.js / simulation-worker.js (the
// same extracted copy validate-mod.js uses), because none of this is
// documented anywhere. Several bugs were found and fixed this way after
// actually trying earlier versions in-game - each one is called out below
// with what broke and what the real cause turned out to be.
//
// 1. LAUNCHING is a first-class, public Sandkit mechanism, not something
//    reserved for the vanilla Launcher. The vanilla "Mk2" launcher (a real,
//    shipped, non-modded upgrade) is itself implemented as an internal
//    "mod" that calls the exact same function this file calls:
//    sandkit.api.structureBehaviors.registerLauncherType({ upType, leftType,
//    rightType, velocity, softDropVelocity }). Every place in the game that
//    asks "is this cell a launcher?" (build-direction detection, corner
//    snapping, the tutorial's "did you build a launcher" check, tooltips,
//    isLauncherAt) already consults this same registry
//    (session.sandkit.registeredLauncherTypes), so a type registered this
//    way is a first-class launcher everywhere in the game, not a fake.
//    velocity/softDropVelocity below are copied verbatim from the game's
//    own balance data for the standard (non-Mk2) Launcher, so this throws
//    at the same speed as vanilla - it is not a "fast launcher" mod.
//
// 2. FILTERING (the actual gameplay effect - blocking disallowed elements
//    from ever entering the cell) is a property of the *tile*, not of a
//    specific structure type. Any structure with a `.filter` object
//    (`{mode, elementType, density, affectsLiquid, affectsGas}`) gets that
//    filter encoded into the occupied cell's own packed tile flags the
//    moment the structure is built or updated (same encode step the vanilla
//    Filter, Filter Wall, Critter Fence and Grower all go through - traced
//    this in simulation-worker.js). The generic "can this element move
//    through this cell" check reads those same tile flags directly - it has
//    no idea which structure type owns the cell, only the encoded filter.
//    That's what lets a launcher cell also gate what enters it, same as a
//    Filter would.
//
//    The public API has no direct "set this structure's .filter" call
//    (api.structures.setData only ever touches `.data`, never `.filter`).
//    api.structures.getAtCell returns the live, mutable structure object
//    the simulation itself reads, and api.structures.update(...) is the
//    same "commit a change and re-encode the tile" call setData uses
//    internally - so this sets `.filter` directly on that object and calls
//    update() on it. ensureFilters() below does this once per newly placed
//    block (detected by `.filter` still being unset), every frame - cheap,
//    a no-op read for every block that already has one.
//
// 3. BUG (fixed): first version showed 3 separate build-menu icons (Up,
//    Left, Right) instead of one. Cause: all three were unlocked via
//    api.player.buildings.unlockByType() - turns out that's not what
//    controls menu visibility. Found the real switch reading a *different*
//    community mod's code in this same bundle.js (`hideFromBuildMenu` on a
//    structures.register() call, used by a singleton "Earth Stratacore"
//    building to hide itself after being placed once). Left/Right now set
//    `hideFromBuildMenu: true`; only Up (the menu icon players actually
//    click) omits it. All three stay unlocked - unlocking is what makes
//    them buildable at all, hideFromBuildMenu is the separate, correct
//    switch for "buildable, but not its own menu entry."
//
// 4. BUG (fixed): placed segments were invisible, and separately, the first
//    fix for that made them render *giant* (a whole 4x4/4x6-cell image over
//    a 1-cell footprint). Two different mistakes:
//      - render.imageName was first set to the vanilla sprite keys
//        ("launcher"/"launcher_left"/"launcher_right"), assuming that
//        because the base game already has those loaded, any mod could
//        reference them by name for free - wrong. Vanilla's own rendering
//        for native enum structures bypasses the mod sprite registry
//        entirely (baked into the game's own texture atlas); the generic
//        mod-render path only ever looks up `sandkit.graphics[imageName]`,
//        which the vanilla loader never populates for those names. A mod
//        has to ship and load its own image - fixed by loading a PNG per
//        segment via api.sprites.loadFromMod. gen_sprites.py builds those
//        PNGs by taking the actual vanilla launcher.png/launcher_left.png/
//        launcher_right.png (copied from the installed game's dist/img/ as
//        base_launcher_*.png, included so the script is reproducible) and
//        drawing a crossbar + "F" mark into the sprite's own transparent
//        interior, reusing only colors already in the vanilla sprite (its
//        black outline, its gray frame band - no new colors added), so
//        this looks like a real Launcher with an "F" on it, not a
//        from-scratch icon or an odd color. Re-run it after editing the
//        coordinates, or swap in different base_*.png files entirely.
//      - The first attempt at loading a sprite also copied the vanilla
//        Launcher's own render *size* (4x4/4x6 cells worth of pixels), on
//        the assumption that mattered for visual continuity the way it
//        does for the real Launcher's multi-cell drag shafts. It doesn't
//        apply here: this mod has no "shape" matrix (see the buildModes
//        note below), so each placed segment's actual footprint is exactly
//        1 cell - a 4-6 cell image on a 1-cell block just floats oversized
//        over its neighbors. Fixed by rendering each segment at its
//        sprite's own native aspect ratio scaled to fit a 1-cell (16px)
//        box instead (18x18 native for Up, 18x26 for Left/Right - stretched
//        to a square would visibly distort the diagonal shape).
//
// 5. BUG (four attempts to get right): clicking/selecting never showed the
//    real, native filter screen. What each attempt got wrong:
//      a) First tried tooltipHover:{type:"custom"} plus a from-scratch
//         click-to-configure panel (action:intercept + api.ui.inject).
//         Worked, but reimplemented the screen instead of reusing it.
//      b) Found the native editor (`filterGroupEditor`) is gated by a
//         hardcoded whitelist of six vanilla type strings and patched this
//         mod's three type ids into it. The editor still didn't show on a
//         plain click - because (as it turns out) *no* vanilla Filter shows
//         it on a plain click either. It's a build-tool overlay, gated on
//         `session.building.activeStructureType` - only visible while the
//         matching item is the equipped/active hotbar tool.
//      c) Patched two of those hardcoded arrays (see below) so equipping
//         this mod's item also flips that flag, and switched back to
//         `tooltipHover:{type:"filter"}` (the plain "Filter" hover word and
//         a live Grabber-hover summary, both free, driven by that flag
//         directly rather than any whitelist) - but kept the from-scratch
//         panel too, as a click handler for *already placed* segments.
//         That panel's own action:intercept hook unconditionally intercepts
//         every click on this mod's structures, though, which meant it
//         always won over anything native trying to happen underneath -
//         so equipping the tool and clicking a placed segment still only
//         ever showed this mod's own panel, never the native one.
//      d) Traced the actual native "click an existing placed Filter to
//         redirect the editor to it" mechanism (a set of DOM overlay boxes
//         drawn over on-screen filter clusters, each with its own onClick
//         calling into the editor's selectAt()) and found its activation
//         condition is the exact same flag: `pk.includes(activeStructureType)`
//         - i.e. it's not "always there for any placed Filter", it's "only
//         while you have a matching item equipped", same as the panel
//         itself. With the two patches from (c) already extending that
//         list, this mod's segments qualify for that overlay too, with no
//         further patching needed - so the honest fix was to delete this
//         mod's own panel entirely (removed) rather than have it keep
//         shadowing the now-working native path. Equip the Filtered
//         Launcher like a vanilla Filter: the config screen appears for
//         what you're about to place, and existing placed segments on
//         screen get the same clickable highlight boxes a vanilla Filter's
//         do, redirecting that same screen to edit them instead.
//
//      e) BUG (fixed): with (c)/(d) applied, equipping the Filtered
//         Launcher showed the real filter screen, defaulting to Sand
//         selected - but picking any *other* element in that screen
//         silently turned the equipped item back into a plain vanilla
//         Filter (or Filter Mk2), discarding this mod's item entirely.
//         Traced the element-picker's own click handler: after applying
//         the picked element to the draft filter, in single-select mode it
//         closes the picker and, completely unconditionally, does
//         `activeStructureType = <is this Mk2?> ? "filterRightMk2" :
//         FilterRight` - it only ever knew about two possible filter
//         families (plain and Mk2) and hard-resets to one of them no
//         matter what was actually equipped, since a third, custom family
//         was never anticipated. Fixed with one more small, additive
//         patch: only fall back to that hardcoded reset when the
//         currently-equipped type *isn't* already a recognized filter type
//         (`bk(activeStructureType)`) - for vanilla Filter/Filter Mk2 this
//         is exactly the value already there, so their behavior is
//         unchanged bit-for-bit; for this mod's types (now included in
//         `bk`'s list via the (c) patch) it just leaves the correct type
//         in place instead of stomping it.
//
//    Four patches total for this first buildable, left in patches.json:
//    (c)/(d) each extend one existing array literal (`mk`, a building
//    block of the editor's own whitelist `pk` and of the overlay-boxes'
//    filter list; and a second, independent whitelist in the
//    hotbar-selection code that flips `activeStructureType` on when
//    picking a slot), and (e) wraps one hardcoded reassignment in a
//    condition. All four are purely additive - nothing about how any of
//    this is used changes for vanilla or Mk2.
//
//    One cosmetic loose end: the editor's title is decided by an
//    `if/else` that only recognizes the vanilla type names, so it reads
//    "Filter" rather than "Filtered Launcher" - cosmetic only, the
//    allow/block list and element picker work the same regardless.
//
//    f) Adding the second buildable (Advanced Filtered Launcher, pairing
//       with vanilla's Advanced Filter/Filter Mk2 instead of plain Filter)
//       needed one more array: `Uk`, a third, separate whitelist that
//       decides whether the filter screen runs in "Mk2 mode" - multiple
//       elements selectable at once instead of one, and liquids/gases
//       always on - and, as a side effect, picks the "Advanced Filter"
//       title instead of the generic "Filter" one (so this buildable
//       doesn't have the cosmetic title issue above at all). Its three
//       type ids also had to join `mk` and the hotbar-selection list from
//       (c)/(d) - being in `Uk` alone doesn't make the screen recognize a
//       type as filterable in the first place, it only changes *how* the
//       screen behaves once it's already agreed to show. One more
//       purely-additive array extension, same shape as the other three.
// 6. BUG (fixed): the filter never seemed to do anything - blocked
//    everything, allowed or not (tested with Gold: never got launched no
//    matter the config). Traced the launcher's own per-tick "should I throw
//    what's sitting in me" function in simulation-worker.js. For a
//    *custom*-registered launcher type, if the material sitting in it isn't
//    already an in-flight particle, the code reads
//    `registeredLauncherTypes[...].runTickSharedBufferKey` and, if that
//    field is missing, unconditionally bails out (`return false`) - forever,
//    every tick. This mod never set that field (matches what the honesty
//    note in an earlier version of this file flagged as unconfirmed). The
//    vanilla non-Mk2 Launcher doesn't hit this at all - native types skip
//    straight to a simple `machineryEngine.runLaunchers` on/off check
//    instead. Only the Mk2 upgrade uses runTickSharedBufferKey, paired with
//    its own dedicated worker-side tick trigger (`workers.triggers`, not
//    part of the exposed public API), purely so it can fire at 2x the
//    normal cadence.
//
//    Since this mod only needs vanilla (non-Mk2) speed anyway, replicating
//    Mk2's whole shared-buffer/worker-trigger machinery would be solving the
//    wrong problem. patches.json instead makes a custom launcher type with
//    *no* runTickSharedBufferKey fall back to that same
//    `machineryEngine.runLaunchers` check the vanilla Launcher already uses
//    - one small, additive change (an `if(!t){...}else{...}` wrapped around
//    the existing bail-out) that leaves every vanilla and Mk2 launcher's
//    behavior completely untouched (they still take the exact original
//    branches - Mk2 always has a key, vanilla enum types never reach this
//    code path at all).
//
// 7. The vanilla Launcher's drag-direction switching (drag up -> Up type,
//    drag toward a corner -> Left/Right type, including which corner it
//    snaps to) is itself generic, keyed off `registeredLauncherTypes` the
//    same way `isLauncherAt` is - it does not special-case the vanilla type
//    names. That part worked correctly from the first version once all
//    three types were declared in registerLauncherType.
//
// buildModes originally only used "line" (vertical/diagonal) - an earlier
// version of this note claimed the vanilla Launcher's extra
// "launcherRectUp"/"launcherRectSide" modes (drag a whole rectangular block
// of launchers at once) needed a per-cell collision "shape" matrix that
// wasn't readable, so they were left out. That was wrong: LauncherUp's own
// registration does reference a shape key (`_["launcher-up"]`), but that key
// simply doesn't exist in the game's shapes table - it resolves to
// `undefined` at runtime, meaning the real Launcher has no shape matrix
// either. Tracing the actual placement code for these two modes (the
// generic building-tool function that turns a drag into a list of
// positions + structure types) shows neither depends on `shape` at all:
// the rectangle-vs-line choice is generic (reads the structure's own
// `buildModes` array, same mechanism "line" already used), rectangle-fill
// is a plain 2D fill between drag start and cursor, and the per-cell
// Up-vs-Left-vs-Right assignment inside that rectangle is done by looking
// the placed type up in `session.sandkit.registeredLauncherTypes` -
// exactly the same registry point 1's registerLauncherType call already
// puts this mod's types into, with no vanilla-only special-casing anywhere
// in that lookup. So both modes were just added to buildModes below,
// unpatched, and work the same way vanilla's do: drag a rectangle instead
// of a single column, and get a whole block of the Up segment on top with
// Left/Right feeder segments underneath (rectUp), or a whole sideways wall
// of Left/Right segments (rectSide).
//
// 8. Both buildables were alwaysUnlocked from day one - available from the
//    start, with no research tie-in. Making them appear in the Research
//    tab, gated behind real vanilla prerequisites (Filtered Launcher needs
//    Filter; Advanced Filtered Launcher needs both Advanced Filter and
//    Conveyors Mk2), first looked like the exact same dead end resource
//    Signal Readers hit trying this (see that mod's own README): the
//    public function that both defines a tech and places it in the tree
//    (api.tech.registerNode) explicitly requires its parent to have
//    *also* been registered through that same function - reading the
//    validation code directly, it checks the parent id against a
//    mod-only registry, which no vanilla tech is ever in, so any vanilla
//    parent always throws "references missing parent".
//
//    But registerNode turned out to bundle two things: defining a tech's
//    data (cost/requires/unlocks) and placing it in the visible grid.
//    api.tech.addDefinition only does the first half - reading its
//    implementation, it's a plain, unconditional write into the same
//    definitions table registerNode uses, with none of that function's
//    parent-registry check. A `requires` field pointing straight at a
//    vanilla tech id (an array of two ids, for the Advanced one needing
//    both prerequisites at once) works through this path with no patch
//    at all - confirmed against a vanilla tech that does exactly this
//    itself (Drill requires both Rocket and GoldBattery). The one thing
//    addDefinition can't do is place the node in the grid other structures
//    get rendered from - a definition with no grid cell is simply never
//    enumerated - so patches.json adds one grid cell per tech (each
//    replacing a single already-`null` slot directly below its real
//    prerequisite, in the same static array vanilla's own tech grid is
//    written in) while this file supplies the actual definition data
//    through the real, unrestricted public call. Two small, targeted
//    patches instead of the dead-end path, not a full patched-in tech
//    tree - point 5's four patches remain the largest share of what this
//    mod has to touch outside the public API.
//
//    Because unlocking is now real, alwaysUnlocked and the unconditional
//    unlockByType call from every earlier version of this file are gone;
//    only the primary (Up) type of each family is ever listed in a tech's
//    unlocks.structures (matching vanilla's own Conveyors tech, which only
//    lists LauncherUp, never LauncherLeft/Right) - Left/Right become
//    placeable once the family is unlocked via the same generic
//    drag-tool/registeredLauncherTypes resolution vanilla itself relies on
//    for its own diagonal segments, confirmed by that same vanilla tech
//    data never listing them individually either.
//
// 9. Liquids and gases CAN be launched - Advanced Filtered Launcher only,
//    not a vanilla Launcher limitation this mod works around, but one this
//    mod lifts, on purpose, scoped to just that one block type. Started
//    from the same report point 9 used to document as "expected, inherited
//    from vanilla": allowing liquids/gases through the filter let them
//    occupy the tile but never actually get thrown. Reading
//    simulation-worker.js to confirm that assumption found the opposite of
//    what was expected - it's not an engine limitation at all, just a
//    missing function call. Every matter type (Solid, Liquid, Gas, Slushy,
//    Wisp, Powder, Static) has its own per-tick update function in one
//    shared dispatch table; Solid, Slushy, Wisp and Powder all call the
//    same launcher-pickup check this mod's own launching relies on
//    (point 1) as the very first thing they do each tick - that's the
//    actual mechanism that lets a Launcher grab Sand, WetSand, Petalium,
//    FreezingIce, etc. Liquid's and Gas's own update functions simply never
//    call it - confirmed neither Water nor Steam has an isTransportable:
//    false anywhere in their definitions (nothing to override), the check
//    is just never reached for them. The generic "become a flying Particle
//    with velocity, revert to the original element on landing" machinery
//    those four other matter types already go through doesn't care what
//    matter type it started from, so there was no reason to expect it
//    wouldn't work equally well for Liquid/Gas once actually wired in.
//
//    Three small patches add exactly that missing call to both the Liquid
//    and Gas update functions (a fourth just introduces an alias so the
//    call can be written without colliding with those functions' own local
//    variable named the same as the module import it needs - purely a
//    minification-collision workaround, changes no behavior by itself).
//    Left alone, that would make every Launcher in the game - including
//    the plain vanilla one and this mod's own plain Filtered Launcher -
//    able to launch liquids/gases, which is a bigger change than intended.
//    So a fifth patch adds one guard, inside the same launcher-pickup check
//    every launcher type shares: if the element about to be picked up is a
//    Liquid or Gas AND the launcher doing the picking up isn't specifically
//    one of the Advanced Filtered Launcher's three registered structure
//    types (Up/Left/Right), bail out before anything happens. Vanilla
//    Launcher/Launcher Mk2 and the plain Filtered Launcher all still only
//    ever throw solids, exactly as before - matching the real Filter vs.
//    Advanced Filter split (only the Advanced tier deals with liquids/gases
//    at all), asked for explicitly after the first version of this made
//    both blocks able to launch them.
//
// 10. BUG (real user report, real fix): a player with 66 other mods
//     installed reported the native filter screen never opening at all -
//     their vanilla Filter worked fine, only this mod's blocks didn't. Their
//     own Mod Inspector output (a third-party diagnostics mod) showed the
//     exact cause directly: 5 of this mod's patches failed with
//     "match_count_mismatch" - the literal vanilla text each one searched
//     for wasn't there anymore by the time this mod's turn came. Two other
//     installed mods (a "Sorter" and "Solaryum") had patches with names
//     unmistakably doing the same kind of thing this mod does - extending
//     the same handful of native filter whitelist arrays for their own
//     custom blocks - and their patches were failing too. The player
//     confirmed by disabling mods one at a time: Solaryum was the one
//     colliding with this one.
//
//     Root cause: every affected patch here originally matched a *complete*
//     original line (a whole array literal ending in `]`, or a whole
//     assignment). If another mod patches that same line first - even just
//     to append its own item the same way this mod does - the full original
//     text this mod's patch is looking for no longer exists, so it fails,
//     regardless of which mod is "right." This isn't a bug in either mod
//     individually - it's what happens when multiple mods independently
//     text-patch the same few narrow vanilla lines, which several apparently
//     do because there are only a handful of places in the whole game that
//     gate "is this a filter/launcher type."
//
//     Fix: every one of these patches was rewritten to match only the
//     smallest unique fragment that has to exist for this mod to work, and
//     to only ever *append* - never re-match text that includes the closing
//     `]` or the rest of a statement another mod might have already
//     extended first. E.g. the whitelist patches now match
//     `mk=["filterWall","filterWallMk2"` (no closing bracket) instead of the
//     full `mk=["filterWall","filterWallMk2"]` - so whether this mod's patch
//     or Solaryum's runs first, each one's own addition lands right after
//     "filterWallMk2" and whatever the other one added (or the original `]`)
//     simply continues to follow, undisturbed. The one exception is the
//     "keep this mod's block equipped after picking an element" patch and
//     the tick-buffer-gate patch, which change a control-flow expression,
//     not append to a list - those now wrap/replace only the smallest
//     original sub-expression that must survive either way, so a
//     differently-ordered but same-shaped fix from another mod is much less
//     likely to remove it entirely. None of this can guarantee zero
//     conflicts with every possible mod combination - it only removes the
//     specific fragility (depending on an *entire* line staying untouched)
//     that this real report exposed.
//
// 11. Feature request (first reaction: declined - turned out incomplete):
//     a player suggested letting non-matching material pass straight
//     through instead of being blocked, only actually launching whatever
//     matches the filter - so it could double as a safeguard on a belt
//     carrying several materials, without jamming the ones it doesn't care
//     about. Looked at this seriously instead of dismissing it, since
//     that's exactly the kind of assumption worth re-checking (see point
//     10's own origin). First conclusion: it doesn't fit, based on
//     reasoning that turned out to be missing a piece - see point 12.
//
//     Point 2 above already established filtering and launching are only
//     combinable *because* the filter blocks entry at the tile level - the
//     launcher itself never looks at the filter list, it just launches
//     whatever solid/liquid/gas happens to already be sitting in the cell
//     (guaranteed to be something the filter allowed, precisely because
//     non-matches never got in). Decoupling "may enter" from "gets
//     launched" the way this request wants would mean a non-matching
//     element *does* enter the tile but doesn't get thrown - and then what?
//     Checked the game's own transport config (the same JSON point 1's
//     velocity numbers came from): Conveyor entries carry a
//     `maxDisplacementCellsPerPass` field - that's the generic per-tick
//     "push sideways" behavior a belt has even when nothing else is acting
//     on it. Launcher entries have no such field, which was read at the
//     time as "a Launcher tile has no passive movement of its own, so a
//     non-matching element let through would just sit there" - true as far
//     as it goes, but incomplete: it ignored that gravity keeps acting on
//     every element regardless of what structure occupies its tile. See
//     point 12 for what actually happens once tried.
//
// 12. The player weighed point 11's explanation and asked to implement it
//     anyway. Rather than proceed on an explanation already flagged as
//     possibly incomplete, re-read the tile-filter-encoding code from point
//     2 again first - and found a real, existing, purpose-built vanilla
//     mechanism for exactly this: the same encode step also reads
//     `structure.data.filterPassThrough` and, if true, sets a separate bit
//     (FILTER_PASS_THROUGH_BIT) that every blocking check consults *first*,
//     skipping enforcement entirely while leaving the filter's own config
//     (and the native UI reading it) untouched. Set via `structure.data`
//     (ensureFilters() below, retrofitted onto older placements too), plus a
//     patch making the launcher itself (which never looked at the filter
//     before - point 11) check the tile's filter config before launching, so
//     it wouldn't launch everything indiscriminately now that nothing
//     blocked entry. Point 11's "it would sit there forever" turned out
//     wrong for the reason expected - gravity keeps acting on unsupported
//     elements regardless of what's on their tile.
//
//     That stopping-blocking-at-the-tile-level part still wasn't enough on
//     its own: a *second*, more complete movement-authorization function -
//     the one belt/conveyor-driven transport specifically calls through -
//     turned out to only honor this same pass-through bit on the branch
//     where an element already matches the filter (where it made no
//     difference, since a match was already authorized anyway); on the
//     non-matching branch it always returned "not authorized" outright, so
//     anything arriving by belt at a pass-through tile still got rejected.
//     One more patch made that function's rejection branch check
//     pass-through too, closing that gap - confirmed against every call
//     site of that function to make sure no other installed content
//     exercises pass-through-plus-non-empty-filter and would be affected by
//     the change. (This patch was later found to have a real conflict with
//     unrelated vanilla content and was removed - see point 13.)
//
//     A different approach - inverting the filter's *mode* only for the
//     tile-encode step (so vanilla's own block-mode logic holds the wanted
//     resource in place instead of using pass-through at all) - was tried
//     next specifically to close a timing gap in this design (see the
//     paragraph below), and did close it, but made real, hands-on play feel
//     substantially worse overall - reported directly, not something static
//     reading flagged - so it was reverted at the player's request rather
//     than kept. The pass-through-based design in this point remains the
//     one this mod actually ships.
//
//     Known, accepted limitation of the shipped design: the launcher only
//     actually fires on a periodic cadence (the same ~683ms "standard" pass
//     vanilla's own non-Mk2 Launcher uses - point 6). Because pass-through
//     means nothing holds a *matching* element in place either, a fast belt
//     (as little as 332ms per step for a plain Conveyor, faster for Mk2) can
//     occasionally push a matching element across the tile and gone again
//     before the next launch pulse gets a chance to check it - worse on very
//     fast belts, and mitigated in practice by chaining more than one
//     Filtered Launcher in a row along a fast line. This is a real,
//     confirmed trade-off of this design, not a misunderstanding - it's
//     being kept anyway because the alternative tried above worked out
//     worse in actual play.
//
//     Separate, unrelated limitation, also reported directly: a layer of
//     unwanted material sitting *on top of* wanted material in a pile keeps
//     the wanted material from ever being launched, because it never
//     reaches the tile to be evaluated at all. Not a bug introduced by this
//     mod - a vanilla Filter has the identical limitation, since neither one
//     can reach through what's physically on top of what they're being fed;
//     nothing in vanilla can "see" or reorder a pile from outside it. Not
//     something a patch to this mod's own blocks can fix.
//
// 13. BUG (real user report, real fix): a player noticed that once this mod
//     was installed, a vanilla Filter (Mk1 or Mk2) built in Wall mode and
//     configured to Block a specific element let that element straight
//     through anyway - confirmed by toggling this mod off/on with the same
//     vanilla structure in place, isolating it to this mod being active.
//     Traced to the movement-authorization patch from point 12's second
//     paragraph above: it changed the shared function's rejection branch to
//     honor the tile's pass-through bit for *any* tile using that function,
//     not just this mod's own segments. Re-reading bundle.js's own vanilla
//     structure registrations (not just this mod's) found the real
//     conflict: filterWall, filterWallMk2 and critterFence already ship
//     with `defaultData:{filterPassThrough:true}` in the base game, for a
//     genuine vanilla reason unrelated to this mod - it lets gravity-fed
//     material fall straight through the tile while still stopping
//     belt/conveyor-fed material that doesn't match (a Critter Fence needs
//     to hold back creatures/conveyed material crossing it while still
//     letting loose material drop past through gaps under gravity; Filter
//     Wall follows the same asymmetric design). Point 12's belt-transport
//     patch overrode that asymmetry for all three vanilla types on any save
//     with this mod installed - regardless of whether this mod's own blocks
//     were even placed - silently defeating their Block-mode filtering
//     against belt-fed material. The point-12 honesty note's own check (no
//     other content uses pass-through-plus-non-empty-filter) missed this
//     because it only checked what reads the bit, not what the base game
//     itself already ships it on by default.
//
//     Fix: removed that patch entirely. The shared movement-authorization
//     function is back to bit-for-bit original vanilla behavior. This mod's
//     own launcher tiles now follow the exact same asymmetry those three
//     vanilla structures already rely on - pass-through is fully reliable
//     for gravity-fed material, but belt/conveyor-fed non-matching material
//     can once again be blocked at the tile, same as a vanilla Filter Wall
//     or Critter Fence would be. Now that the real vanilla design is known,
//     this isn't a workaround for a shortcoming - it's parity with how
//     vanilla's own pass-through-capable structures already behave, which
//     is a more defensible position than a mod-only exception that broke
//     unrelated content. Point 12's tick-timing note (matching elements
//     occasionally slipping past a slow launch pulse on a fast belt) is
//     unaffected by this - it only ever concerned the branch where the
//     element *does* match, which this removed patch never touched.
//
// 14. Point 13's full removal fixed the vanilla regression but reopened the
//     original point-12 complaint for this mod's own blocks: non-matching
//     material fed by a belt went back to getting stuck in front of the
//     tile instead of passing through - reported immediately after point 13
//     shipped. Full removal traded one real bug for reintroducing another;
//     the right fix is scoping point 12's patch to only this mod's own
//     segments, not throwing it away.
//
//     The blocker had been "the movement-authorization function only sees
//     packed tile flags (mode/filter-config-id/pass-through bit), with no
//     idea which structure type owns the tile" - true of the access word,
//     but the function already computes `v`, this tile's numeric block
//     type, one line earlier (needed for its own empty-tile/gold checks).
//     The same module that function imports (module 38394, the one behind
//     writeStructureToGrid/getBlockAccess/isFilterPassThrough/etc.) also
//     exports `getTypeFromIndex`, which turns that number back into the
//     structure's actual type - confirmed by finding it already relied on
//     elsewhere in this exact form for an unrelated vanilla check
//     (`getTypeFromIndex(getBlockTypeAtPos(...))===Foundation`), and it's
//     the very same call this mod's own launcher-tick patch (point 12's
//     first patch, gate-launch-on-tile-filter-match...) already uses to get
//     its own structure type string for comparison - just reached through a
//     different local variable name in this second function.
//
//     Fix: reinstated point 12's belt-transport patch, but instead of
//     unconditionally honoring pass-through on the rejection branch, it now
//     also resolves `getTypeFromIndex(v)` and only takes that branch when
//     the tile's type is one of this mod's own six registered structure
//     ids. filterWall/filterWallMk2/critterFence (or anything else that
//     ships or gets pass-through set) fall through to the untouched
//     original vanilla behavior - always `p` (blocked) on a real mismatch -
//     while this mod's own tiles get the intended belt pass-through back.
//     This is the version that should have shipped as point 12 in the first
//     place; point 13's full removal is kept in the history above as the
//     (overcorrected) intermediate step, not as the final design.
//
// HONESTY NOTE: everything above was verified by reading the game's own
// code and, for points 3-6, by actually testing earlier versions in-game
// and tracing the real cause of each reported bug. structures.register /
// structureBehaviors.registerLauncherType / structures.getAtCell /
// structures.update / api.tech.addDefinition are all real, current, public
// Sandkit API calls (checked against the currently-installed version). The
// twelve patches in patches.json (four for point 5, two for point 8, one
// for point 6, four for point 9 - point 10 rewrote several of the
// point-5/6/9 ones to be order-resilient, one for point 12's launcher-side
// filter check, and one more for point 14's type-scoped movement-
// authorization fix) all touch undocumented internals the way this pack's
// grabber-safe-resize/toggle-grab mods already do for similar reasons -
// each validated with this repo's own validate-mod.js (runs the game's real
// patch applier against the real installed files and checks the patched
// result is still syntactically valid JS), but only actually playing
// confirms the runtime behavior end to end - especially the point-5 patches
// (does the native filter screen and its on-screen overlay boxes really
// treat this mod's segments like a vanilla Filter/Advanced Filter), the
// point-8 ones (does the new tech node actually render, gate correctly, and
// grant the right unlock on research), the point-9 ones (do liquids/gases
// really fly out of the Advanced Filtered Launcher now, and do a plain
// vanilla Launcher/Launcher Mk2 AND the plain Filtered Launcher really
// still refuse them exactly as before), the point-10 one (does this mod's
// filter screen now work correctly alongside Solaryum enabled, without
// needing it disabled), and the point-12/14 ones together (does
// non-matching material really pass through cleanly on both a gravity-fed
// column and a belt line, does matching material still get launched
// reliably enough in practice, AND does a vanilla Filter Wall/Filter Wall
// Mk2/Critter Fence set to Block still correctly block belt-fed material
// with this mod installed) - none of that is something static analysis
// alone can fully settle. This pass-through mechanism has already gone
// through a real-play-driven redesign and reversion (point 12/13), a
// removal that fixed a vanilla regression but broke this mod's own belt
// behavior in the process (point 13), and a type-scoped rewrite meant to
// finally get both right at once (point 14) - so it remains, by a wide
// margin, the part of this mod most worth testing thoroughly rather than
// trusting on the strength of the reasoning alone.

const api = sandkit.api;

function safe(fn, fallback = null) {
	try {
		return fn();
	} catch (e) {
		console.error("[filtered-launcher]", e);
		return fallback;
	}
}

// Copied verbatim from the game's own balance data for the standard
// (non-Mk2) Launcher and its Mk2 upgrade (launchers.structures.launcherUp/
// Left/Right and launcherUpMk2/LeftMk2/RightMk2 in the game's config) - the
// plain family throws at vanilla Launcher speed, the Advanced family at
// vanilla Launcher Mk2 speed (2x), matching each one's paired Filter tier.
const VELOCITY = {
	up: { x: 0, y: -44.4 },
	left: { x: -44.4, y: -44.4 },
	right: { x: 44.4, y: -44.4 },
};
const SOFT_DROP_VELOCITY = {
	up: { x: 0, y: -30 },
	left: { x: -30, y: -30 },
	right: { x: 30, y: -30 },
};
const VELOCITY_MK2 = {
	up: { x: 0, y: -88.8 },
	left: { x: -88.8, y: -88.8 },
	right: { x: 88.8, y: -88.8 },
};
const SOFT_DROP_VELOCITY_MK2 = {
	up: { x: 0, y: -45 },
	left: { x: -45, y: -45 },
	right: { x: 45, y: -45 },
};

// cellSize is not exposed on the public API; 16 matches the pixel size the
// community's other single-tile blocks in this pack (e.g. Resource Signal
// Readers) already use for a 1-cell block - and this mod's segments really
// are 1 cell each (see point 4 above), so the render size below just
// matches that footprint directly instead of guessing at a multiplier.
const CELL = 16;

// Two buildables share everything above: a plain one (pairs with vanilla
// Filter, vanilla Launcher speed) and an "Advanced" one (pairs with vanilla
// Advanced Filter/Filter Mk2 - multiple elements at once, liquids/gases
// always on, not just when the mod setting below turns them on - AND
// vanilla Launcher Mk2 speed, 2x the plain one) - matching how the two
// vanilla tiers pair up (faster launcher, smarter filter) rather than only
// upgrading the filter half.
const FAMILIES = [
	{
		// key drives both the structure type id (shander<Key>Up/Left/Right)
		// and the sprite filename (<key>Up.png etc) - kept as "filteredLauncher"
		// (not just "filtered") so existing placed blocks/saves and sprite
		// files from before this mod had two families keep matching exactly.
		key: "filteredLauncher",
		name: "Filtered Launcher",
		description:
			"Throws material like a Launcher, at the same speed - but only launches material this segment's own filter allows. Everything else simply passes through instead of being blocked. Equip it like a Filter to configure the Allow/Block list. Only solid/physical material is ever thrown, same as a vanilla Launcher - liquids/gases can be allowed or blocked by the filter, but only the Advanced Filtered Launcher actually launches them.",
		techDescription:
			"Unlocks the Filtered Launcher, which works like a Launcher but only throws whatever element its own filter currently allows through.",
		advanced: false,
		velocity: VELOCITY,
		softDropVelocity: SOFT_DROP_VELOCITY,
	},
	{
		key: "advancedFilteredLauncher",
		name: "Advanced Filtered Launcher",
		description:
			"Throws material like a Launcher Mk2, at the same (faster) speed - but only launches material this segment's own filter allows. Everything else simply passes through instead of being blocked. Equip it like an Advanced Filter to configure multiple allowed resources at once. Unlike a vanilla Launcher (and unlike the plain Filtered Launcher), this one also throws liquids and gases if the filter allows them.",
		techDescription:
			"Unlocks the Advanced Filtered Launcher, a Launcher Mk2 that only throws whatever elements its own filter allows through - configure multiple at once, including liquids and gases, like the Advanced Filter.",
		advanced: true,
		velocity: VELOCITY_MK2,
		softDropVelocity: SOFT_DROP_VELOCITY_MK2,
	},
];

for (const family of FAMILIES) {
	family.upId = `shander${family.key[0].toUpperCase()}${family.key.slice(1)}Up`;
	family.leftId = `shander${family.key[0].toUpperCase()}${family.key.slice(1)}Left`;
	family.rightId = `shander${family.key[0].toUpperCase()}${family.key.slice(1)}Right`;
	// Same angle scheme the vanilla Launcher itself registers its three
	// variants with - this is what lets the build tool's generic
	// drag-direction logic snap to the right type/rotation while dragging.
	family.variants = [
		{ id: family.leftId, angles: [-135, 45] },
		{ id: family.upId, angles: [-90, 90] },
		{ id: family.rightId, angles: [-45, 135] },
	];
	// Sizes match each sprite's own native aspect ratio (18x18 for Up,
	// 18x26 for Left/Right - see gen_sprites.py, which draws an "F" and
	// crossbar into the actual vanilla launcher.png/launcher_left.png/
	// launcher_right.png rather than drawing an icon from scratch, plus a
	// couple of small red marks for the Advanced variant), scaled to fit a
	// 1-cell (16px) box on the narrow axis instead of stretching to a
	// square and distorting the shape.
	family.structures = [
		{
			id: family.upId,
			family,
			spriteFile: `${family.key}Up.png`,
			size: { width: CELL, height: CELL },
			buildModes: [
				{ type: "line", directions: ["vertical", "diagonal"] },
				{ type: "launcherRectUp" },
				{ type: "launcherRectSide" },
			],
			primary: true,
		},
		{ id: family.leftId, family, spriteFile: `${family.key}Left.png`, size: { width: CELL, height: 23 } },
		{ id: family.rightId, family, spriteFile: `${family.key}Right.png`, size: { width: CELL, height: 23 } },
	];
}
const STRUCTURES = FAMILIES.flatMap((family) => family.structures);

function registerLauncherPhysics(family) {
	safe(() =>
		// Deliberately no runTickSharedBufferKey even for the Advanced (Mk2
		// speed) family - patches.json (point 6 above) makes that fall back to
		// the same on/off switch the vanilla Launcher uses, instead of
		// replicating Mk2's dedicated worker-tick machinery. That key only
		// ever affected *cadence* (how often the launcher is allowed to fire),
		// which vanilla Mk2 only needs because it fires twice as often as
		// standard - it's unrelated to exit *velocity*, which is what
		// velocity/softDropVelocity below control and what was actually asked
		// for here. Both families fire on the same "is this cell allowed to
		// launch at all" gate; only how fast the result flies differs.
		api.structureBehaviors.registerLauncherType({
			upType: family.upId,
			leftType: family.leftId,
			rightType: family.rightId,
			velocity: family.velocity,
			softDropVelocity: family.softDropVelocity,
		}),
	);
}

async function registerStructure(def) {
	// Own placeholder art, loaded under a mod-owned graphics key - see point
	// 4 in the big comment above for why a vanilla sprite name can't be
	// reused here. Swap gen_sprites.py's output for real art any time; the
	// key just has to keep matching def.id.
	await safe(() => api.sprites.loadFromMod(def.id, def.spriteFile));

	safe(() =>
		api.structures.register({
			id: def.id,
			name: def.family.name,
			description: def.family.description,
			categoryKey: "logistics",
			// No alwaysUnlocked - see point 8 below. Only the primary (Up) type
			// is ever listed in a tech's unlocks.structures (matching how
			// vanilla's own Conveyors tech only lists LauncherUp, never
			// LauncherLeft/Right); Left/Right become placeable once the family
			// is unlocked via the same generic drag-tool resolution vanilla
			// itself relies on for its own diagonal launcher segments.
			buildModes: def.buildModes,
			variants: def.family.variants,
			// Only the primary (Up) type shows as its own build-menu icon -
			// see point 3 above. Left/Right are still fully registered (so a
			// placed one renders/filters/names itself correctly) and still
			// unlocked (so the drag tool is actually allowed to place them),
			// just hidden from the menu list itself.
			hideFromBuildMenu: !def.primary,
			render: {
				imageName: def.id,
				size: def.size,
				ui: { outline: true },
			},
			// Same marker vanilla Filter/Filter Wall/Critter Fence use - gets
			// the plain "Filter" hover word and (holding the Grabber) a live
			// Allow/Block summary for free. The real filter *editor* - both
			// the pre-placement screen and the on-screen clickable overlay
			// over already-placed segments - is unlocked entirely by the
			// patches in patches.json (see point 5 above), not by this flag.
			// The Advanced family is additionally patched into the game's own
			// "is this Mk2-tier" list, which is what turns on multi-element
			// selection and liquids/gases in the same native screen - same
			// screen either way, just a different capability tier.
			tooltipHover: { type: "filter" },
			defaultData: { filterPassThrough: true },
		}),
	);
}

function defaultFilterFor(advanced) {
	// Mirrors how vanilla builds each tier's own default: plain Filter
	// starts from the player's configured default filter but drops
	// affectsLiquid/affectsGas unless the mod setting below turns them on
	// (vanilla Filter itself defaults to solids-only); Advanced Filter
	// (Filter Mk2) always hardcodes both to true regardless of that setting
	// - it's inherently a liquids/gases-capable tier, matching vanilla.
	const base = safe(() => sandkit.state.store.options.defaultFilter) || {};
	const affectsLiquidsAndGases = advanced || !!safe(() => api.settings.get("affectsLiquidsAndGases"));
	return Object.assign({}, base, {
		affectsLiquid: affectsLiquidsAndGases,
		affectsGas: affectsLiquidsAndGases,
	});
}

// Runs every frame; for any placed segment that hasn't been given a filter
// yet (freshly built this frame or the last one), attaches the default
// filter and pushes it through structures.update() so the game encodes it
// into the tile the same way it would for a vanilla Filter placement, and
// so the native filter screen (see point 5 above) has something sensible to
// show/edit immediately. Also makes sure `data.filterPassThrough` is set -
// see point 12 below for what that field actually does and why it's set
// here (not just in registerStructure's defaultData) so it also reaches
// segments placed by an earlier version of this mod, before this field
// existed, on an existing save. Cheap for every already-configured block -
// just two property reads each.
function ensureFilters() {
	for (const def of STRUCTURES) {
		safe(() =>
			api.structures.forEachOfType(def.id, (structure) => {
				let changed = false;
				if (!structure.filter) {
					structure.filter = defaultFilterFor(def.family.advanced);
					changed = true;
				}
				if (!structure.data || structure.data.filterPassThrough !== true) {
					structure.data = Object.assign({}, structure.data, { filterPassThrough: true });
					changed = true;
				}
				if (changed) safe(() => api.structures.update(structure, { propagateToWorkers: true }));
			}),
		);
	}
}

// =============================== RESEARCH ====================================
//
// See point 8 above: api.tech.registerNode (the function that both defines
// a tech AND places it in the visible grid) refuses a vanilla tech as
// parentId. api.tech.addDefinition has no such check - it just writes the
// definition - but a definition with no grid cell is never enumerated for
// display, so patches.json places one cell per tech (a single array-literal
// edit each, in an already-empty grid slot below its real prerequisite -
// see the patch ids for exactly which slot) while this file supplies the
// data (cost, requires, unlocks) through the real public API.
//
// sandkit.enums.Tech.<Name> is the documented way to reference a vanilla
// tech id by name instead of a hardcoded number (the same pattern used
// by this pack's own README notes on the Resource Signal Readers mod) -
// falls back to the literal numbers (confirmed against the currently
// installed bundle.js) if that enum path is ever unavailable.
const FILTERS_TECH = safe(() => sandkit.enums.Tech.Filters, 63);
const ADVANCED_FILTERS_TECH = safe(() => sandkit.enums.Tech.AdvancedFilters, 64);
const CONVEYORS_MK2_TECH = safe(() => sandkit.enums.Tech.ConveyorsMk2, 30);

function registerTech(family, id, requires, cost) {
	safe(() =>
		api.i18n.register("en", {
			[`tech|${id}|name`]: family.name,
			[`tech|${id}|description`]: family.techDescription,
		}),
	);
	safe(() =>
		api.tech.addDefinition(id, {
			nameKey: `tech|${id}|name`,
			descriptionKey: `tech|${id}|description`,
			cost,
			branch: "logistics",
			requires,
			// Only the primary (Up) type - see the comment in registerStructure
			// above for why Left/Right are deliberately left out here.
			unlocks: { structures: [family.upId] },
		}),
	);
}

const filteredLauncherFamily = FAMILIES.find((family) => !family.advanced);
const advancedFilteredLauncherFamily = FAMILIES.find((family) => family.advanced);
registerTech(filteredLauncherFamily, "shanderFilteredLauncherTech", FILTERS_TECH, 100);
registerTech(advancedFilteredLauncherFamily, "shanderAdvancedFilteredLauncherTech", [ADVANCED_FILTERS_TECH, CONVEYORS_MK2_TECH], 400);

// =============================================================================

for (const family of FAMILIES) registerLauncherPhysics(family);
for (const def of STRUCTURES) await registerStructure(def);
safe(() => api.events.on("frame:update", ensureFilters));
