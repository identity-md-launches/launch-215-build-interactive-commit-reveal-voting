# Ballot lab design

## Overview

An educational voting workbench for people learning commit–reveal rules. The implemented design uses warm gray-green surfaces, dark forest text, a locally bundled sans-serif, restrained mint emphasis and flat panels. The page moves from the manual clock to the vote form and tally, then scenarios, evidence and explanation.

`src/styles.css` owns the visual system. `src/App.tsx` owns the page’s component patterns; these are local JSX patterns, not an exported component library. `src/Icon.tsx` exports `Icon({name, size})`. The illustrated ballot mark and icons are local vector assets; there are no stock photos or external font requests.

## Colors

The hex primitive ramp and semantic aliases are declared at `src/styles.css:2`. Components use semantic aliases except the two small voter-avatar palettes.

| Role token | Value | Use |
| --- | --- | --- |
| `--page` | `#f5f7f5` | Canvas, soft wells |
| `--surface` | `#ffffff` | Panels and form controls |
| `--surface-subtle` | `#edf1ee` | Tracks, small counters, disclaimer |
| `--text` | `#1c3028` | Main labels, headings and copy |
| `--text-muted` | `#5d6e65` | Secondary explanations and metadata |
| `--border` | `#dce3de` | Structural separators, panel edges |
| `--control-border` | `#819087` | Input/button boundaries and unselected radio indicators |
| `--accent` | `#173f35` | Primary action and selected-control outlines |
| `--accent-hover` | `#245a43` | Primary-button hover |
| `--accent-soft` | `#dff2e7` | Current phase and scenario strip |
| `--accent-pale` | `#eff8f2` | Selected options and replay events |
| `--accent-light` | `#bdebd5` | Soft accent edges and selection |
| `--on-accent` | `#ffffff` | Text/icons on the primary action |
| `--success`, `--success-bg` | `#245a43`, `#eff8f2` | Accepted events, revealed state and final result |
| `--error`, `--error-bg` | `#a13722`, `#fff3ee` | Rejected events and invalid-salt feedback |
| `--info`, `--info-bg` | `#315f7b`, `#eaf2f8` | Replay/reset notices |
| `--focus` | `#315f7b` | Keyboard outline |

Bob’s avatar uses `#695637` on `#eee9df`; Charlie’s uses `#625279` on `#ece8f2`. Their letters/names also distinguish them. Green is intentionally shared by selection and success, with explicit text, radio indicators, underlines or check icons distinguishing those states. Red always denotes rejection. There is no dark theme.

Actual rendered measurements are recorded in `artifacts/contrast.json`: primary text 11.67:1, muted intro 5.02:1, active phase 10.00:1, rejection text 6.26:1, input boundary 3.35:1 and focus against white 6.88:1. These are identified pairs, not an assertion that every pixel combination was measured.

## Typography

Inter variable normal, weights 100–900, is loaded from `public/fonts/inter-latin-wght-normal.woff2` with `font-display: swap`. The source asset comes from `@fontsource-variable/inter` 5.2.6; `public/fonts/OFL.txt` preserves its license. Browser loading was verified. Fallbacks are `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, sans-serif. UI weights actually used are 400, 500, 550, 600, 650 and 700. Synthetic fonts are disabled; there is no italic UI text.

| Role | Implemented size / treatment |
| --- | --- |
| Hero | `clamp(2rem, 3.4vw, 2.875rem)`, weight 600, line height 1.15, tracking −.055em; 2.125rem at mobile |
| Section/panel | `--type-section: 1.25rem`, weight 600, line height 1.3, tracking −.035em; mobile panels 1.125rem |
| Explanation heading | 26px desktop, 23px mobile; subordinate explanation headings .875rem |
| UI / form labels | `--type-ui: .875rem`; mobile labels .8125rem |
| Compact text | `--type-caption: .8125rem`, `--type-small: .75rem`; minimum implemented caption size 12px at default root size |
| Body reference | `--type-body: 1rem`; dense UI descriptions mostly 12–14px, line height 1.5–1.7 |
| Inputs / selects | Desktop 12–14px by role; all editable fields and selects at least 1rem on mobile |
| Clock / tally | 24px clock (21px mobile), 43px count, 24px denominator; tabular numbers |
| Hashes and salts | SFMono-Regular, Consolas, Liberation Mono/monospace; hashes wrap anywhere |

Headings balance; descriptions use `text-wrap: pretty`. The explanation intro is capped at 65ch. Counts stay on one line. Hashes are fully available through a native disclosure, with no abbreviated-only values. No justified text or disabled text selection.

## Layout

`.page` and `.header-inner` share a 1248px maximum border-box width, centered, with 32px desktop padding. The desktop `.workspace-grid` is `minmax(0,1.65fr) minmax(0,1fr)` with a 24px gap. The form comes before tally/status in DOM and visual order. Clock phases and ballot/voter choices use `repeat(auto-fit, minmax(min(100%, 5rem), 1fr))`: three columns at the checked ordinary sizes, collapsing as enlarged text increases the minimum. Panels use 24px padding, reducing to 20px and then 16px inline on mobile.

Spacing variables document the base vocabulary: 4, 8, 12, 16, 24, 32 and 48px (`--space-1/2/3/4/6/8/12`). Current rules generally use the literal corresponding values, with 7–10px compact choice gaps, 20px secondary-panel gaps and component-specific adjustments. Reuse the existing patterns rather than assuming every spacing declaration is tokenized.

| Breakpoint | Change |
| --- | --- |
| 68rem / 1088px | Compress panel padding, hide small decorative indicators, wrap scenario strip |
| 53rem / 848px | Main workspace stacks; tally/status share two columns; clock action moves below phases; page inset 24px |
| 38rem / 608px | Tally/status stack; page inset 16px; header navigation becomes a second row with 12px top padding; intro note moves below copy; primary action and scenario controls span their containers; event rows use a compact grid |
| 22rem / 352px | Voter chips stack letter/name; secondary tally icon hides; event controls stack; nonessential clock text hides |

The clock is never sticky, so it cannot obscure focused fields. Controls have normal-flow spacing. Inline direction uses logical properties except intentional physical/icon geometry and native summary metadata floats. Text containers grow; hash strings wrap. Native select menus expose complete option labels even if their selected-value display is constrained at a narrow width.

Desktop 1440px, mobile 390px, narrow 320px and intermediate 820px were browser-inspected. No horizontal page overflow was detected. A 200% root-font enlargement also reflowed; native browser zoom and localized/RTL layout remain unverified.

## Elevation & Depth

The interface is flat: no shadows, modal overlays or floating tooltips. White panels sit on the gray-green canvas with 1px structural borders. Mint distinguishes current phases and selected choices. The blue replay banner stays in normal flow. Only the keyboard skip link uses stacking (`z-index: 10`).

## Shapes

`--radius-panel: 14px` for outer cards; `--radius-control: 7px` for controls and input wells. Status tags/counters use 4–6px radii; the disclaimer uses 8px, empty-state icon 12px. Avatar and phase-number circles are fully rounded. Borders communicate structure or selection; selected radios have a 4px solid center treatment.

## Components

| Pattern / source | Behavior and reuse |
| --- | --- |
| `.button`, `src/styles.css:79` | Native button, 42px baseline; `.button-primary` 46px, `.button-small` 38px, `.button-quiet` neutral reset. One filled primary voting action. Disabled controls retain a text explanation nearby. |
| Clock, `src/App.tsx:95` | Ordered phase list with `aria-current="step"`; +1 and boundary-advance buttons. Integer tick is authoritative. No timer animation. |
| Vote form, `src/App.tsx:117` | Labeled fieldsets/native radio groups. Arrow keys switch options/voters; Tab moves between groups. Action toggle is a named group of `aria-pressed` buttons. |
| Salt and hashes, `src/App.tsx:121` | Real label; inline error linked with `aria-describedby` and `aria-invalid`, focus on empty submission; restore action; native `<details>` for full hashes. |
| Feedback, `src/App.tsx:128` | Persistent polite live region with accepted/rejected text, icon, explanation and state delta. No disappearing toasts. |
| Tally/status, `src/App.tsx:133` | Numeric labels carry chart values; decorative bars are hidden from assistive technology. Provisional/final/no-vote/tie states are explicit. |
| Event log, `src/App.tsx:145` | Event buttons reconstruct historical voting state; filter-empty and initial-empty states offer recovery; previous/next controls and return-to-live. Voting controls pause during replay. |
| Reset/scenarios, `src/App.tsx:49` | Replace session state, preserve one undo snapshot until the next action. Samples are deterministic. |
| `Icon`, `src/Icon.tsx` | `name` selects a local path; optional `size` defaults to 18. One 1.7px round stroke using `currentColor`; all icons are decorative and hidden from assistive technology. |

Focus uses a 3px blue outline with 3px offset; event rows use an inset outline to avoid clipping. Labeled radio containers receive the visible outline for their visually hidden native inputs. The skip link is clipped until focused, so hiding does not depend on its enlarged height. Forced colors use system `Highlight`. Primary mobile targets were measured at least 44×44px; compact secondary targets have smaller, spaced hit areas.

Only 120ms background/border-color transitions are used, behind `prefers-reduced-motion: no-preference`. Hover rules require hover capability. Reduced motion was checked. There are no animated entrances, loading spinners, asynchronous submissions, dialogs or autoplay.

## Do’s and Don’ts

- Start another section inside `.page`, using `.panel`, `.panel-heading` and the existing heading scale. Keep source reading order meaningful when grids stack.
- Use semantic color tokens for state; pair color with text and an icon/shape. Reserve the filled action for the main voting operation.
- Keep native buttons, labels, radio inputs, selects and disclosures. Preserve visible focus and error recovery.
- Display full hashes in a wrapping disclosure. Never hide critical values only in a tooltip or color bar.
- Keep explicit mock-data and session-lifetime language. Do not add wallet or transaction behavior to this learning tool.
- Bundle assets locally, rebuild `dist/`, and recheck the changed states at 390px and desktop. Do not introduce unused themes or unrelated component libraries.

Applied references: Jakub Krehel’s Better Interface (MIT), pinned `267330e1adfc66a718fb65fa6918c1f06d0a689e`; documentation method from Paul Bakaus’s Impeccable (Apache-2.0), pinned `9d715cc4f5564a990ca8345abfdd5df6dc9b41c8`. Review evidence and limitations are in `artifacts/validation.md`.
