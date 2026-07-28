---
name: create-presentation
description: "Create (or restyle) a high-impact corporate/technical presentation in the Fever brand template — bold title slide, cyan title bands, FEVER wordmark, 'Confidential and Proprietary' footer, pillar/circle diagrams, candid value-driven copy, separated speaker notes. Use when asked to 'create a presentation', 'build a deck', 'kickoff deck', 'make a slide deck', 'restyle these slides', or pastes the corporate-technical-deck design prompt."
when_to_use: |
  Trigger when the user wants to CREATE or RESTYLE a presentation in the high-impact corporate-technical
  style — kickoff decks, exec/leadership decks, playbooks — especially in the Fever brand. Also trigger
  when the user pastes the "Act as an expert presentation designer…" template prompt (with or without a
  filled topic). If the topic placeholder is blank, ASK for the topic first. Default output = Google Slides
  via the `gws` CLI (org-editable, native speaker notes); offer an HTML artifact only if design fidelity
  matters more than editability.
---

# High-Impact Deck (Fever brand)


Build a presentation that reads as a polished corporate-technical deck: bold, scannable, value-driven, on-brand. This skill carries **(A) the design+copy template**, **(B) the Fever brand kit**, and **(C) the Google-Slides build playbook with the API gotchas already solved**.

## Which Google account

**Decks are work artifacts — build them in the company account, never a personal
one.** If you keep more than one authenticated `gws` config (common: one for work,
one personal), name the work config dir explicitly on every call:

```bash
export GOOGLE_WORKSPACE_CLI_CONFIG_DIR="$HOME/.config/gws-<your-work-config>"
gws auth status        # confirm it prints your WORK email before building anything
```

If `auth status` shows a personal address, stop and re-authenticate rather than
continuing — a deck created under the wrong account lands in the wrong Drive, is
invisible to colleagues, and has to be rebuilt to be shareable.

## A. Canonical template prompt (verbatim — apply exactly)

Apply this prompt's rules exactly; fill `[INSERT YOUR NEW TOPIC HERE]` with the user's topic (ask if blank).

> Act as an expert presentation designer and copywriter. I want to create a new presentation that replicates the exact structure, visual styling, and tone of a high-impact corporate technical deck. Use the guidelines below to design the template and draft the copy:
>
> **1. FIRST SLIDE (TITLE SLIDE) LAYOUT:**
> - Structure: Minimalist, clean, and bold.
> - Top Section: Large, prominent main title in a clean sans-serif font (e.g., "Firefighter").
> - Middle Section: A direct subtitle defining the core scope (e.g., "On-Call during working hours").
> - Bottom Section: A short, high-level structural breakdown or agenda summary (e.g., "Goals, responsibilities, and the rotation").
>
> **2. HEADER/FOOTER & PERSISTENT ELEMENTS:**
> - Brand Identifier: Include a clean, modern geometric logo or icon slot placeholder on every content slide.
> - Compliance/Footer: Place a small, professional, and dimmed font text reading "Confidential and Proprietary" consistently across the bottom or margin of every slide to maintain an authoritative corporate standard.
>
> **3. VISUAL LAYOUT & STRUCTURE:**
> - Use clean, structured frameworks like "Triangles/Pillars" for core models or "Hub-and-Spoke/Circles" diagrams to map interconnected responsibilities and prerequisites without cluttering slides with walls of text.
> - Separate high-level titles from context-rich "Speaker Notes" so slides remain scannable at a single glance.
>
> **4. VOICE & TONE:**
> - Professional yet Candid: Speak with a touch of sharp, grounded wit. Avoid corporate fluff or over-complicating definitions.
> - Value-Driven & Real: Explicitly tie technical outcomes to business value or revenue protection (e.g., "Each 1 minute = thousands in revenue and trust" or "Let's make this the most boring and profitable week of your month").
> - Metaphorical Clarifications: Use highly relatable, non-technical analogies to explain complex professional setups (e.g., comparing onboarding or customer journeys to the sequential stages of dating).
> - Action-Oriented: Use clear, unambiguous, framework-driven directives (e.g., "Claim → 👀, Transfer → ❌, Document → ✅").
>
> Apply these aesthetic and linguistic rules to the following topic: [INSERT YOUR NEW TOPIC HERE]

**Lines that landed well in practice** (reuse the register, not verbatim): *"We're not here to admire the problem."* · *"these are this week, not 'soon'."* · *"bound by this chain, not headcount — calendar, not code."* The register is candid and concrete: name the constraint, tie it to money or trust, skip the hedging.

## B. Fever brand kit (extracted from the Firefighter reference deck — see Reference deck section)

- **Font:** Montserrat (bold for titles). **Primary:** Fever cyan `#1CB1DE` (rgb 28,177,222). **Neutrals:** near-black `#212121`, grey `#595959`/`#8A8A8A`, light cyan `#EAF7FC`, white.
- **Title slide:** WHITE background, large **black** bold LEFT-aligned title + black subtitle, dimmed-grey agenda line, lowercase **fever** (black) bottom-left, grey footer. (The reference also has an isometric illustration on the left — leave a slot / drop an image.)
- **Content slides:** a **thin** full-width cyan band (~0.6in) at the very top with the WHITE title left-aligned (~16pt) inside it; lowercase **white** fever top-right; dark body on white; grey "Confidential and Proprietary" footer bottom-left. Keep the band a clean thin rectangle — NOT a fat arrow/pentagon.
- **Diagrams:** cyan shapes; pillars = cyan header + `#EAF7FC` body w/ cyan outline; circles = solid cyan, white label; arrows cyan with `FILL_ARROW`.

## C. Build playbook — Google Slides via `gws` CLI

Needs the `gws` CLI authenticated (see the `google-workspace-cli` skill). **Strip the `Using keyring backend: keyring` banner before parsing JSON** (`| grep -v "keyring backend"`). Iterate by writing batchUpdate JSON with a Python generator in the scratchpad, then `--json "$(cat file.json)"`.

**Create + target:**
```
gws slides presentations create --json '{"title":"…"}'          # returns the deck (id is in the body)
gws drive files list --params '{"q":"name contains '"'"'…'"'"'","fields":"files(id,name)","orderBy":"createdTime desc"}'
gws slides presentations batchUpdate --params '{"presentationId":"…"}' --json '{"requests":[…]}'
```

**Gotchas already solved (don't relearn these):**
- **Object IDs must be ≥5 chars** (`slide01`, `slide01_t`, `title_wm` — NOT `s1`, `p_wm`).
- `batchUpdate` is **atomic** — one bad request rolls back the whole batch (safe to retry after a fix).
- **Default deck has one slide `p`** (CENTERED_TITLE `i0` + SUBTITLE `i1`) — reuse it as the title slide.
- **Content slides:** `createSlide` with `predefinedLayout:"TITLE_AND_BODY"` + `placeholderIdMappings` to assign known IDs (`{type:TITLE}`→`sNN_t`, `{type:BODY}`→`sNN_b`), then `insertText`, then `createParagraphBullets {textRange:ALL, bulletPreset:"BULLET_DISC_CIRCLE_SQUARE"}`.
- **Color scheme path** is `masters(pageProperties(colorScheme))` — NOT `masters(colorScheme)`.
- **Title band:** create a full-width `RECTANGLE` (width 9144000 EMU = 10in, height ~1051560 EMU = 1.15in, transform identity at 0,0), fill cyan + `outline NOT_RENDERED`, then `updatePageElementsZOrder … SEND_TO_BACK` so the white title text sits on top. ⚠️ Do NOT resize a thin bar via `updatePageElementTransform` scaleY — the stored base size is unreliable (a scaleY of 13 made a 42-inch-tall block). Delete + recreate at the right size instead.
- **Text color/font:** `updateTextStyle {style:{fontFamily:"Montserrat",bold,fontSize:{magnitude,unit:"PT"},foregroundColor:{opaqueColor:{rgbColor:{red,green,blue}}}}, fields:"…"}`. rgb are 0–1 floats.
- **Wordmark:** a TEXT_BOX top-right with "FEVER" (Montserrat bold, cyan on white / white on cyan), paragraph `alignment:END`.
- **Footer:** TEXT_BOX bottom-left (~y 5.27in), "Confidential and Proprietary", 8pt, grey (light-cyan on cyan slides).
- **Speaker notes:** fetch `slides(slideProperties(notesPage(pageElements(objectId,shape(placeholder(type))))))`, find the BODY placeholder id per slide, `insertText` the note there.
- **Image-beside-text:** placeholder text boxes **scale their text when you scale the box** — never narrow a body via transform. To put an image on the right, DELETE the body and recreate it as a narrower TEXT_BOX (text reflows), then place the image in the freed column.
- **NEVER call `updatePageElementTransform` on a text box you created with an explicit size.** ABSOLUTE mode resets the element to its **3.28in (3000000-EMU) base** — real size is encoded in scale — so the box balloons to 3.28in and middle-aligned text drops to y≈1.6in: **white-on-white, invisible**. To move OR resize a text box, DELETE it and recreate at the new size with a translate-only transform (scaleX/scaleY = 1). Same base-size trap bit the title band (a scaleY of 13 → 42in tall).
- **Header banner = a thin RECTANGLE band, not a PENTAGON.** At a wide-flat aspect the PENTAGON warps into a double-pointed hexagon and can hide overlapping text. Make the Fever header a plain cyan RECTANGLE ~0.6in tall, full width, sent to back; the title is a SEPARATE text box (9in × 0.6in, white, ~16pt, left-aligned, contentAlignment MIDDLE) placed on top — do NOT rely on the TITLE placeholder (it clips the first glyph).
- **`getThumbnail` is CACHED.** A byte-identical PNG after an edit = a stale render, not "nothing changed." Trust a thumbnail only after a structural change (create/delete object) forces regeneration; if bytes are unchanged, re-fetch.

**Pillars (core model):** per pillar a cyan header RECTANGLE (white bold centered, `contentAlignment:MIDDLE`) above a `#EAF7FC` body RECTANGLE with cyan outline (dark text, `contentAlignment:TOP`). 3 across ~2.8in wide each, 0.35in gaps.

**Circles (prerequisites/chain):** `ELLIPSE` per node (cyan, white bold label, ~1.05in), joined by `createLine {lineCategory:"STRAIGHT"}` with `updateLineProperties {endArrow:"FILL_ARROW", lineFill cyan}`. A value-driven caption underneath.

**Screenshots (no asset on hand):** the brand-deck image URLs are ephemeral `googleusercontent/slidesz/…` (createImage can't fetch them). Capture your own:
```
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --disable-gpu \
  --hide-scrollbars --force-device-scale-factor=2 --window-size=1400,950 \
  --screenshot=shot.png "file://…/page.html"   # or a live https URL with --virtual-time-budget=12000
gws drive files create --upload shot.png --upload-content-type image/png --json '{"name":"…"}' --params '{"fields":"id"}'
gws drive permissions create --params '{"fileId":"FID"}' --json '{"role":"reader","type":"anyone"}'
# then createImage with url https://lh3.googleusercontent.com/d/FID   (lh3 works; uc?export often doesn't)
```
Full-page captures are very tall/portrait — grab a landscape top crop (e.g. window 1400×950) for a slide.

**Verify visually every time:** `gws slides presentations pages getThumbnail --params '{"presentationId":"…","pageObjectId":"slideNN","thumbnailProperties.thumbnailSize":"LARGE"}'`, `curl` the returned `contentUrl` to a PNG, and Read it. Don't trust "no error" — render and look.

## Flow
1. If topic is blank, ask for it. Confirm format (default Google Slides). 
2. Pull real numbers from a real source — never fabricate dates or metrics. If you can't verify a figure, leave a visible placeholder.
3. Outline → build title + content slides → brand (band, wordmark, footer) → diagrams (pillars/circles) → speaker notes.
4. Thumbnail-verify the title slide + each diagram slide; fix; redeploy.
5. Offer: share with the group / add the link wherever the work is tracked.

## Reference deck (THE canonical template to replicate)

**Firefighter** (Fever-internal; request access if you need it) — `1BzNUsvayhdnQtS8tv69y7270sIO7EE18O4WS-eVYvwg`
(https://docs.google.com/presentation/d/1BzNUsvayhdnQtS8tv69y7270sIO7EE18O4WS-eVYvwg/edit)

This is the style/structure/tone reference — the prompt's own examples come from it ("Firefighter", "On-Call during working hours", "Claim → 👀, Transfer → ❌, Document → ✅", "the most boring and profitable week of your month"). **Read it first** and replicate its title-slide layout, persistent footer + brand mark, Pillars/Circles framing, and candid value-driven voice. The Fever brand kit in §B (Montserrat, cyan `#1CB1DE`, neutrals) was extracted from this deck — its colors live on `masters(pageProperties(colorScheme))` and on the styles slide `g3bf8255a53e_0_1509`.

