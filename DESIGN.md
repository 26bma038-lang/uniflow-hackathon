---
name: UniFlow
description: A warm, editorial campus companion for discovering what matters next.
colors:
  lavender-wash: "#efe3fa"
  lavender-surface: "#f7effc"
  lavender-soft: "#eee3f9"
  lavender-border: "#d7c4e6"
  lavender-signal: "#7c429c"
  blush-highlight: "#f4a9ca"
  blush-surface: "#fcecf3"
  blush-border: "#dd91b3"
  ink: "#17131d"
  ink-soft: "#30213d"
  body-muted: "#57505e"
  label-muted: "#74677d"
  border-subtle: "#eee9f1"
  surface-white: "#ffffff"
  surface-soft: "#faf8fc"
typography:
  display:
    fontFamily: "\"Bricolage Grotesque\", Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(48px, 5.4vw, 80px)"
    fontWeight: 800
    lineHeight: 0.98
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "\"Bricolage Grotesque\", Inter, ui-sans-serif, system-ui, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-0.02em"
  body:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: 1.7
  label:
    fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    fontSize: "12px"
    fontWeight: 650
    lineHeight: 1.4
    letterSpacing: "0.09em"
    fontFeature: "normal"
rounded:
  sm: "3px"
  md: "8px"
  lg: "20px"
  pill: "999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "16px"
  lg: "24px"
  xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface-white}"
    rounded: "{rounded.pill}"
    padding: "0 23px"
    height: "48px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0"
    padding: "0"
    height: "48px"
  inbox-card:
    backgroundColor: "{colors.surface-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0"
  filter-selected:
    backgroundColor: "{colors.lavender-soft}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.md}"
    padding: "0 15px"
    height: "40px"
---

# Design System: UniFlow

## Overview

**Creative North Star: "The Campus Noticeboard"**

UniFlow's visual system is a modern campus noticeboard with the warmth of a student community and the polish of a premium digital product. It combines an editorial publication's hierarchy and confidence with the directness of a focused productivity application.

The system is warm, editorial, and trustworthy. Lavender establishes the welcoming campus atmosphere, blush adds occasional human energy, and near-black typography keeps the experience grounded and legible. Generous whitespace, fine borders, structured cards, and restrained motion keep essential information easy to scan.

The interface should feel youthful without being childish, premium without being intimidating, and expressive without sacrificing usability.

**Key Characteristics:**
- Warm lavender canvas with white information surfaces.
- Strong editorial display typography with compact labels.
- Quietly confident controls and source-aware information hierarchy.
- Layered depth through tonal shifts, fine borders, and restrained ambient shadows.

## Colors

The palette is a soft lavender editorial field anchored by near-black ink, with blush used as a selective highlight for human and event-oriented moments.

### Primary
- **Lavender Signal** (#7c429c): Focus rings, selected accents, and source/category emphasis.
- **Lavender Wash** (#efe3fa): Primary landing-page and hero canvas.
- **Lavender Surface** (#f7effc): Scrolled header and lighter supporting surfaces.

### Secondary
- **Blush Highlight** (#f4a9ca): The headline marker and expressive emphasis.
- **Blush Surface** (#fcecf3): Event-specific date tiles and semantic event treatment.
- **Blush Border** (#dd91b3): Event-specific edge emphasis.

### Neutral
- **Ink** (#17131d): Primary headings, primary button background, and high-emphasis text.
- **Deep Ink** (#30213d): Secondary headings, date numerals, and selected filter text.
- **Body Muted** (#57505e): Supporting paragraph copy.
- **Label Muted** (#74677d): Kicker labels, metadata, dates, and tertiary copy.
- **Subtle Border** (#eee9f1): Dividers inside cards and list items.
- **White Surface** (#ffffff): Cards, logo mark, and readable content surfaces.
- **Soft Surface** (#faf8fc): Card footers and low-emphasis supporting regions.

### Named Rules
**The Signal-Not-Saturation Rule.** Lavender and blush should guide attention, not flood the interface. Use accent color for selected state, category meaning, or a single expressive marker; keep the majority of information surfaces neutral.

## Typography

**Display Font:** Bricolage Grotesque, weights 600 to 800, loaded from Google Fonts in `src/index.css` (falls back to the body stack). Used for headings on the landing and access pages; the student app and club workspace still use the body stack for headings until they are polished.
**Body Font:** Inter (with ui-sans-serif, system-ui, and Segoe UI fallbacks)
**Label/Mono Font:** No distinct label or mono family; labels remain in the primary sans-serif.

**Character:** Headings use Bricolage Grotesque, a grotesque with some warmth and irregularity that suits a campus noticeboard better than a neutral UI face. It is set at 700 to 800 with light negative tracking (-0.02em to -0.025em) and line height near 1; earlier tracking of -0.06em and tighter made letters collide. Body copy stays in the Inter stack for approachable scanning. Inter itself is named in the stack but is not loaded as a web font, so body text renders in the visitor's system sans-serif unless Inter is installed.

### Hierarchy
- **Display** (Bricolage Grotesque 800, `clamp(48px, 5.4vw, 80px)`, 0.98, `-0.025em`): Hero statements and primary landing-page message.
- **Headline** (Bricolage Grotesque 700, 29px and up, 1.04, `-0.02em`): Section headings, preview-card titles, and access-page titles.
- **Title** (750, 23px, 1.2, `-0.03em`): Detail-view item titles.
- **Body** (400, 15–17px, 1.55–1.7): Explanatory copy and descriptions; keep paragraphs comfortably narrow.
- **Label** (650, 12–13px, 1.4, slight tracking): Kicker labels, categories, metadata, filters, and supporting status information.

### Named Rules
**The Two Voices Rule.** One display face for headings and one body stack for everything else. Create contrast through scale, weight, and whitespace; do not add a third family or decorative type treatments.

## Layout

The landing page uses a centered two-column hero grid with a maximum width of 1280px, a 64px desktop gap, and balanced copy/preview proportions. The hero canvas uses 32px horizontal padding on larger screens and a 76px top / 72px bottom vertical rhythm.

The interactive preview is a contained white card with a fixed-height list region, while supporting photos sit outside the card as lightly rotated paper artifacts. The card itself remains the information anchor; decorative images must never compete with the inbox content.

At widths below 1024px, the grid gap and card padding tighten. Below 800px, the hero collapses to one column with the copy above the preview. Below 480px, horizontal padding reduces to 20px, the display scale settles at 46px, and the preview preserves a tall, readable list region.

Spacing follows a compact 4/8px rhythm, with 8px as the primary unit and recurring 16px, 24px, and 32px intervals. Containers should remain breathable rather than densely administrative.

## Elevation & Depth

This is a layered and restrained system. Depth comes primarily from the contrast between the lavender canvas, white cards, soft footer surfaces, and fine lavender-gray borders. Shadows are ambient and quiet, used to separate the inbox card from the hero canvas and to give image artifacts a physical paper quality; they should not make controls feel floating or heavy.

### Shadow Vocabulary
- **Inbox ambient lift** (`0 18px 40px #38204412`): The main preview card against the hero canvas.
- **Interactive card hover** (`0 14px 28px rgb(17 17 17 / 12%)`): Hover emphasis for image-backed cards elsewhere in the landing page.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat at rest. Shadows clarify a meaningful layer or interaction; they are never used as decoration on every component.

## Shapes

The form language mixes a strong pill silhouette for primary actions with compact 8px controls and a more substantial 20px radius for the main preview card. This creates a hierarchy: actions are friendly and fluid, filters are practical, and the main information surface is calm and considered.

Cards use white backgrounds, subtle one-pixel borders, and clipped overflow. List items are mostly rectangular with thin separators. Supporting photos use a small 3px radius, white paper framing, and slight rotation to evoke pinned campus notices without turning the page into a literal collage.

## Components

### Buttons
- **Shape:** Primary actions are pill-shaped (`999px`); filters use a compact radius (`8px`); text links remain mostly unboxed.
- **Primary:** Near-black background (`#17131d`), white text, 48px height, and horizontal padding of 23px. The label is medium-heavy and paired with a simple directional glyph.
- **Hover / Focus:** Primary hover shifts to a softer deep-plum black (`#39303f`). Focus uses a 2px lavender signal outline with a 4px offset. Respect reduced-motion preferences.
- **Secondary / Ghost / Tertiary:** Secondary actions use a minimal bottom border and a directional cue rather than a competing filled button.

### Chips
- **Style:** Filter controls are white or transparent with a subtle `#e5dfe9` border, 8px radius, 40px height, and 13px text.
- **State:** Selected filters use the lavender surface (`#eee3f9`), lavender border (`#d7c4e6`), and deep ink text. Selection is exposed through `aria-pressed`.

### Cards / Containers
- **Corner Style:** Main inbox card uses a 20px radius; supporting content may use smaller 8px or 3px corners.
- **Background:** White content surface with a soft lavender footer (`#faf8fc`).
- **Shadow Strategy:** Use the inbox ambient lift only for the primary preview layer.
- **Border:** One-pixel lavender-gray outer border and subtle internal dividers (`#eee9f1`).
- **Internal Padding:** Heading uses approximately 25px/26px desktop padding; body uses 16px/18px; footer uses 14px/20px.

### Inputs / Fields
- **Style:** No broad form system is established in the current landing page. Future fields should use white surfaces, subtle borders, 8px corners, readable 40–48px controls, and the same ink/muted text hierarchy.
- **Focus:** Use the established 2px lavender signal outline with a 4px offset.
- **Error / Disabled:** Preserve semantic clarity with accessible contrast; do not rely on color alone.

### Navigation
- **Style:** Header is a warm lavender band that shifts to a lighter lavender surface when scrolled. The logo combines a compact image mark and bold wordmark.
- **Typography:** Wordmark uses near-black 20px-ish bold text with tight tracking.
- **States:** Keep navigation quiet and legible; avoid introducing a second competing accent color.
- **Mobile treatment:** Preserve the same brand lockup and prioritize a simple, uncluttered navigation surface.

### Campus Inbox Preview
The signature component is a source-aware “Today & Soon” preview. It pairs a strong kicker, readable week context, filter chips, date tiles, category labels, audience metadata, and a clear arrow affordance. Detail view returns users to the inbox and exposes audience, timing, example source, and a transparency note. The component must keep illustrative data visibly framed as preview content.

## Do's and Don'ts

- **Do** preserve the warm lavender canvas, near-black ink, lavender signal, and restrained blush highlight.
- **Do** use generous whitespace and clear hierarchy so students can scan important information quickly.
- **Do** make source, publisher, date, and verification context easy to find in future information surfaces.
- **Do** use semantic HTML, visible focus states, keyboard navigation, and reduced-motion support.
- **Do** keep cards white and quietly structured with fine borders and restrained depth.
- **Don't** introduce neon colors, heavy glassmorphism, dense administrative tables, or generic AI dashboard styling.
- **Don't** cover the page in gradients, oversized rounded containers, or decorative motion.
- **Don't** use illustrative preview content as if it were verified NIT Hamirpur information.
- **Don't** replace the established UniFlow logo or imply institutional endorsement.
- **Don't** let expressive imagery or decoration compete with deadlines, source links, and primary actions.
