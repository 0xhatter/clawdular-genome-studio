# Clawdular Genome Studio - Frontend Design Specification

## Design Philosophy: NASA Terminal Futurismo

A minimalist, retro-futuristic interface inspired by 1970s-1980s NASA mission control terminals. Clean, functional, and deliberately austere. No gradients, no shadows, no rounded corners. Pure information density with surgical precision.

---

## Color Palette

### Primary Colors
| Token | Value | Usage |
|-------|-------|-------|
| `--bg-primary` | `#000000` | Main background |
| `--bg-secondary` | `#0a0a0a` | Panel backgrounds |
| `--bg-tertiary` | `#111111` | Elevated surfaces |
| `--text-primary` | `#FFFFFF` | Primary text |
| `--text-secondary` | `#888888` | Secondary/muted text |
| `--text-tertiary` | `#444444` | Disabled/inactive text |

### Accent Colors (Monochrome)
| Token | Value | Usage |
|-------|-------|-------|
| `--accent` | `#FFFFFF` | Active states, selections |
| `--accent-dim` | `#666666` | Hover states |
| `--border` | `#333333` | Borders, dividers |
| `--border-light` | `#555555` | Active borders |
| `--grid` | `#1a1a1a` | Background grid |

### Status Colors (Minimal)
| Token | Value | Usage |
|-------|-------|-------|
| `--status-active` | `#FFFFFF` | Running, success |
| `--status-inactive` | `#444444` | Stopped, idle |
| `--status-error` | `#FFFFFF` | Errors (inverted) |

---

## Typography

### Font Stack
```css
--font-mono: 'IBM Plex Mono', 'Courier New', monospace;
--font-sans: 'Inter', 'Helvetica Neue', Arial, sans-serif;
```

### Type Scale
| Element | Size | Weight | Letter-Spacing | Case |
|---------|------|--------|----------------|------|
| H1 | 24px | 400 | 0.2em | UPPERCASE |
| H2 | 18px | 400 | 0.15em | UPPERCASE |
| H3 | 14px | 500 | 0.1em | UPPERCASE |
| Body | 12px | 400 | 0.05em | normal |
| Caption | 10px | 400 | 0.1em | UPPERCASE |
| Code | 11px | 400 | 0 | normal |
| Label | 10px | 500 | 0.15em | UPPERCASE |

### Typography Rules
- ALL HEADERS IN UPPERCASE
- Monospace for data, code, IDs
- Sans-serif for UI labels
- Never italic
- Never bold (use weight 500 for emphasis)

---

## Layout Grid

### Base Grid
- 8px base unit
- 20px gutters
- 40px margins

### Canvas Grid (Patch Bay)
- 20px minor grid lines
- 100px major grid lines
- Grid color: `#1a1a1a`
- Grid style: 1px solid

### Panel Structure
```
┌─────────────────────────────────────────┐
│ HEADER                                  │ 48px
├─────────────────────────────────────────┤
│                                         │
│  CONTENT AREA                           │
│  (flexible)                             │
│                                         │
├─────────────────────────────────────────┤
│ STATUS BAR                              │ 24px
└─────────────────────────────────────────┘
```

---

## Components

### 1. Header
```
┌─────────────────────────────────────────────────────────────┐
│  🧬  CLAWDULAR GENOME STUDIO          [DASH] [PATCH] [GENE] │
└─────────────────────────────────────────────────────────────┘
```
- Height: 48px
- Background: `#000000`
- Border-bottom: 1px solid `#333333`
- Logo: Monospace, 14px, letter-spacing 0.3em
- Nav items: 10px uppercase, separated by `│`
- Active nav: White underline (2px)

### 2. Module Node (Patch Bay)
```
┌─────────────────┐
│ ▓▓ MODULE_NAME  │  Header: 24px height
│ ─────────────── │  Separator: 1px dashed #333
│ ○ INPUT_01      │  Input port: ○ (hollow circle)
│ ○ INPUT_02      │  
│ ─────────────── │
│ ● OUTPUT_01   ◉ │  Output port: ● (filled circle)
│ ─────────────── │  Parameter knob: ◉ (filled with dot)
│ ◉ ◉ ◉           │
└─────────────────┘
```
- Width: 180px
- Background: `#0a0a0a`
- Border: 1px solid `#333333`
- Selected border: 1px solid `#FFFFFF`
- No border-radius (sharp corners)
- Font: 11px monospace

#### Port States
| State | Symbol | Color |
|-------|--------|-------|
| Disconnected input | `○` | `#444444` |
| Connected input | `●` | `#FFFFFF` |
| Disconnected output | `○` | `#444444` |
| Connected output | `●` | `#FFFFFF` |
| Hover | `◎` | `#FFFFFF` |

### 3. Connection Cable
```
    ╱
   ╱
  ╱
 ╱
```
- Style: 1px solid white line
- Active flow: Dashed line animation
- Selected: 2px solid white
- No curves (use 45° angles only)

### 4. Button
```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│  EXECUTE    │    │  EXECUTE    │    │  EXECUTE    │
│  [IDLE]     │    │  [ACTIVE]   │    │  [DISABLED] │
└─────────────┘    └─────────────┘    └─────────────┘
   Normal             Inverted             Muted
```
- Height: 32px
- Padding: 0 16px
- Border: 1px solid `#333333`
- Font: 10px uppercase, letter-spacing 0.2em

#### Button States
| State | Background | Border | Text |
|-------|------------|--------|------|
| Default | `#000000` | `#333333` | `#888888` |
| Hover | `#111111` | `#555555` | `#FFFFFF` |
| Active | `#FFFFFF` | `#FFFFFF` | `#000000` |
| Disabled | `#000000` | `#222222` | `#444444` |

### 5. Panel / Card
```
┌─────────────────────────────────────┐
│ PANEL_TITLE                    [×] │
├─────────────────────────────────────┤
│                                     │
│  Content area                       │
│                                     │
├─────────────────────────────────────┤
│ FOOTER_INFO                    001 │
└─────────────────────────────────────┘
```
- Background: `#0a0a0a`
- Border: 1px solid `#333333`
- Header: 32px height, uppercase, letter-spacing 0.15em
- Close button: `×` in top-right
- Footer: 24px height, right-aligned index number

### 6. Data Table
```
┌──────┬────────────────┬────────┬────────┐
│  ID  │  NAME          │  GEN   │  FIT   │
├──────┼────────────────┼────────┼────────┤
│  001 │  NEURO_FEED    │  012   │  098   │
│  002 │  PATTERN_REC   │  008   │  062   │
│  003 │  CREATIVE_COMP │  003   │  091   │
└──────┴────────────────┴────────┴────────┘
```
- Header: 10px uppercase, border-bottom 1px solid `#333`
- Row height: 32px
- Hover row: Background `#111111`
- Selected row: Border-left 2px solid `#FFFFFF`
- Monospace for numeric columns

### 7. Input Field
```
┌─────────────────────────┐
│ ENTER_VALUE...          │
└─────────────────────────┘
```
- Height: 32px
- Background: `#000000`
- Border: 1px solid `#333333`
- Focus border: 1px solid `#FFFFFF`
- Placeholder: `#444444`, uppercase
- Text: `#FFFFFF`
- Caret: 2px solid white, blinking

### 8. Genome Code Block
```
┌────────────────────────────────────────┐
│ GENOME: G-7A3F9B2C                     │
│ ────────────────────────────────────── │
│ 001  TRIGGER:                          │
│ 002    PATTERN: WEBHOOK                │
│ 003    FILTER: [FROM_DOMAIN]           │
│ 004                                    │
│ 005  ACTION:                           │
│ 006    OPERATION: TRANSFORM            │
│ 007    OUTPUT: JSON                    │
└────────────────────────────────────────┘
```
- Background: `#050505`
- Border: 1px solid `#222222`
- Line numbers: `#333333`, right-aligned
- Code: 11px monospace
- Syntax: All white (no color coding)

### 9. Timeline
```
GEN 001 ─────●───── GEN 002 ─────●───── GEN 003 ─────●───── GEN 004
             │                    │                    │
             MUTATE              BREED               OPTIMIZE
```
- Horizontal line: 1px solid `#333333`
- Node: 8px square, filled `#FFFFFF`
- Current node: 12px square with border
- Label: 9px uppercase below

### 10. Status Bar
```
┌─────────────────────────────────────────────────────────────────┐
│  SYS: ONLINE  │  PATCH: 003  │  GEN: 004  │  MEM: 42%  │  14:32 │
└─────────────────────────────────────────────────────────────────┘
```
- Height: 24px
- Background: `#0a0a0a`
- Border-top: 1px solid `#333333`
- Font: 10px monospace
- Separators: `│`

---

## Iconography

### Icon Set (Monochrome)
All icons are 16×16px, 1px stroke, no fill:

| Name | Symbol | Usage |
|------|--------|-------|
| Play | `▶` | Execute patch |
| Stop | `■` | Stop execution |
| Extract | `⬇` | Extract genome |
| Splice | `✂` | Splice operation |
| Breed | `⚭` | Breed operation |
| Mutate | `⚡` | Mutate operation |
| Clone | `⎘` | Clone operation |
| DNA | `🧬` | Genome indicator |
| Module | `▓` | Module header |
| Connection | `─` | Cable segment |
| Close | `×` | Close panel |
| Expand | `+` | Expand section |
| Collapse | `─` | Collapse section |
| Check | `✓` | Success state |
| Error | `✗` | Error state |
| Warning | `▲` | Warning state |
| Info | `ℹ` | Information |

### Icon Rules
- Always monochrome (white on black)
- Never colored
- Never animated (except status indicators)
- Always 16×16px

---

## Animations

### Allowed Animations
1. **Cursor blink**: 1s infinite
2. **Data flow on cables**: Dashed line moving (200ms)
3. **Typing effect**: Character-by-character reveal

### Animation Specs
```css
/* Cursor blink */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* Data flow */
@keyframes flow {
  0% { stroke-dashoffset: 0; }
  100% { stroke-dashoffset: -20; }
}

/* Typing */
@keyframes typing {
  from { width: 0; }
  to { width: 100%; }
}
```

### No Animations
- No fade transitions
- No scale transforms
- No rotate transforms
- No elastic/bounce easing

---

## Screens

### 1. Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  🧬  CLAWDULAR GENOME STUDIO          DASH │ PATCH │ GENE │ EVO │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 001         │  │ 002         │  │ 003         │             │
│  │ NEURO_FEED  │  │ PATTERN_REC │  │ CREATIVE    │             │
│  │ ─────────── │  │ ─────────── │  │ ─────────── │             │
│  │ GEN: 012    │  │ GEN: 008    │  │ GEN: 003    │             │
│  │ FIT: 098    │  │ FIT: 062    │  │ FIT: 091    │             │
│  │ [▶] [✂]     │  │ [▶] [✂]     │  │ [▶] [✂]     │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │ 004         │  │ 005         │  │ [+]         │             │
│  │ DAILY_BRIEF │  │ AUTO_REPLY  │  │ NEW_PATCH   │             │
│  │ ─────────── │  │ ─────────── │  │             │             │
│  │ GEN: 025    │  │ GEN: 001    │  │             │             │
│  │ FIT: 075    │  │ FIT: 045    │  │             │             │
│  │ [▶] [✂]     │  │ [▶] [✂]     │  │             │             │
│  └─────────────┘  └─────────────┘  └─────────────┘             │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  SYS: ONLINE  │  PATCHES: 005  │  AVG_FIT: 074  │  14:32:07   │
└─────────────────────────────────────────────────────────────────┘
```

### 2. Patch Bay
```
┌─────────────────────────────────────────────────────────────────┐
│  🧬  CLAWDULAR GENOME STUDIO          DASH │ PATCH │ GENE │ EVO │
├─────────────────────────────────────────────────────────────────┤
│  [◀ BACK]  PATCH: NEURO_FEED  GEN: 012  FIT: 098  [▶ EXECUTE]   │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ═══════════════════════════════════════════════════════════   │
│  ║  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ┌─────────┐   ·   ·   ┌─────────┐   ·   ·   ║   │
│  ║  ·   ·   ·   │ ▓ GMAIL │   ·   ·   │ ▓ SLACK │   ·   ·   ║   │
│  ║  ·   ·   ·   │ ─────── │   ·   ·   │ ─────── │   ·   ·   ║   │
│  ║  ·   ·   ·   │ ○ INPUT │   ·   ·   │ ○ INPUT │   ·   ·   ║   │
│  ║  ·   ·   ·   │ ─────── │   ·   ·   │ ─────── │   ·   ·   ║   │
│  ║  ·   ·   ·   │ ● OUT   │╲  ·   ·   │ ● OUT   │   ·   ·   ║   │
│  ║  ·   ·   ·   └─────────┘ ╲  ·   ·   └─────────┘   ·   ·   ║   │
│  ║  ·   ·   ·   ·   ·   ·    ╲  ·   ·   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   ┌─────────╲─────┐   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ▓ SUMMARIZE   │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ───────────── │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ○ INPUT       │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ○ CONTEXT     │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ───────────── │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   │ ● SUMMARY     │   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   └───────────────┘   ·   ·   ·   ·   ·   ║   │
│  ║  ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ·   ║   │
│  ═══════════════════════════════════════════════════════════   │
│                                                                 │
│  MODULES:  [INPUT] [PROCESS] [OUTPUT] [LOGIC] [UTILITY]        │
├─────────────────────────────────────────────────────────────────┤
│  STATUS: IDLE  │  MODULES: 003  │  CONNECTIONS: 002  │  14:32  │
└─────────────────────────────────────────────────────────────────┘
```

### 3. Genome Editor
```
┌─────────────────────────────────────────────────────────────────┐
│  🧬  CLAWDULAR GENOME STUDIO          DASH │ PATCH │ GENE │ EVO │
├─────────────────────────────────────────────────────────────────┤
│  [◀ BACK]  GENOME: G-7A3F9B2C  VER: 2.1.0  GEN: 004            │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────────────────────────┐  │
│  │                 │  │ CHROMOSOME: TRIGGER                  │  │
│  │      🧬         │  │ ──────────────────────────────────── │  │
│  │    ╱    ╲       │  │                                      │  │
│  │   ╱      ╲      │  │  PATTERNS:                           │  │
│  │  ══════════     │  │  ─────────                           │  │
│  │   ╲      ╱      │  │  [○] WEBHOOK  /webhook/gmail         │  │
│  │    ╲    ╱       │  │  [ ] SCHEDULE 0 0 * * *              │  │
│  │      🧬         │  │  [ ] EVENT   on:email_received       │  │
│  │                 │  │                                      │  │
│  │  FITNESS: 087   │  │  FILTERS:                            │  │
│  │  ────────────   │  │  ────────                            │  │
│  │  REL: 092       │  │  [○] FROM_DOMAIN  @company.com       │  │
│  │  EFF: 088       │  │  [ ] SUBJECT_CONTAINS  [URGENT]      │  │
│  │  UTL: 075       │  │                                      │  │
│  │  SAT: 082       │  ├──────────────────────────────────────┤  │
│  │  ADP: 090       │  │  [TRIGGER] [ACTION] [BEHAVIOR] [META]│  │
│  │                 │  └──────────────────────────────────────┘  │
│  │  MUTATIONS: 012 │                                            │
│  │  PARENTS: 002   │  ┌──────────────────────────────────────┐  │
│  │                 │  │ GENETIC OPERATIONS                   │  │
│  └─────────────────┘  │ ──────────────────────────────────── │  │
│                       │                                      │  │
│  TIMELINE:            │  [⬇ EXTRACT]  [✂ SPLICE]  [⚭ BREED] │  │
│  ─────────            │                                      │  │
│  ●───●───●───●        │  [⚡ MUTATE]  [⎘ CLONE]             │  │
│  │   │   │   │        │                                      │  │
│  M   B   O   M        │  MUTATION INTENSITY:                 │  │
│                       │  [CONSERVATIVE] [MODERATE] [CHAOS]   │  │
│  M=MUTATE             │                                      │  │
│  B=BREED              └──────────────────────────────────────┘  │
│  O=OPTIMIZE                                                     │
├─────────────────────────────────────────────────────────────────┤
│  GENOME: G-7A3F9B2C  │  LAST_MOD: 2024-02-14  │  14:32:07      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Responsive Behavior

### Breakpoints
| Breakpoint | Width | Behavior |
|------------|-------|----------|
| Desktop | > 1200px | Full layout |
| Tablet | 768-1200px | Collapse sidebar |
| Mobile | < 768px | Stack panels |

### Mobile Adaptations
- Sidebar becomes bottom sheet
- Patch bay zooms to fit
- Panels stack vertically
- Touch targets: 44px minimum

---

## Accessibility

### Requirements
- All interactive elements keyboard accessible
- Focus states: 2px white outline
- Screen reader labels for all icons
- Reduced motion support
- High contrast mode (already default)

### Focus States
```css
:focus {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}

:focus-visible {
  outline: 2px solid #FFFFFF;
  outline-offset: 2px;
}
```

---

## File Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── ui/              # Primitive components
│   │   │   ├── Button.tsx
│   │   │   ├── Panel.tsx
│   │   │   ├── Input.tsx
│   │   │   └── Table.tsx
│   │   ├── patchbay/        # Patch bay components
│   │   │   ├── Canvas.tsx
│   │   │   ├── Module.tsx
│   │   │   └── Connection.tsx
│   │   ├── genome/          # Genome editor components
│   │   │   ├── Editor.tsx
│   │   │   ├── Helix.tsx
│   │   │   └── Timeline.tsx
│   │   └── layout/          # Layout components
│   │       ├── Header.tsx
│   │       ├── Sidebar.tsx
│   │       └── StatusBar.tsx
│   ├── styles/
│   │   ├── globals.css
│   │   ├── variables.css
│   │   └── components.css
│   ├── hooks/
│   ├── store/
│   └── utils/
├── public/
│   └── fonts/
└── package.json
```

---

## Tech Stack

- **Framework**: React 18 + TypeScript
- **Styling**: Tailwind CSS (custom config)
- **State**: Zustand
- **Canvas**: D3.js (for patch bay)
- **Icons**: Custom SVG (monochrome)
- **Fonts**: IBM Plex Mono, Inter

---

## Design Principles Checklist

- [ ] No gradients
- [ ] No shadows
- [ ] No rounded corners
- [ ] No colors except black, white, and grays
- [ ] All headers in UPPERCASE
- [ ] Monospace for data
- [ ] Sharp, angular aesthetic
- [ ] High information density
- [ ] Functional over decorative
- [ ] NASA terminal aesthetic
