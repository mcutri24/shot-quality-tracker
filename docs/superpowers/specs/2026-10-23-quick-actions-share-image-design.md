# Quick Action Chips & Share as Image — Design Spec

## Overview

Two new features for the AI Assistant in the Shot Quality Tracker PWA:

1. **Context-Aware Quick Action Chips** — Pre-built prompt buttons that change based on game context, displayed below the chat header
2. **Share as Image** — Copy a branded image card of any AI response to the clipboard for pasting into iMessage

---

## Feature 1: Context-Aware Quick Action Chips

### Behavior

- Horizontal scrollable row of tappable pill-shaped chips displayed below the panel header, above the messages area
- Chips change based on the current context (halftime, post-game, season)
- Tapping a chip sends a pre-written prompt as if the user typed it
- Chips persist above the chat even after messages are sent — the coach can tap multiple reports in one session
- The first chip in each context is visually "featured" with a crimson background; others use the default dark chip style
- Chips only appear when the API key is set and the chat view is active

### Context Detection

| Context | Condition |
|---------|-----------|
| **Halftime** | Active live game (`activeGame && !activeGame.result`) AND current quarter >= Q2 |
| **Post-Game** | No active live game, but the most recent completed game exists. Detected by checking `getGamesBySeason()` for the latest game with a `result` set |
| **Season** | Default — no active live game (covers both "no games yet" and "between games") |

Note: Post-Game and Season share the same data context (`_buildSeasonContext`). The difference is which chips are shown. If the most recent game was completed within the current season, show Post-Game chips. The season context data already includes all game history so Post-Game chips can reference the latest game.

### Chip Definitions

#### Halftime (4 chips)

| Chip | Icon | Prompt |
|------|------|--------|
| **Halftime Report** (featured) | ⚡ | "Give me a halftime report with key takeaways — what's working, what's not, and what adjustments should we make in the second half. Lead with the most important thing the team needs to hear." |
| Who's Hot? | 🔥 | "Who's playing well right now? Show me the top performers by points, efficiency, and shot quality grades." |
| Shot Selection | 🎯 | "Break down our shot selection so far — are we taking good shots? Show grade distribution (gold/silver/bronze) and shot type mix. Also break down which plays are producing the best and worst looks." |
| Turnover Check | ⚠️ | "How many turnovers do we have? Who's turning it over and when? Are there patterns — certain quarters, plays, or situations where we're giving it away?" |

#### Post-Game (4 chips)

| Chip | Icon | Prompt |
|------|------|--------|
| **Game Recap** (featured) | 📋 | "Give me a complete game recap with key takeaways — top performers, what worked, what didn't, and what we should focus on in practice this week." |
| Player Breakdown | ⭐ | "Give me a full player-by-player breakdown for this game — points, FG%, shot quality, turnovers, and key moments for each player who saw the floor. Highlight the positives AND the areas to improve for each. At the top, name the Player of the Game and why." |
| Shot Selection | 🎯 | "Break down our shot selection for this game — grade distribution, shot type mix, open vs contested looks. Also break down which plays produced the best and worst shot quality. Were we running the right stuff?" |
| Turnover Check | ⚠️ | "How many turnovers did we have? Who turned it over and when? Break down any patterns — certain quarters, plays, or situations. How many points did turnovers likely cost us?" |

#### Season (4 chips)

| Chip | Icon | Prompt |
|------|------|--------|
| **Season Summary** (featured) | 📊 | "Give me an overall season summary — record, scoring trends, team strengths and weaknesses, and how we've progressed over the course of the season." |
| Player Breakdown | 👥 | "Give me a full player breakdown for the season — rank players by impact, showing points, efficiency, and shot quality. Highlight who our best and worst performers are. Also call out which players have been hot recently or shown the most improvement over the season." |
| Shot Selection & Trends | 🎯 | "Break down our shooting for the season — FG%, 3PT%, FT%, and shot quality grades overall and how they've trended recently. Are we taking better or worse shots as the season goes on? Show the overall numbers and the recent trend (last 3-5 games)." |
| Play Breakdown | 🏀 | "Rank all our plays by effectiveness this season — PPP, frequency, shot quality grades, and conversion rate. Separate set plays from transition and offensive rebounds since those aren't designed plays. For set plays, call out which ones have been working more recently vs earlier in the season. Which plays should we run more and which should we consider cutting?" |

### DOM Structure

A new `<div class="assistant-chips">` container is added between the header and the messages area inside the panel HTML. It contains chip buttons that are dynamically populated based on context.

```
.assistant-panel
  .assistant-header (existing)
  .assistant-chips (NEW — horizontal scroll, flex row)
    button.assistant-chip.featured  "⚡ Halftime Report"
    button.assistant-chip            "🔥 Who's Hot?"
    button.assistant-chip            "🎯 Shot Selection"
    button.assistant-chip            "⚠️ Turnover Check"
  .assistant-messages (existing)
  .assistant-typing (existing)
  .assistant-input-bar (existing)
```

### CSS

- `.assistant-chips` — horizontal flex container with `overflow-x: auto`, no scrollbar visible (`-webkit-scrollbar: none`), padding 8px 12px, gap 8px, border-bottom matching header border
- `.assistant-chip` — pill shape (`border-radius: 16px`), `padding: 6px 14px`, `font-size: 11px`, `white-space: nowrap`, dark background (`var(--bg-card)`), border `1px solid var(--border)`, color `var(--text-secondary)`
- `.assistant-chip.featured` — crimson gradient background (`linear-gradient(135deg, #c41230, #a01028)`), white text, no border

---

## Feature 2: Share as Image

### Behavior

1. A "Share" button appears next to the existing "Copy" button on each AI response
2. Tapping "Share" renders a branded image card from the response content
3. The image is copied to the clipboard via the `ClipboardItem` API
4. A brief "Image Copied!" confirmation appears on the button for 1.5 seconds
5. The coach opens iMessage, long-presses, pastes the image

### Image Card Layout (Hybrid 1 — Light Body)

```
┌──────────────────────────────────┐
│  CRIMSON GRADIENT HEADER         │
│  🏀 Newark Academy    vs Opp    │
│     Minutemen Bball   Oct 22     │
│         ───────────              │
│           54 - 48                │
│             WIN                  │
├──────────────────────────────────┤
│  WHITE BODY                      │
│  ┌────┐ ┌────┐ ┌────┐          │
│  │FG% │ │3PT%│ │TO's│  stat    │
│  │ 52%│ │ 38%│ │  8 │  boxes   │
│  └────┘ └────┘ └────┘          │
│                                  │
│  ┌─ ⭐ Player of the Game ─────┐│
│  │ #11 Tyler Davis              ││
│  │ 18pts · 7/11 FG · 3 gold    ││
│  └──────────────────────────────┘│
│                                  │
│  Key Takeaways:                  │
│  • Shot selection excellent      │
│  • Turnovers down to 8           │
│  • Need to improve FT%          │
├──────────────────────────────────┤
│  Shot Quality Tracker    AI Gen  │
└──────────────────────────────────┘
```

### Stat Extraction

The image card needs structured data (score, key stats, POTG) that the AI response contains as prose. Two approaches considered:

**Chosen approach: Parse from AI text.** Use regex/heuristics to extract:
- Score: look for patterns like "54-48", "Win/Loss"
- Stats: FG%, 3PT%, turnovers from the response text
- POTG: first bolded player name or the player mentioned after "Player of the Game"

If parsing fails to find structured data (e.g., a freeform season summary), the image card falls back to a simpler layout: crimson header (without score), white body with just the text content formatted as bullet points.

### Fallback Layout (Non-Game Responses)

For responses that don't have a clear single-game context (season summaries, player breakdowns, etc.):

```
┌──────────────────────────────────┐
│  CRIMSON GRADIENT HEADER         │
│  🏀 Newark Academy              │
│     Minutemen Basketball         │
│     [chip label, e.g.           │
│      "Season Summary"]           │
├──────────────────────────────────┤
│  WHITE BODY                      │
│                                  │
│  [Full AI response text,         │
│   formatted with bold headers    │
│   and bullet points]             │
│                                  │
├──────────────────────────────────┤
│  Shot Quality Tracker    AI Gen  │
└──────────────────────────────────┘
```

### Technical Implementation

- **html2canvas** library (~40KB) converts a hidden DOM element to a canvas, then to a PNG blob
- Vendor html2canvas alongside Chart.js in `vendor/`
- Register in service worker cache
- Load lazily — only when the Share button is first tapped
- Use `ClipboardItem` API to copy the PNG blob to clipboard (`navigator.clipboard.write([new ClipboardItem({'image/png': blob})])`)
- Fallback for unsupported browsers: trigger a download of the PNG file via a temporary `<a>` tag
- The hidden DOM element uses inline styles (not CSS classes) to ensure html2canvas captures the design correctly regardless of the page's stylesheet

### Button Placement

The "Share" button sits next to the existing "Copy" button at the bottom of each AI response message:

```
[Copy] [Share]
```

Both buttons use the same `.assistant-copy-btn` base styling. The Share button gets an additional class `.assistant-share-btn`.

---

## Files to Modify

| File | Changes |
|------|---------|
| `js/assistant.js` | Add chip DOM creation, context detection, chip tap handler, share button rendering, image generation logic |
| `css/assistant.css` | Add `.assistant-chips`, `.assistant-chip`, `.assistant-chip.featured`, `.assistant-share-btn` styles |
| `vendor/html2canvas.min.js` | New file — vendored library |
| `sw.js` | Add html2canvas to cache, bump version |
| `index.html` | Add html2canvas script tag (defer) |

## Out of Scope

- Charts in the shared image (text-only for v1; charts are complex to render in a hidden element)
- Customizable team logo upload
- Share directly to a specific contact
