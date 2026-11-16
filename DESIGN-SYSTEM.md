# CodePatcher Design System

This document defines the unified 5-layer Design System and the strict ownership boundary separating visual styling from operational JavaScript.

## 5-Layer CSS Architecture

| File | Owns | Must not own |
|---|---|---|
| `css/tokens.css` | **Central File #1 (Geometry & Presets)**: Core Obsidian Sapphire palette, `IBM Plex Sans Arabic` + `JetBrains Mono` typography, architectural radius scale, density presets (`[data-density="compact"|"spacious"]`), corner radius presets (`[data-radius="sharp"|"soft"]`), accent presets (`[data-accent="gold"|"indigo"|"cyan"|"emerald"|"amber"|"rose"]`), button/input dimensions, touch targets, motion & z-index tokens | Theme surface palettes, component selectors, or screen layouts |
| `css/themes.css` | **Central File #2 (Themes & Colors)**: Surface, Sheen highlight, border, shadow, syntax highlight, diff, and file-icon tokens across 6 curated themes (`dark`, `royal`, `light`, `ocean`, `paper`, `contrast`) via `[data-theme]` + legacy variable bridge | Structural layout rules or JS logic |
| `css/components.css` | Hairline single-elevation buttons (`.btn`, `.hbtn`, `.pmini`, `.copy-ai`), inputs/textareas, modals/bottom sheets (`.modal`, `.sheet`), shared menu/list rows (`.mi`, `.mi-body`, `.scroll-box`, `.issue`), badges, collapsible `.help-box`, error cards, patch/log cards, context popups, and toasts | Screen-specific grid positioning or breakpoint overrides |
| `css/layouts.css` | App shell, header, IDE chrome tabbar, bottom/top nav, `#p-home` Bento workspace + Recent Files quick switcher, `#p-edit` + find bar + gutter + symbol/bottom bars, `#p-patch` split compose/inspector workspace, `#p-run` + console + FABs, `#p-log`, `#p-v1` timeline, and explorer `.drawer` | Duplicate token definitions or inline runtime logic |
| `css/responsive.css` | Interaction states (`body.sym`, `body.runfs`, `body.side-open`), small-phone (`<=370px`), tablet (`>=680px`), full desktop IDE studio (`>=960px`, 2-column Bento `#p-home` and 2-column Split `#p-patch`), and `prefers-reduced-motion` | Operational business behavior |

## Required Stylesheet Order (`index.html`)

Keep this exact load order:

1. `css/tokens.css`
2. `css/themes.css`
3. `css/components.css`
4. `css/layouts.css`
5. `css/responsive.css`

All 5 CSS files are registered in `sw.js`.

## Central Theme & Customization Mechanism

- **1–2 File Control**: Editing colors or adding a new theme only requires updating `css/themes.css`. Editing spacing, button heights, touch targets, density, radius, or accent colors only requires `css/tokens.css`.
- `18-settings.js` syncs `document.body.dataset.theme` (`dark` | `royal` | `light` | `ocean` | `paper` | `contrast`), `dataset.density` (`compact` | `normal` | `spacious`), `dataset.radius` (`sharp` | `round` | `soft`), and `dataset.accent` (`default` | `gold` | `indigo` | `cyan` | `emerald` | `amber` | `rose`), while keeping `body.light` synced for light/paper modes.
- `<meta name="theme-color">` reads `--surface-app` dynamically from computed styles.
- Every dialog — including Project Management (`openManage`), Save (`saveMenu`, `saveAsDialog`), Export (`exportDialog`, `exportBundleDialog`), Bundle Import (`importBundleText`), Settings, Palette, Snapshots, Self-Test, Ambiguity Picker, and Patch History — uses semantic classes and shared UI template helpers (`uiRow`, `uiScroll`, `uiNote`, `uiEmpty`, `uiSub`) defined in `js/06-ui-core.js`, with zero hardcoded visual `style="..."` leaks.

## JavaScript Boundaries

- Operational modules (`04`–`17`, `19`–`29`) retain full ownership of the patch engine, file CRUD, tabs, import/export, clipboard, versioning, storage, and self-tests.
- `js/06-ui-core.js` provides declarative UI template helpers without altering any operational state or engine behavior.
- `30-home.js` fills the Workspace Command Center (`#p-home`) and Recent Files; the bottom navigation and the `#p-home` container are declared in `index.html`, not built at runtime. `31-outline.js` adds the file outline and scope bar.
- CSS describes appearance and state; JavaScript remains the single authority for application state.

## Files Explorer Toolbar (`js/33-files-toolbar.js`)

- The explorer drawer toolbar has four buttons — **New / Import / Export / GitHub** — each opening an anchored dropdown (`.pop.tb-pop`) in place; no extra modal opens just to choose an action.
- Toolbar and menu icons are monochrome (`currentColor`); the GitHub mark uses `.ic.brand` and follows the text color (white in dark themes, black in light themes). File and folder icons keep their original per-type colors.
- GitHub import (`ghImportDialog` / `ghImportRun` / `ghPull` in `js/32-github.js`) works for public repos without a token and for private repos once linked.
