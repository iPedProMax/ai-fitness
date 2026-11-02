# Khalories AI - Coach UX Follow-ups

## Bug: Floating AURA and full /coach do not share conversation
**Reported:** October 31, 2026
**Status:** Open - not fixed by the animation patch.

**Current:** Starting a chat in floating AURA then pressing **Open Full AI Coach** opens `/coach`, but earlier messages and progress do not carry over.

**Target:** Both mini AURA and `/coach` read/write the same authenticated, user-specific conversation/session. Users can switch surfaces and navigate/refresh without losing the conversation. Keep existing AI model selection, usage limits, safety rules, and other working flows intact.

**Acceptance test:** Start mini chat -> send 2 messages -> Open Full AI Coach -> see both messages and continue -> navigate back -> see full history -> refresh -> same conversation. Verify different users cannot see each other's sessions. Do not silently reset state when opening `/coach`.

## UI: Animate floating AURA launcher
**Status:** Animation CSS available; auto-installer patches the launcher only when it finds a unique, safe match.
**Motion:** Gentle 3.6-second float/glow; subtle icon movement and hover feedback. Respect `prefers-reduced-motion`.