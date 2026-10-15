# Aquarium display modes

The Aquarium header has **Fullscreen Aquarium**, **Aquarium Background**, and the existing Customize aquarium action. The layers button in the global top bar opens the same display actions from every game page. All labels and tooltips support Thai, English, Simplified Chinese, Japanese and Korean.

Fullscreen requests the browser Fullscreen API directly from a click. Unsupported or rejected requests use a fixed in-page view. Escape or **Exit Fullscreen** exits; browser-initiated fullscreen exit also restores the normal view. Navigation, cards, dialogs and notifications are hidden/inert during immersion. The floating toolbar fades after three seconds without interaction, reappears on pointer/touch/keyboard input, and stays visible while a toolbar control has focus. Keyboard focus remains in the immersive controls and returns to the entry control on exit. Language and sound controls remain available inside fullscreen.

Aquarium Background places the player's actual tank behind the application, with translucent navy panels. Its canvas does not receive pointer events. Navigation and game actions continue normally. Turn it off from the header or global display menu. Fullscreen temporarily covers background mode; exiting restores the selected background preference.

Both preferences are stored locally under `dreamDisplay`. Refresh restores a selected fullscreen view using the in-page fallback because browsers require a fresh user gesture for native fullscreen. Preferences belong to the browser; they contain no player assets, credentials or authoritative game state.

## Rendering and game state

`AquariumStage.jsx` wraps the existing `Aquarium.jsx` renderer. The single player canvas stays mounted across navigation and customization; no second tank state or animation loop is created. Fish still come from the same server/cached state and retain their original DNA rendering, proportions, swimming state, theme and decorations. Canvas dimensions follow the viewport without stretching fish.

Background rendering caps drawing at 24 fps, particle count at 12 and device pixel ratio at 1.25. Existing low-quality mode caps drawing at 30 fps and uses the same particle/DPR limits. Hidden tabs and zero-size inline tanks stop scheduling frames. Reduced motion draws a still tank (without particles), redrawing on state, theme, decoration or size changes. Rendering resumes when appropriate; this never pauses server heartbeat, gameplay timers or authoritative progression.

The existing audio singleton and user preferences continue unchanged. No autoplay is introduced by entering a display mode or restoring one. Cached offline and maintenance aquariums can use both display modes while retaining their original restrictions on transactions and online rewards. No backend, economy, genetics, ownership, breeding, database migration or environment-variable change is needed for this feature.

## Validation and limits

See [FEATURE_VALIDATION.md](FEATURE_VALIDATION.md) for actual command results. Automated browser coverage includes native fullscreen and native external exit; absent/rejected API fallback; Escape/button exit; focus restoration/trapping; idle toolbar; refresh persistence; 1440/768/390 pixel fullscreen sizing; global toggle and navigation; same canvas identity across pages/customization; reduced motion; cached offline/reconnect; maintenance view; continued live AudioContext and a successful server heartbeat while immersive; and five-language labels.

Chromium on Linux is tested. Physical mobile/tablet hardware, Safari fullscreen quirks and long-duration CPU/battery measurements remain unverified. Frame/DPR limits are implementation limits, not a measured power-consumption claim. No production deploy or real Neon connection is part of these feature tests.
