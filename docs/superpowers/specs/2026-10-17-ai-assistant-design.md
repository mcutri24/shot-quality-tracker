# AI Assistant — Design Spec

**Date:** 2026-10-17
**Status:** Draft

---

## Overview

Add a conversational AI assistant to the Shot Quality Tracker PWA. The assistant is accessible from every screen via a floating action button (FAB), opens as a slide-up chat panel, and has full read access to all game and season data in localStorage. It calls the Anthropic Claude API (Haiku model) with the user's own API key, streams responses in real-time, and can render charts inline via Chart.js.

## Goals

1. Enable quick tactical reads during live games ("Who's hot?", "Best play this quarter?")
2. Enable deeper analysis at halftime and postgame ("Compare first half to last game", "Generate a halftime report")
3. Enable full season-level analytics with charts ("PPP trend over last 8 games", "Player efficiency comparison", "Shot quality distribution")
4. Never degrade tracking performance or offline capability

## Non-Goals

- Replacing the existing 6-tab dashboard (assistant lives alongside it)
- Persisting conversation history across sessions
- Cloud sync or multi-device conversations
- Auto-generated insights without user prompting

---

## Architecture

### Isolation Principle

The assistant is a fully isolated module. It shares no state with tracking code except read access to localStorage. If the assistant JS fails to load (offline, bad cache), the rest of the app works exactly as it does today. Zero coupling.

### New Files

| File | Responsibility |
|------|---------------|
| `js/assistant.js` | Chat panel UI, message rendering, FAB button, settings view, chart rendering |
| `js/assistant-api.js` | Anthropic API client — builds messages, handles streaming, error mapping |
| `js/assistant-context.js` | Data serialization — reads localStorage, builds context payloads for the LLM |
| `lib/chart.min.js` | Chart.js library (v4.x, ~65KB minified+gzipped) |

### localStorage Keys (New)

| Key | Type | Contents |
|-----|------|----------|
| `sqt_api_key` | string | User's Anthropic API key (plain text, stored locally on device only) |

No other new localStorage keys. Conversations are not persisted.

---

## UI Design

### FAB Button (Closed State)

- 52×52px crimson (#c41230) circle with 🏀 basketball emoji
- Positioned fixed, bottom-right corner (16px inset)
- Present on every screen (home, tracking, dashboard, history, roster, plays, seasons)
- Box shadow: `0 4px 12px rgba(196,18,48,0.4)`
- Z-index above all app content but below modals

### Chat Panel (Open State)

- Slides up from bottom, covering ~70% of screen height
- Background: #141420 with rounded top corners (16px border-radius)
- Shadow: `0 -4px 20px rgba(0,0,0,0.5)`
- Content behind panel dims to 30% opacity

**Panel Header:**
- Left: 🏀 icon + "Game Assistant" label
- Right: Context badge (opponent + quarter during live game, or "Season" on other screens) + ⚙️ gear icon + ✕ close button
- Gear icon only visible when API key is set

**Message Area:**
- Scrollable message list
- User messages: crimson (#c41230) background, right-aligned, rounded corners (12px with 2px bottom-right)
- Assistant messages: dark blue (#1e1e32) background, left-aligned, rounded corners (12px with 2px bottom-left)
- Max width: 75% for user, 85% for assistant
- Streaming: tokens appear incrementally as they arrive

**Input Bar:**
- Fixed at panel bottom, above safe area
- Rounded text input with placeholder "Ask about the game..." (or "Ask about the season..." on non-game screens)
- Crimson send button (36px circle with ↑ arrow)

### Charts (Inline + Expandable)

- Claude returns chart specifications as structured JSON blocks within responses
- App parses these and renders Chart.js canvas elements inline in the message
- Charts render at panel width with appropriate aspect ratios
- "Tap chart to expand ↗" link below each chart
- Tapping opens a full-screen overlay with the chart rendered at device width
- Overlay dismisses on tap outside or ✕ button

**Supported chart types:**
- Bar charts (vertical) — play PPP comparison, player stats
- Line charts — PPP trends over games, quarter-by-quarter progression
- Donut/pie charts — shot quality distribution, shot type breakdown
- Horizontal bar charts — shot type effectiveness

### Settings View (Inside Panel)

Accessed via ⚙️ gear icon in panel header. Slides in within the same panel (not a new screen).

**Contents:**
- API key input (password field with toggle visibility button)
- Verification status indicator (✓ connected / ✗ invalid)
- Step-by-step instructions for obtaining a key (console.anthropic.com)
- Privacy note: "Your key is stored locally on this device only"
- Model display (Haiku)
- "Remove API Key" button (destructive, with confirmation)

### First-Time Experience

When user taps FAB with no API key set:
1. Panel opens showing "API Key Required" screen
2. 🔑 icon, explanation text, "Set Up API Key" button
3. Inline quick-setup instructions (3 steps)
4. Tapping "Set Up API Key" slides to settings view
5. After key is verified, panel transitions to chat view

---

## Data Context Strategy

### Live Game Context

When assistant is opened during a live game (active `sqt_active_game`):

```
System prompt (basketball analytics persona)
+ Current game object from sqt_live_game (all possessions, timeouts, fouls)
+ Active roster from sqt_roster_<seasonId>
+ Plays list from sqt_plays_<seasonId>
+ User's question
```

Typical payload: 3-5KB for a mid-game state (~30-60 possessions).

### Season Context

When assistant is opened from home, dashboard, or history screens:

```
System prompt (basketball analytics persona)
+ All games from sqt_games for active season (summary stats pre-computed)
+ Full possession data for referenced games (loaded on demand if query is game-specific)
+ Active roster
+ Plays list
+ User's question
```

For large seasons (30+ games), send pre-computed summaries first. If Claude needs raw possession data for a specific game, it can indicate this and the app sends a follow-up with the full game data.

### System Prompt

The system prompt instructs Claude to:
- Act as a basketball analytics assistant for a coaching staff
- Understand the data model (PPP, shot types, grades, plays, quarters)
- Respond concisely for quick tactical reads
- Provide deeper analysis when the question warrants it
- Return chart specifications as JSON code blocks with a specific schema when visualizations would help
- Use the team's terminology (gold/silver/bronze for shot quality grades)

---

## API Integration

### Client Configuration

- **Model:** claude-3-5-haiku-latest
- **Max tokens:** 4096 (sufficient for all response types including chart JSON)
- **Streaming:** Enabled (SSE via fetch ReadableStream)
- **API endpoint:** https://api.anthropic.com/v1/messages
- **Auth:** User-provided API key sent as `x-api-key` header

### Request Flow

1. User submits question
2. `assistant-context.js` reads relevant data from localStorage
3. `assistant-api.js` builds the messages array (system + context + user message)
4. Fetch call to Anthropic API with streaming enabled
5. Tokens streamed into the chat panel as they arrive
6. On stream complete, scan response for chart JSON blocks
7. If charts found, parse and render with Chart.js

### Error Handling

All errors are contained within the chat panel. They never affect the tracking screen or any other app functionality.

| Error | Detection | User Sees |
|-------|-----------|-----------|
| No API key | Check `sqt_api_key` on panel open | "API Key Required" setup screen |
| No internet | `fetch` rejects or `navigator.onLine === false` | "No Connection" message + "Retry" button + reassurance tracking works |
| Invalid/expired key | 401 response from API | "Key Not Working" message + "Update Key" button |
| Rate limited | 429 response from API | "Slow Down" message + auto-retry countdown |
| Server error | 500/503 response | "Something went wrong" + "Retry" button |
| Timeout | No response within 15 seconds | "Request timed out" + "Retry" button |

### CORS Consideration

The Anthropic API supports direct browser requests with the `x-api-key` header and `anthropic-dangerous-direct-browser-access: true` header. This allows the PWA to call the API directly without a proxy backend.

---

## Chart Rendering

### Chart Specification Schema

Claude returns chart data as a JSON code block tagged with `chart`:

```json
{
  "type": "bar",
  "title": "PPP by Play",
  "labels": ["Horns Flare", "Motion", "Pick & Roll", "Iso"],
  "datasets": [{
    "label": "PPP",
    "data": [1.42, 1.21, 1.05, 0.78],
    "colors": ["#4CAF50", "#4CAF50", "#ffeb3b", "#f44336"]
  }]
}
```

### Rendering Pipeline

1. After response stream completes, regex scan for ```chart JSON blocks
2. Parse JSON and validate against expected schema
3. Create a `<canvas>` element inline in the message
4. Initialize Chart.js with the parsed config (dark theme defaults)
5. Add "Tap to expand ↗" link below canvas
6. On tap: clone chart config into a full-screen overlay canvas

### Chart Theme Defaults

- Background: transparent (inherits message bubble)
- Grid lines: #2a2a3e
- Text/labels: #888
- Font: system-ui, 11px
- Animation: enabled for initial render, disabled for expand

---

## Chart.js Loading Strategy

Chart.js is included in the service worker precache list (`sw.js`). It downloads once on the first cache update after deployment, then serves from cache on all subsequent loads. No runtime performance impact.

- Added to SW precache: `lib/chart.min.js`
- Cache version bump: `sqt-v42` → `sqt-v43`
- Load strategy: `<script src="lib/chart.min.js" defer></script>` in index.html
- The `defer` attribute ensures it never blocks initial page render or tracking code

---

## Performance Guarantees

1. **Assistant JS loads with `defer`** — never blocks DOM parsing or tracking initialization
2. **Chart.js loads with `defer`** — same, and cached by service worker after first load
3. **API calls are async** — fetch + streaming on a separate promise chain, cannot block the main thread
4. **Data serialization happens on panel open** — not on every user interaction
5. **No shared mutable state** — assistant reads localStorage (same as dashboard does), never writes to game data
6. **Graceful degradation** — if assistant JS fails to load (offline first visit), no FAB appears, app works as before
7. **Panel DOM is minimal** — a few dozen elements at most, no virtual scrolling needed

---

## Scope Summary

### In Scope
- Floating 🏀 FAB button on all screens
- Slide-up chat panel with streaming responses
- Live game tactical queries
- Season-wide analytical queries
- Inline Chart.js visualizations with tap-to-expand
- Settings view inside panel (API key management)
- First-time setup flow
- Error handling for all API failure modes
- Service worker cache update for new assets

### Out of Scope
- Conversation persistence
- Dashboard replacement or inline AI insights
- Backend proxy or serverless functions
- Cloud sync
- Push notifications
- Voice input
- Pre-built prompt templates or suggested questions
