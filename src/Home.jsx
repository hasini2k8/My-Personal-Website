import { useState, useEffect, useRef, useMemo } from "react";

/* =====================================================================
   PROJECTS PAGE
   =====================================================================
   The navbar + background block below is copied verbatim from Home.jsx
   so the two pages feel identical and share the same nav behaviour
   (desktop tabs, mobile hamburger dropdown, light/dark toggle). If you
   ever change the navbar in Home.jsx, mirror the change here too.

   ---------------------------------------------------------------------
   DESKTOP FLOW — generalized to 7 independent hotspots (BOOKS below),
   each pointing at its own /book1/ .. /book7/ folder. Only one flow can
   be active at a time; clicking any hotspot drives the SAME shared
   sequence, just against that book's images:
     1. idle    — all 7 hotspots are live, side image shows SIDE_IMAGE_SRC.
     2. alert   — click a hotspot: side image swaps to that book's
                  ALT_SIDE_IMAGE_PATH, every hotspot disappears, and that
                  book's 1.png appears at ITS configured alert position,
                  shaking every few seconds. It has its own little ✕.
                    - click that ✕            -> back to idle (side image
                      reverts, all hotspots reappear).
                    - click the 1.png itself  -> phase "open".
     3. open    — background blurs with sparkles, 1.png shakes + grows
                  large in the middle, then auto-plays through
                  2.png … 21.png and stops on 21 (slow final grow). A ✕
                  pinned to the top of the screen closes it (back to
                  idle).

   MOBILE FLOW — mirrors the desktop shape (hotspot -> alert -> open)
   instead of the old tap-anywhere framed modal:
     1. idle   — all 7 hotspots are live, side image shows SIDE_IMAGE_SRC.
     2. alert  — tap a hotspot: side image swaps to that book's
                 ALT_SIDE_IMAGE_PATH (same as desktop), hotspots hide,
                 and that book's 1.png appears near the top of the
                 screen (position/size tunable via BOOKS[].mobileAlert)
                 with its own ✕ to dismiss back to idle.
     3. tilt   — tap the 1.png: the screen blurs and a short "tilt your
                 phone to landscape" message shows in an elegant italic
                 serif face, giving the reader a beat to rotate their
                 device. A ✕ is available the whole time to bail out.
     4. open   — once the tilt beat has played (and every frame is
                 confirmed cached), the flipbook takes over: same shake
                 + grow intro, auto-play through 2.png … 21.png, final
                 grow, and the 22.png ink fade-in as desktop — just
                 rendered rotated 90° so it reads correctly once the
                 phone is actually turned sideways, and with its OWN
                 grow amount (MOBILE_OPEN_FINAL_GROW_SCALE) independent
                 of desktop's. The ✕ stays pinned to the (unrotated) top
                 of the screen.
   ---------------------------------------------------------------------

   ✕ BUTTON POSITIONING — all three close buttons in this file are now
   tunable via top/left constants:
     - desktop alert ✕   -> ALERT_CLOSE_BTN_TOP_PCT / ALERT_CLOSE_BTN_LEFT_PCT
     - mobile alert ✕    -> MOBILE_ALERT_CLOSE_BTN_TOP_PCT / MOBILE_ALERT_CLOSE_BTN_LEFT_PCT
     - pinned "top of screen" ✕ (desktop open, mobile tilt, mobile open)
         -> OPEN_CLOSE_TOP_OFFSET / OPEN_CLOSE_LEFT_PCT for desktop
         -> MOBILE_OPEN_CLOSE_TOP_OFFSET / MOBILE_OPEN_CLOSE_LEFT_PCT for mobile
   The alert ✕s are percentages of their own image's rendered size (so
   they scale with the art). The pinned ✕ is a px offset below the
   navbar plus a % of the viewport width (50 = centered).
   ---------------------------------------------------------------------

   ANTI-GLITCH / SIZING NOTES (read before touching layout):
   Every page image (frames 1..21 + the 22.png ink overlay) for a book is
   preloaded with plain `new Image()` calls BEFORE it's ever shown:
     - all 7 books' frame-1 art is preloaded once on first mount, so the
       very first alert popup never shows a blank/half-loaded image.
     - the FULL frame set (1..21 + 22) for whichever book is active is
       preloaded the moment that book becomes active (hotspot click), so
       by the time the flipbook actually starts auto-playing, every
       frame is already in the browser cache. The auto-play intro timer
       (desktop AND mobile) is gated on `pageAssetsReady` so playback
       never races ahead of the network.
     - the rendered page box (.open-image / plus the ink overlay riding
       on top of it) is sized ONCE per book from frame 1's *natural*
       pixel dimensions (measured off the preloaded Image), fit-to-box
       via `computeContainSize`, and then applied as an explicit
       width/height in px. That size is reused for every frame of that
       book, so nothing changes size frame-to-frame or on open/close —
       no "snap" as a new image finishes loading, no collapse-then-pop-
       back-in.
   Do not swap the fixed width/height back to maxWidth/maxHeight-only
   sizing, and don't gate the intro animation open again without also
   gating on `pageAssetsReady`, or the old lag/pop glitches come back.
   ===================================================================== */

/* ====== NAVBAR CONTROLS — mirrors Home.jsx exactly ====== */
const NAV_LOGO_SRC = "/logo.png";
const NAV_LOGO_SIZE = 40;
const MOBILE_NAV_LOGO_SIZE = 30;
const NAV_TABS = [
  { label: "Home", href: "/" },
  { label: "About Me", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
];
const NAV_HEIGHT = 68;        // px, desktop
const MOBILE_NAV_HEIGHT = 56; // px, phones
const MOBILE_BREAKPOINT = 640;

/* ====== THEME / BACKGROUND CONTROLS — mirrors Home.jsx exactly ====== */
const DARK_BG_GIF = "/background.gif";        // used in dark mode
const LIGHT_BG_GIF = "/background-light.gif"; // used in light mode

/* ====== SIDE IMAGE CONTROLS ======
   Swaps from SIDE_IMAGE_SRC to a PER-HOTSPOT alt image the moment that
   hotspot is clicked — hotspot 1 -> project-side1.png, hotspot 2 ->
   project-side2.png, ... hotspot 7 -> project-side7.png — on BOTH
   desktop and mobile now, and swaps back to SIDE_IMAGE_SRC the moment
   that book's flow is closed (any ✕, on either layout). */
const SIDE_IMAGE_SRC = "/project-side.png"; // <-- drop into /public (idle / closed state)
// One alt image per hotspot, numbered 1..7 to match BOOKS order.
// Drop project-side1.png .. project-side7.png into /public.
const ALT_SIDE_IMAGE_PATH = (bookNumber) => `/project-side${bookNumber}.png`;
const SIDE_IMAGE_SIZE = 440;                // desktop width in px
const SIDE_IMAGE_TOP = "55%";               // desktop position
const SIDE_IMAGE_LEFT = "20%";
const MOBILE_SIDE_IMAGE_SIZE = 340;         // mobile width in px
const MOBILE_SIDE_IMAGE_TOP = "70%";        // mobile position
const MOBILE_SIDE_IMAGE_LEFT = "50%";

/* ====== HOTSPOT + ALERT SHARED CONTROLS ======
   These apply to every hotspot/alert pair below. Per-book position/size
   lives in the BOOKS array further down — edit THOSE to move a specific
   hotspot or alert image. HOTSPOT_SHOW_HINT is kept for backwards
   compatibility but the hint outline itself now renders fully
   transparent (see .hotspot-hint below), so hotspots stay invisible
   until hovered regardless of this flag. */
const HOTSPOT_SHOW_HINT = true;
// DEBUG: when true, every hotspot renders with a visible dashed outline
// and a big number label (1..7, matching BOOKS order) so you can see
// exactly where each one sits and line it up with the artwork. Hovering
// a hotspot swaps it to a solid highlight so you can confirm the exact
// hit area. Leave this false for production — hotspots then render with
// no border/number at all, just the gold hover-glow (same on desktop
// and mobile). Flip back to true only while you're repositioning them.
const DEBUG_HOTSPOTS = false;
const ALERT_SHAKE_CYCLE = 4.5;      // seconds between shake jolts
const ALERT_CLOSE_BTN_SIZE = 30;    // px, desktop alert ✕

// Desktop alert ✕ position, as a % of the alert image's own rendered
// size (not px), so it stays proportionate whether a book's alert image
// is tiny or huge. TOP/LEFT mark where the CENTER of the ✕ sits.
// Negative or >100 = floats outside that edge of the image.
const ALERT_CLOSE_BTN_TOP_PCT = 2;
const ALERT_CLOSE_BTN_LEFT_PCT = 92;

/* ====== MOBILE ALERT (1.png near the top) CONTROLS ======
   Position of the 1.png itself is per-book, via BOOKS[].mobileAlert
   below. The ✕ pinned to its corner is sized/positioned here — same
   idea as the desktop alert ✕: TOP/LEFT are a % of the mobile alert
   image's own rendered size. */
const MOBILE_ALERT_CLOSE_BTN_SIZE = 26; // px
const MOBILE_ALERT_CLOSE_BTN_TOP_PCT = -5;
const MOBILE_ALERT_CLOSE_BTN_LEFT_PCT = 97;

/* ====== PINNED "TOP OF SCREEN" ✕ CONTROLS ======
   Used by desktop's flipbook overlay, and mobile's tilt-prompt AND
   flipbook overlay (same button/position for both mobile steps).
   TOP_OFFSET is a px gap below the navbar; LEFT_PCT is a % of the
   viewport width (50 = centered). Desktop and mobile are independent so
   you can move the ✕ separately on each layout. */
const OPEN_CLOSE_TOP_OFFSET = 10;        // desktop — px below navbar
const OPEN_CLOSE_LEFT_PCT = 50;          // desktop — % of viewport width
const MOBILE_OPEN_CLOSE_TOP_OFFSET = 5; // mobile — px below navbar
const MOBILE_OPEN_CLOSE_LEFT_PCT = 90;   // mobile — % of viewport width

/* ====== MOBILE TILT-TO-LANDSCAPE CONTROLS ======
   How long the "tilt your phone" message holds on screen before the
   flipbook takes over (it will also wait a little longer than this if
   the book's frames haven't finished preloading yet). */
const MOBILE_TILT_PROMPT_DURATION = 1800; // ms

/* ====== MOBILE OPEN / FLIPBOOK FIT CONTROLS ======
   The rotated flipbook is sized against the *viewport*, not a fixed
   box, since the whole point is filling the phone screen once it's
   turned sideways. Because the frame is rotated 90°, its own width
   maps to the screen's vertical space once rotated, and its own height
   maps to the screen's horizontal space — so these ratios are against
   viewport HEIGHT and WIDTH respectively (not swapped). Tune these to
   leave whatever margin you like around the art. */
const MOBILE_OPEN_FIT_HEIGHT_RATIO = 0.78; // fraction of viewport height
const MOBILE_OPEN_FIT_WIDTH_RATIO = 0.86;  // fraction of viewport width

/* ====== THE 7 BOOKS ======
   Each entry drives one hotspot -> alert -> open flow against its own
   /public/<folder>/1.png .. 21.png. Edit hotspot/alert per book to place
   it wherever you like. top/left mark the CENTER of that element.
   mobileAlert is the position/size of the 1.png shown near the top of
   the screen on mobile before the tilt prompt — tweak freely. */
const BOOKS = [
  {
    id: "book1",
    folder: "book1",
    hotspot: { top: "36%", left: "20%", width: 310, height: 60 },
    mobileHotspot: { top: "57%", left: "50%", width: 240, height: 40 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // How many images live in /public/book1/project-images/ (named
    // 1.png, 2.png, ... up to this count). Set to 0 to hide the panel
    // for this book.
    projectImagesCount: 5,
    // This book's own DESKTOP project-images panel — position (top/
    // left, % of viewport, CENTER of the card), size (width/height,
    // px), and tilt (tiltDeg, degrees — negative = counter-clockwise).
    // Every book has its own copy, so each panel can sit somewhere
    // different, be a different size, and tilt a different way. Any
    // field you omit falls back to the shared PROJECT_IMAGES_PANEL_*
    // defaults further down.
    projectImagesPanel: { top: "48%", left: "39%", width: 220, height: 240, tiltDeg: 6 },
    // This book's own MOBILE project-images panel. Same idea as
    // projectImagesPanel above, but for the mobile "open" overlay —
    // width/height are deliberately landscape-shaped (width > height)
    // so the card reads as a horizontal card once the reader has
    // physically turned their phone to landscape, matching the
    // flipbook itself. Falls back to PROJECT_IMAGES_PANEL_MOBILE_*
    // below for any field left out.
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book2",
    folder: "book2",
    hotspot: { top: "46.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "63.5%", left: "50%", width: 240, height: 43 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book2/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "50%", left: "42%", width: 170, height: 240, tiltDeg: 6 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book3",
    folder: "book3",
    hotspot: { top: "56.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "70.5%", left: "50%", width: 240, height: 40 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book3/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "51%", left: "40.5%", width: 170, height: 240, tiltDeg: 6 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book4",
    folder: "book4",
    hotspot: { top: "66.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "77.5%", left: "50%", width: 240, height: 50 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book4/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "48%", left: "43%", width: 180, height: 240, tiltDeg: 3 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book5",
    folder: "book5",
    hotspot: { top: "76.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "84.5%", left: "50%", width: 240, height: 40 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book5/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "48%", left: "39%", width: 220, height: 240, tiltDeg: 6 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book6",
    folder: "book6",
    hotspot: { top: "86.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "91.5%", left: "50%", width: 240, height: 40 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book6/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "48%", left: "39%", width: 220, height: 240, tiltDeg: 6 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
  {
    id: "book7",
    folder: "book7",
    hotspot: { top: "96.5%", left: "20.5%", width: 320, height: 60 },
    mobileHotspot: { top: "97.5%", left: "50%", width: 240, height: 40 },
    alert: { top: "55%", left: "70%", size: 700 },
    mobileAlert: { top: "30%", left: "50%", size: 300 },
    // /public/book7/project-images/1.png .. N.png — see book1 above.
    projectImagesCount: 5,
    projectImagesPanel: { top: "48%", left: "39%", width: 220, height: 240, tiltDeg: 6 },
    projectImagesPanelMobile: { top: "50%", left: "82%", width: 220, height: 130, tiltDeg: 6 },
  },
];

/* ====== DESKTOP PROJECT-IMAGES SCROLL PANEL (shared fallback) ======
   A small floating card, desktop only, that appears once a book's
   flipbook has landed on its last page and the 22.png ink reveal is
   showing. Lets the visitor click through extra project screenshots
   pulled from /public/<folder>/project-images/1.png .. N.png (N is set
   per book via BOOKS[].projectImagesCount above — 0 hides the panel for
   that book). EVERY book now carries its own position/size/tilt via
   BOOKS[].projectImagesPanel (top/left/width/height/tiltDeg) — the
   constants below are only used as a fallback for any field a book's
   projectImagesPanel doesn't set. */
const PROJECT_IMAGES_FOLDER_NAME = "project-images";
const PROJECT_IMAGES_PATH = (folder, n) => `/${folder}/${PROJECT_IMAGES_FOLDER_NAME}/${n}.png`;
const PROJECT_IMAGES_PANEL_TOP = "48%";     // fallback % of viewport, center of card
const PROJECT_IMAGES_PANEL_LEFT = "39%";    // fallback % of viewport, center of card
const PROJECT_IMAGES_PANEL_WIDTH = 220;     // fallback px
const PROJECT_IMAGES_PANEL_HEIGHT = 240;    // fallback px
// Fallback tilt for the card, in degrees (negative = tilts counter-
// clockwise, positive = clockwise), used only when a book's
// projectImagesPanel.tiltDeg is left unset.
const PROJECT_IMAGES_PANEL_ROTATION_DEG = 6;

/* ====== MOBILE PROJECT-IMAGES SCROLL PANEL (shared fallback) ======
   Same card, same behaviour, shown inside the mobile "open" flipbook
   overlay instead — sized landscape (width > height) so it reads as a
   horizontal card, matching the flipbook, once the reader has
   physically turned their phone sideways. It's positioned relative to
   the full viewport and carries its own 90° base rotation PLUS
   whichever tiltDeg you give it (see PROJECT_IMAGES_PANEL_MOBILE_
   ROTATION_DEG / BOOKS[].projectImagesPanelMobile.tiltDeg) — you only
   ever need to think about the tilt on top of that base 90°, exactly
   like you would for the desktop panel. Every book carries its own
   copy via BOOKS[].projectImagesPanelMobile; the constants below are
   only the fallback for any field a book leaves unset. */
const PROJECT_IMAGES_PANEL_MOBILE_TOP = "50%";    // fallback % of viewport
const PROJECT_IMAGES_PANEL_MOBILE_LEFT = "82%";   // fallback % of viewport
const PROJECT_IMAGES_PANEL_MOBILE_WIDTH = 220;    // fallback px (landscape — keep > height)
const PROJECT_IMAGES_PANEL_MOBILE_HEIGHT = 130;   // fallback px
const PROJECT_IMAGES_PANEL_MOBILE_ROTATION_DEG = 6; // fallback extra tilt, on top of the base 90°

/* ====== MAGNIFY ICON (sits on the current project-images thumbnail) ======
   A small clickable magnifying-glass badge layered on top of whichever
   project image (1.png, 2.png, 3.png... from that book's
   project-images/ folder) is currently showing in the scroll panel —
   desktop AND mobile panels both use this. Clicking it pops THAT SAME
   image — whichever one you're on — into a bigger lightbox. top/left
   are a % of the panel's own image frame, so the icon stays put on the
   art regardless of image size. Move/resize freely. */
const MAGNIFY_ICON_SIZE = 34;      // px
const MAGNIFY_ICON_TOP_PCT = 90;   // % of the project-image frame's height
const MAGNIFY_ICON_LEFT_PCT = 90;  // % of the project-image frame's width

/* ====== LIGHTBOX (expanded project-images thumbnail) ======
   Full-screen viewer opened by the magnify icon on either
   project-images panel (desktop or mobile). Shows whichever thumbnail
   (1, 2, 3...) was active when clicked, larger and centered — always
   upright/unrotated so it's readable without needing to physically
   turn the phone — with its own ✕. */
const LIGHTBOX_MAX_WIDTH_RATIO = 0.86;  // fraction of viewport width
const LIGHTBOX_MAX_HEIGHT_RATIO = 0.86; // fraction of viewport height

/* ====== OPEN / FLIPBOOK OVERLAY CONTROLS (desktop, shared timings) ======
   The frameless, blurred, sparkling "book opens" moment. OPEN_BOX_WIDTH/
   HEIGHT just define the bounding area the image + sparkles sit inside
   on DESKTOP (the image itself scales to fit within it) — make this big
   since the image should read as "large in the middle of the screen".
   Mobile uses its own viewport-based sizing (see MOBILE_OPEN_FIT_* above)
   but shares every timing constant below EXCEPT the grow scale, which
   is independent per layout (see OPEN_FINAL_GROW_SCALE vs
   MOBILE_OPEN_FINAL_GROW_SCALE). */
const OPEN_BOX_WIDTH = 520;
const OPEN_BOX_HEIGHT = 640;
const OPEN_INTRO_DURATION = 0.9;   // seconds — shake + grow entrance
const OPEN_FLOAT_DISTANCE = 16;    // px — gentle bob once settled
const OPEN_FLOAT_DURATION = 3.2;   // seconds per bob cycle
const OPEN_FINAL_GROW_SCALE = 1.55;        // desktop — how much bigger frame 21 grows to
const MOBILE_OPEN_FINAL_GROW_SCALE = 1.35; // mobile — independent grow amount, tune freely
const OPEN_FINAL_GROW_DURATION = 3.5; // seconds — slow, deliberate grow (shared)

/* ====== INK REVEAL CONTROLS (shared, desktop + mobile) ======
   After a book's flipbook lands on its final frame (BOOK_FRAME_COUNT)
   and finishes growing, drop /public/<folder>/22.png next to the other
   frames. It slowly fades in on top of frame 21 and holds, at the same
   rendered size as 21.png (since it sits inside the same auto-sized
   frame wrapper as the image it's layered over). Mobile now shares the
   same "wait for the grow to settle" timing as desktop, since mobile
   also does the final grow. */
const INK_FRAME_NUMBER = 22;
const INK_IMAGE_PATH = (folder) => `/${folder}/${INK_FRAME_NUMBER}.png`;
const INK_START_DELAY_MS = OPEN_FINAL_GROW_DURATION * 1000; // wait for the frame-21 grow to settle
const INK_FADE_DURATION = 2.6;           // seconds — how slowly 22.png fades in over 21.png

/* ====== BOOK FLIPBOOK CONTROLS (shared) ======
   Drop /public/<folder>/1.png .. 21.png for each book. */
const BOOK_FRAME_COUNT = 21;
const BOOK_IMAGE_PATH = (folder, n) => `/${folder}/${n}.png`;
const BOOK_PLAYBACK_SPEED_MS = 140; // ms between frames while playing

/* ====== BLUR + SPARKLE CONTROLS (shared) ====== */
const BACKDROP_BLUR_PX = 10;
const SPARKLE_COUNT = 26;
const SPARKLE_COLOR_CORE = "#fff8dc";
const SPARKLE_COLOR_EDGE = "#f2c869";

/* Given an image's natural pixel size, scale it down (never up) to fit
   inside a bounding box while preserving aspect ratio — same math as
   object-fit: contain, but resolved to real px so we can lock a wrapper
   to it and never have it resize again. */
function computeContainSize(naturalW, naturalH, boxW, boxH) {
  if (!naturalW || !naturalH || !boxW || !boxH) return null;
  const scale = Math.min(boxW / naturalW, boxH / naturalH, 1);
  return {
    w: Math.round(naturalW * scale),
    h: Math.round(naturalH * scale),
  };
}

/* Small sparkle dot, twinkling forever while its box is open. top/left
   are percentages within whatever positioning box it's rendered inside. */
function BookSparkle({ top, left, size, duration, delay }) {
  return (
    <span
      className="book-sparkle"
      style={{
        top,
        left,
        width: `${size}px`,
        height: `${size}px`,
        "--sparkle-duration": `${duration}s`,
        "--sparkle-delay": `${delay}s`,
      }}
    />
  );
}

function makeSparkles(count) {
  return Array.from({ length: count }, (_, i) => {
    const edge = Math.random();
    let top, left;
    if (edge < 0.25) { top = `${-2 + Math.random() * 6}%`; left = `${Math.random() * 100}%`; }
    else if (edge < 0.5) { top = `${94 + Math.random() * 6}%`; left = `${Math.random() * 100}%`; }
    else if (edge < 0.75) { top = `${Math.random() * 100}%`; left = `${-2 + Math.random() * 6}%`; }
    else { top = `${Math.random() * 100}%`; left = `${94 + Math.random() * 6}%`; }
    return {
      id: i,
      top,
      left,
      size: 4 + Math.random() * 6,
      duration: 1.6 + Math.random() * 2.2,
      delay: Math.random() * 2.5,
    };
  });
}

/* Sits exactly over the (now fixed-size) image it's paired with — the
   parent must be a position:relative wrapper sized to match the image
   it's layered over (see .open-image-frame below). Renders frame 22 as
   a slow, plain opacity fade on top of that image, at the same size as
   the frame it's layered over. */
function InkOverlay({ src, visible }) {
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      className={`ink-overlay ${visible ? "ink-overlay-visible" : ""}`}
    />
  );
}

/* Shared project-images panel body — the prev/next buttons, the
   current thumbnail, the magnify icon, and the "n / total" counter.
   Used by BOTH the desktop panel (unrotated) and the mobile panel
   (rotated), so the two never drift out of sync — only the outer
   wrapper's class + CSS vars differ between them. */
function ProjectImagesPanelBody({ activeBook, projectImageIndex, onPrev, onNext, onMagnify }) {
  return (
    <>
      <div className="project-images-frame">
        {activeBook.projectImagesCount > 1 && (
          <button
            type="button"
            className="project-images-nav-btn project-images-nav-prev"
            onClick={onPrev}
            aria-label="Previous image"
          >
            ‹
          </button>
        )}
        <img
          src={PROJECT_IMAGES_PATH(activeBook.folder, projectImageIndex + 1)}
          alt={`${activeBook.id} project image ${projectImageIndex + 1}`}
          className="project-images-img"
          draggable={false}
        />
        {activeBook.projectImagesCount > 1 && (
          <button
            type="button"
            className="project-images-nav-btn project-images-nav-next"
            onClick={onNext}
            aria-label="Next image"
          >
            ›
          </button>
        )}
        <button
          type="button"
          className="magnify-btn"
          style={{
            "--magnify-size": `${MAGNIFY_ICON_SIZE}px`,
            "--magnify-top": `${MAGNIFY_ICON_TOP_PCT}%`,
            "--magnify-left": `${MAGNIFY_ICON_LEFT_PCT}%`,
          }}
          onClick={onMagnify}
          aria-label={`Expand image ${projectImageIndex + 1}`}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="7" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
        </button>
      </div>
      <span className="project-images-count">
        {projectImageIndex + 1} / {activeBook.projectImagesCount}
      </span>
    </>
  );
}

export default function Project() {
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  // Raw viewport size, kept in sync on resize — used to size the
  // rotated mobile flipbook against the actual screen instead of a
  // fixed box (see MOBILE_OPEN_FIT_* above).
  const [viewport, setViewport] = useState({
    w: typeof window !== "undefined" ? window.innerWidth : 375,
    h: typeof window !== "undefined" ? window.innerHeight : 667,
  });

  // Which book (index into BOOKS) is currently active, if any.
  const [activeBookIndex, setActiveBookIndex] = useState(null);

  // Desktop flow: idle -> alert -> open -> back to idle.
  const [desktopPhase, setDesktopPhase] = useState("idle");

  // Mobile flow: idle -> alert -> tilt -> open -> back to idle.
  const [mobilePhase, setMobilePhase] = useState("idle");

  // Shared flipbook state (only one flow is ever visible at a time, so
  // it's safe to share across whichever book is active).
  const [frame, setFrame] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const intervalRef = useRef(null);
  const introTimeoutRef = useRef(null);
  const tiltTimeoutRef = useRef(null);

  // Ink-reveal (frame 22) — fades in once a book's flipbook has landed
  // on its final frame and finished its final grow.
  const [inkVisible, setInkVisible] = useState(false);
  const inkTimeoutRef = useRef(null);

  // Project-images scroll panel (desktop + mobile) — which image
  // (0-indexed) is currently showing. Resets whenever the active book
  // changes so a new book always starts back at its first image.
  const [projectImageIndex, setProjectImageIndex] = useState(0);

  // Lightbox — expanded view of whichever project-images thumbnail was
  // active when the magnify icon was tapped.
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // ----- anti-glitch: preloading + locked page dimensions -----
  // Cache of every image src we've already fully preloaded at least
  // once, so re-opening a book we've already visited never re-triggers
  // a network fetch or a "reset to unknown size" flash.
  const preloadedSrcsRef = useRef(new Set());
  // Natural pixel size of the ACTIVE book's frame 1, used to lock the
  // rendered page box so it never resizes frame-to-frame.
  const [pageNaturalSize, setPageNaturalSize] = useState(null); // { w, h }
  // True once every frame (1..21) + the ink frame (22) for the active
  // book has finished loading into the browser cache.
  const [pageAssetsReady, setPageAssetsReady] = useState(false);

  useEffect(() => {
    const checkSize = () => {
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
      setViewport({ w: window.innerWidth, h: window.innerHeight });
    };
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  // Warm the cache on first mount: both side images, plus every book's
  // frame-1 art. This is what makes the very first hotspot click show
  // an already-sized, already-loaded alert image instead of a blank/
  // half-painted one.
  useEffect(() => {
    [
      SIDE_IMAGE_SRC,
      ...BOOKS.map((_, i) => ALT_SIDE_IMAGE_PATH(i + 1)),
      ...BOOKS.map((b) => BOOK_IMAGE_PATH(b.folder, 1)),
    ].forEach((src) => {
      if (preloadedSrcsRef.current.has(src)) return;
      const img = new Image();
      img.onload = () => preloadedSrcsRef.current.add(src);
      img.src = src;
    });
  }, []);

  // Reset both flows any time we cross the mobile/desktop breakpoint, so
  // there's never a half-open state stuck from the other layout.
  useEffect(() => {
    setDesktopPhase("idle");
    setMobilePhase("idle");
    setActiveBookIndex(null);
    setPlaying(false);
    setIntroDone(false);
    setFrame(1);
    clearInterval(intervalRef.current);
    clearTimeout(introTimeoutRef.current);
    clearTimeout(tiltTimeoutRef.current);
    setInkVisible(false);
    clearTimeout(inkTimeoutRef.current);
    setLightboxOpen(false);
  }, [isMobile]);

  // Preload the ENTIRE frame set (1..21 + 22 ink) for whichever book is
  // active, the moment it becomes active — i.e. as soon as its hotspot
  // is clicked, well before the flipbook actually starts auto-playing.
  // By the time playback begins every frame is already cached, so
  // frame-to-frame swaps during playback never lag or briefly show the
  // previous frame's size.
  useEffect(() => {
    setProjectImageIndex(0);
    setLightboxOpen(false);

    if (activeBookIndex === null) {
      setPageNaturalSize(null);
      setPageAssetsReady(false);
      return;
    }

    const book = BOOKS[activeBookIndex];
    const frameSrcs = Array.from({ length: BOOK_FRAME_COUNT }, (_, i) => BOOK_IMAGE_PATH(book.folder, i + 1));
    const allSrcs = [...frameSrcs, INK_IMAGE_PATH(book.folder)];

    // If we've already fully preloaded this exact book before, keep
    // showing it as ready immediately instead of flashing back to an
    // "unknown size" state while we redundantly re-check the cache.
    const alreadyKnown = allSrcs.every((src) => preloadedSrcsRef.current.has(src));
    setPageAssetsReady(alreadyKnown);
    if (!alreadyKnown) setPageNaturalSize(null);

    let cancelled = false;
    let loaded = 0;

    allSrcs.forEach((src, i) => {
      const onDone = (img) => {
        if (cancelled) return;
        preloadedSrcsRef.current.add(src);
        if (i === 0 && img && img.naturalWidth && img.naturalHeight) {
          setPageNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
        }
        loaded += 1;
        if (loaded === allSrcs.length) setPageAssetsReady(true);
      };

      const img = new Image();
      img.onload = () => onDone(img);
      img.onerror = () => onDone(null);
      img.src = src;
    });

    return () => {
      cancelled = true;
    };
  }, [activeBookIndex]);

  // The box we fit the active book's page art into.
  // Desktop uses the frameless open overlay's fixed bounds.
  // Mobile is rotated 90° to be read in landscape, so it's sized off the
  // *viewport* instead: the frame's own width maps to the screen's
  // vertical space once rotated, and its own height maps to the
  // screen's horizontal space — so we fit against viewport height/width
  // directly (not swapped) using MOBILE_OPEN_FIT_*.
  const pageRenderSize = useMemo(() => {
    if (!pageNaturalSize) return null;
    const boundsW = isMobile ? viewport.h * MOBILE_OPEN_FIT_HEIGHT_RATIO : OPEN_BOX_WIDTH * 0.88;
    const boundsH = isMobile ? viewport.w * MOBILE_OPEN_FIT_WIDTH_RATIO : OPEN_BOX_HEIGHT * 0.88;
    return computeContainSize(pageNaturalSize.w, pageNaturalSize.h, boundsW, boundsH);
  }, [pageNaturalSize, isMobile, viewport]);

  const pageBoxFallbackStyle = isMobile
    ? { maxWidth: `${viewport.h * MOBILE_OPEN_FIT_HEIGHT_RATIO}px`, maxHeight: `${viewport.w * MOBILE_OPEN_FIT_WIDTH_RATIO}px` }
    : { maxWidth: `${OPEN_BOX_WIDTH * 0.88}px`, maxHeight: `${OPEN_BOX_HEIGHT * 0.88}px` };

  const pageImageStyle = pageRenderSize
    ? { width: `${pageRenderSize.w}px`, height: `${pageRenderSize.h}px` }
    : pageBoxFallbackStyle;

  // Advance the flipbook while `playing` is true, stopping the moment we
  // reach the last frame. Shared by both flows.
  useEffect(() => {
    if (!playing) return;
    intervalRef.current = setInterval(() => {
      setFrame((f) => {
        if (f >= BOOK_FRAME_COUNT) {
          clearInterval(intervalRef.current);
          setPlaying(false);
          return BOOK_FRAME_COUNT;
        }
        return f + 1;
      });
    }, BOOK_PLAYBACK_SPEED_MS);
    return () => clearInterval(intervalRef.current);
  }, [playing]);

  // Whichever layout, the moment either flow enters "open": reset to
  // frame 1 and re-arm the shake+grow intro.
  useEffect(() => {
    const justOpened = (!isMobile && desktopPhase === "open") || (isMobile && mobilePhase === "open");
    if (!justOpened) return;
    setFrame(1);
    setPlaying(false);
    setIntroDone(false);
  }, [desktopPhase, mobilePhase, isMobile]);

  // Auto-start playback only once BOTH the intro has had time to play
  // AND every frame is confirmed cached. Gating on pageAssetsReady is
  // what stops the flipbook from ever racing ahead of the network and
  // popping/resizing mid-playback. Shared by desktop "open" and mobile
  // "open".
  useEffect(() => {
    const openActive = (!isMobile && desktopPhase === "open") || (isMobile && mobilePhase === "open");
    if (!openActive || !pageAssetsReady) return;
    introTimeoutRef.current = setTimeout(() => {
      setIntroDone(true);
      setPlaying(true);
    }, OPEN_INTRO_DURATION * 1000);
    return () => clearTimeout(introTimeoutRef.current);
  }, [desktopPhase, mobilePhase, isMobile, pageAssetsReady]);

  // Mobile only: once the tilt-to-landscape prompt has held for
  // MOBILE_TILT_PROMPT_DURATION, hand off to the flipbook — but never
  // before the frames are actually cached, so playback can't race ahead
  // of the network on a slow connection.
  useEffect(() => {
    if (mobilePhase !== "tilt") return;
    clearTimeout(tiltTimeoutRef.current);
    const tryOpen = () => {
      if (pageAssetsReady) {
        setMobilePhase("open");
      } else {
        tiltTimeoutRef.current = setTimeout(tryOpen, 150);
      }
    };
    tiltTimeoutRef.current = setTimeout(tryOpen, MOBILE_TILT_PROMPT_DURATION);
    return () => clearTimeout(tiltTimeoutRef.current);
  }, [mobilePhase, pageAssetsReady]);

  // Ink reveal: once a book's flipbook reaches its final frame, wait for
  // the final grow to settle and then fade frame 22 in on top of it.
  // Resets the moment we leave the final frame. Shared by desktop and
  // mobile now that both flows do the same grow.
  useEffect(() => {
    clearTimeout(inkTimeoutRef.current);
    if (frame < BOOK_FRAME_COUNT) {
      setInkVisible(false);
      return;
    }
    const openActive = (!isMobile && desktopPhase === "open") || (isMobile && mobilePhase === "open");
    if (!openActive) return;
    inkTimeoutRef.current = setTimeout(() => setInkVisible(true), INK_START_DELAY_MS);
    return () => clearTimeout(inkTimeoutRef.current);
  }, [frame, desktopPhase, mobilePhase, isMobile]);

  // Lock page scroll while any overlay flow is open (desktop's frameless
  // open, or any of mobile's alert/tilt/open steps).
  useEffect(() => {
    const locked = desktopPhase === "open" || mobilePhase !== "idle";
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [desktopPhase, mobilePhase]);

  // ----- desktop handlers -----
  const handleHotspotClick = (index) => {
    setActiveBookIndex(index);
    setDesktopPhase("alert");
  };
  const handleAlertClose = () => {
    setDesktopPhase("idle");
    setActiveBookIndex(null);
  };
  const handleAlertImageClick = () => setDesktopPhase("open");
  const handleOpenClose = () => {
    setDesktopPhase("idle");
    setActiveBookIndex(null);
    setLightboxOpen(false);
  };
  const handlePrevProjectImage = (count) =>
    setProjectImageIndex((i) => (i - 1 + count) % count);
  const handleNextProjectImage = (count) =>
    setProjectImageIndex((i) => (i + 1) % count);

  // ----- mobile handlers -----
  const handleMobileHotspotClick = (index) => {
    setActiveBookIndex(index);
    setMobilePhase("alert");
  };
  const handleMobileAlertClose = () => {
    setMobilePhase("idle");
    setActiveBookIndex(null);
  };
  const handleMobileAlertImageClick = () => {
    setMobilePhase("tilt");
  };
  const handleMobileOpenClose = () => {
    clearInterval(intervalRef.current);
    setPlaying(false);
    setMobilePhase("idle");
    setActiveBookIndex(null);
    setLightboxOpen(false);
  };

  const activeBook = activeBookIndex !== null ? BOOKS[activeBookIndex] : null;

  const sparkleContextOpen = isMobile ? mobilePhase === "open" : desktopPhase === "open";
  const sparkles = useMemo(() => (sparkleContextOpen ? makeSparkles(SPARKLE_COUNT) : []), [sparkleContextOpen]);

  const navHeight = isMobile ? MOBILE_NAV_HEIGHT : NAV_HEIGHT;
  const navLogoSize = isMobile ? MOBILE_NAV_LOGO_SIZE : NAV_LOGO_SIZE;
  const backgroundGif = theme === "light" ? LIGHT_BG_GIF : DARK_BG_GIF;
  const isLight = theme === "light";

  const sideImageSrc =
    activeBookIndex !== null ? ALT_SIDE_IMAGE_PATH(activeBookIndex + 1) : SIDE_IMAGE_SRC;
  const sideImageSize = isMobile ? MOBILE_SIDE_IMAGE_SIZE : SIDE_IMAGE_SIZE;
  const sideImageTop = isMobile ? MOBILE_SIDE_IMAGE_TOP : SIDE_IMAGE_TOP;
  const sideImageLeft = isMobile ? MOBILE_SIDE_IMAGE_LEFT : SIDE_IMAGE_LEFT;

  // All hotspots hide together while any flow is active; they all
  // reappear once we're back to idle on that layout.
  const showHotspots = isMobile ? mobilePhase === "idle" : desktopPhase === "idle";

  // Position vars for the pinned "top of screen" ✕, independent per
  // layout — shared by desktop's open overlay and mobile's tilt/open.
  const closeTopOffset = isMobile ? MOBILE_OPEN_CLOSE_TOP_OFFSET : OPEN_CLOSE_TOP_OFFSET;
  const closeLeftPct = isMobile ? MOBILE_OPEN_CLOSE_LEFT_PCT : OPEN_CLOSE_LEFT_PCT;
  const pinnedCloseStyle = {
    "--nav-height": `${navHeight}px`,
    "--open-close-top-offset": `${closeTopOffset}px`,
    "--open-close-left": `${closeLeftPct}%`,
  };

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          background: #000;
        }

        .bg-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
          z-index: 0;
        }

        .bg-gif {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        /* ===== NAVBAR — mirrors Home.jsx exactly ===== */
        .navbar {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          height: var(--nav-height);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 24px;
          z-index: 30;
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          background: var(--nav-bg);
          border-bottom: 1px solid var(--nav-border);
          transition: background 0.4s ease, border-color 0.4s ease;
        }

        .navbar-logo {
          height: var(--logo-size);
          width: auto;
          display: block;
          transition: height 0.2s ease;
        }

        .navbar-tabs {
          display: flex;
          align-items: center;
          gap: 28px;
          list-style: none;
        }

        .navbar-tab {
          font-size: 15px;
          font-weight: 500;
          color: var(--nav-text);
          text-decoration: none;
          opacity: 0.85;
          position: relative;
          padding: 4px 2px;
          transition: opacity 0.25s ease, color 0.4s ease;
        }

        .navbar-tab:hover { opacity: 1; }

        .navbar-tab::after {
          content: "";
          position: absolute;
          left: 0;
          bottom: -2px;
          width: 0%;
          height: 2px;
          background: var(--nav-accent);
          transition: width 0.25s ease;
        }

        .navbar-tab:hover::after { width: 100%; }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        .theme-toggle {
          position: relative;
          width: 52px;
          height: 28px;
          border-radius: 999px;
          border: 1px solid var(--nav-border);
          background: var(--toggle-track-bg);
          cursor: pointer;
          transition: background 0.4s ease, border-color 0.4s ease;
          flex-shrink: 0;
        }

        .theme-toggle-knob {
          position: absolute;
          top: 2px;
          left: var(--knob-left);
          width: 22px;
          height: 22px;
          border-radius: 50%;
          background: var(--toggle-knob-bg);
          display: flex;
          align-items: center;
          justify-content: center;
          transition: left 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), background 0.4s ease;
          box-shadow: 0 1px 4px rgba(0,0,0,0.35);
        }

        .theme-toggle-knob svg { width: 13px; height: 13px; }

        .hamburger-btn {
          width: 40px;
          height: 40px;
          border-radius: 10px;
          border: 1.5px solid var(--nav-accent);
          background: var(--nav-bg);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 5px;
          cursor: pointer;
          flex-shrink: 0;
        }

        .hamburger-line {
          width: 20px;
          height: 2px;
          border-radius: 2px;
          background: var(--nav-accent);
        }

        .mobile-dropdown {
          position: fixed;
          top: var(--nav-height);
          left: 0;
          right: 0;
          z-index: 29;
          background: var(--nav-bg);
          backdrop-filter: blur(10px);
          -webkit-backdrop-filter: blur(10px);
          border-bottom: 1px solid var(--nav-border);
          padding: 10px 20px 16px;
          display: flex;
          flex-direction: column;
          animation: dropdownFade 0.2s ease-out both;
        }

        @keyframes dropdownFade {
          0% { opacity: 0; transform: translateY(-8px); }
          100% { opacity: 1; transform: translateY(0); }
        }

        .mobile-dropdown-tabs { list-style: none; display: flex; flex-direction: column; }

        .mobile-dropdown-tab {
          display: block;
          padding: 12px 2px;
          font-size: 16px;
          font-weight: 500;
          color: var(--nav-text);
          text-decoration: none;
          border-bottom: 1px solid var(--nav-border);
        }

        .mobile-dropdown-theme {
          margin-top: 10px;
          padding: 10px 2px;
          background: none;
          border: none;
          text-align: left;
          font-size: 15px;
          font-weight: 600;
          color: var(--nav-accent);
          cursor: pointer;
        }
        /* ===== END NAVBAR ===== */

        /* ===== SIDE IMAGE ===== */
        .side-image {
          position: fixed;
          width: var(--side-size);
          height: auto;
          transform: translate(-50%, -50%);
          z-index: 2;
          pointer-events: none;
          transition: opacity 0.3s ease;
        }

        /* ===== CLICKABLE HOTSPOT =====
           No border/outline at rest (or on hover) and no debug number —
           the only affordance is a soft gold glow on hover, identical on
           desktop and mobile. */
        .hotspot {
          position: fixed;
          width: var(--hotspot-width);
          height: var(--hotspot-height);
          transform: translate(-50%, -50%);
          z-index: 3;
          cursor: pointer;
          border-radius: 14px;
          background: transparent;
          border: none;
          transition: background 0.3s ease, box-shadow 0.3s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }
        .hotspot-hint {
          box-shadow: none;
        }
        .hotspot:hover {
          background: rgba(242, 200, 105, 0.08);
          box-shadow: 0 0 26px rgba(242, 200, 105, 0.25);
        }

        /* ===== DEBUG: visible hotspot outlines + numbers =====
           Toggled by DEBUG_HOTSPOTS. Always-on dashed outline + number
           so you can see every hotspot's position/size at a glance, and
           a solid highlight on hover so you can confirm the exact hit
           area under your cursor/finger. Only applies while
           DEBUG_HOTSPOTS is true — leave it false for the real gold-glow
           only look. */
        .hotspot-debug {
          border: 2px dashed rgba(255, 70, 70, 0.9);
          background: rgba(255, 70, 70, 0.10);
        }
        .hotspot-debug:hover {
          border: 2px solid rgba(80, 230, 130, 0.95);
          background: rgba(80, 230, 130, 0.22);
          box-shadow: 0 0 22px rgba(80, 230, 130, 0.45);
        }
        .hotspot-number {
          pointer-events: none;
          user-select: none;
          font-family: system-ui, -apple-system, sans-serif;
          font-weight: 800;
          font-size: 22px;
          color: #fff;
          text-shadow: 0 1px 3px rgba(0,0,0,0.9), 0 0 10px rgba(0,0,0,0.6);
        }

        /* ===== DESKTOP: ALERT IMAGE (book's 1.png, shaking) ===== */
        .alert-wrap {
          position: fixed;
          top: var(--alert-top);
          left: var(--alert-left);
          z-index: 15;
          transform: translate(-50%, -50%);
          animation: alertShake var(--alert-shake-cycle) ease-in-out infinite;
        }
        @keyframes alertShake {
          0%, 88%, 100% { transform: translate(-50%, -50%) translate(0, 0) rotate(0deg); }
          89% { transform: translate(-50%, -50%) translate(-6px, 0) rotate(-3deg); }
          90% { transform: translate(-50%, -50%) translate(6px, -3px) rotate(3deg); }
          91% { transform: translate(-50%, -50%) translate(-6px, 3px) rotate(-2deg); }
          92% { transform: translate(-50%, -50%) translate(6px, 0) rotate(2deg); }
          93% { transform: translate(-50%, -50%) translate(-4px, -2px) rotate(-1.5deg); }
          94% { transform: translate(-50%, -50%) translate(4px, 2px) rotate(1.5deg); }
          95% { transform: translate(-50%, -50%) translate(-3px, 0) rotate(-1deg); }
          96%, 100% { transform: translate(-50%, -50%) translate(0, 0) rotate(0deg); }
        }

        .alert-image {
          display: block;
          width: var(--alert-size);
          height: auto;
          cursor: pointer;
          border-radius: 6px;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.55)) drop-shadow(0 0 18px rgba(242, 200, 105, 0.45));
        }

        /* Positioned via top/left (% of the alert image's own rendered
           size), both tunable — see ALERT_CLOSE_BTN_TOP_PCT / LEFT_PCT
           above. translate(-50%, -50%) centers the ✕ ON that point. */
        .alert-close-btn {
          position: absolute;
          top: var(--alert-close-top);
          left: var(--alert-close-left);
          transform: translate(-50%, -50%);
          width: var(--alert-close-size);
          height: var(--alert-close-size);
          border-radius: 50%;
          background: #1a1206;
          border: 1.5px solid #f2c869;
          color: #f2c869;
          font-size: 14px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          z-index: 2;
        }

        /* ===== MOBILE: ALERT IMAGE (book's 1.png, near the top) ===== */
        .mobile-alert-wrap {
          position: fixed;
          z-index: 15;
          transform: translate(-50%, -50%);
          animation: alertShake var(--alert-shake-cycle) ease-in-out infinite;
        }

        .mobile-alert-image {
          display: block;
          width: var(--mobile-alert-size);
          height: auto;
          cursor: pointer;
          border-radius: 6px;
          filter: drop-shadow(0 8px 24px rgba(0,0,0,0.55)) drop-shadow(0 0 18px rgba(242, 200, 105, 0.45));
        }

        /* Positioned via top/left (% of the mobile alert image's own
           rendered size), both tunable — see
           MOBILE_ALERT_CLOSE_BTN_TOP_PCT / LEFT_PCT above. */
        .mobile-alert-close-btn {
          position: absolute;
          top: var(--mobile-alert-close-top);
          left: var(--mobile-alert-close-left);
          transform: translate(-50%, -50%);
          width: var(--mobile-alert-close-size);
          height: var(--mobile-alert-close-size);
          border-radius: 50%;
          background: #1a1206;
          border: 1.5px solid #f2c869;
          color: #f2c869;
          font-size: 13px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          z-index: 2;
        }

        /* ===== MOBILE: TILT-TO-LANDSCAPE PROMPT ===== */
        .tilt-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(4, 3, 2, 0.62);
          backdrop-filter: blur(${BACKDROP_BLUR_PX}px);
          -webkit-backdrop-filter: blur(${BACKDROP_BLUR_PX}px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: backdropFade 0.35s ease both;
        }

        .tilt-prompt {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          padding: 0 32px;
          text-align: center;
        }

        .tilt-icon {
          font-size: 46px;
          display: inline-block;
          animation: tiltRock 1.7s ease-in-out infinite;
        }
        @keyframes tiltRock {
          0%, 15% { transform: rotate(0deg); }
          50%, 65% { transform: rotate(90deg); }
          100% { transform: rotate(90deg); }
        }

        .tilt-text {
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 20px;
          color: #f2ece0;
          letter-spacing: 0.3px;
          line-height: 1.5;
        }

        /* ===== DESKTOP + MOBILE: OPEN / FLIPBOOK OVERLAY (frameless) ===== */
        .open-backdrop {
          position: fixed;
          inset: 0;
          z-index: 40;
          background: rgba(4, 3, 2, 0.55);
          backdrop-filter: blur(${BACKDROP_BLUR_PX}px);
          -webkit-backdrop-filter: blur(${BACKDROP_BLUR_PX}px);
          animation: backdropFade 0.35s ease both;
        }
        @keyframes backdropFade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }

        /* Pinned "top of screen" ✕, shared by desktop's open overlay and
           mobile's tilt-prompt + open overlay. Position is driven by
           --open-close-top-offset / --open-close-left, set inline per
           render so desktop and mobile can each have their own spot
           (see OPEN_CLOSE_* / MOBILE_OPEN_CLOSE_* above). */
        .open-close-top {
          position: fixed;
          top: calc(var(--nav-height) + var(--open-close-top-offset, 10px));
          left: var(--open-close-left, 50%);
          transform: translateX(-50%);
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #1a1206;
          border: 1.5px solid #f2c869;
          color: #f2c869;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 45;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        }

        .open-image-wrap {
          position: fixed;
          top: 50%;
          left: 50%;
          width: var(--open-width);
          height: var(--open-height);
          transform: translate(-50%, -50%);
          z-index: 42;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Mobile's flipbook is rotated 90° so it reads correctly once
           the phone itself is turned sideways — the wrap's own
           width/height are already sized against the viewport (see
           MOBILE_OPEN_FIT_* / the inline --open-width/height above) so
           rotating it in place fills the screen edge-to-edge. */
        .open-image-wrap-mobile {
          transform: translate(-50%, -50%) rotate(90deg);
        }

        .open-image-glow {
          position: absolute;
          inset: 8%;
          border-radius: 50%;
          background: radial-gradient(ellipse at center, rgba(242, 200, 105, 0.25) 0%, rgba(242, 200, 105, 0) 70%);
          pointer-events: none;
          animation: glowPulseBox 3s ease-in-out infinite;
          z-index: 1;
        }
        @keyframes glowPulseBox {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }

        /* Wrapper that's locked to the page image's fit-to-box render
           size (set inline via --page-w/--page-h, computed once in JS
           from the preloaded image's natural dimensions) — so the ink
           overlay riding inside it lines up pixel-for-pixel with the
           artwork and NEVER resizes between frames. All entrance/
           settle/final-grow motion lives here, so it scales and floats
           as one rigid unit instead of reflowing per frame. */
        .open-image-frame {
          position: relative;
          display: block;
          width: var(--page-w, auto);
          height: var(--page-h, auto);
          line-height: 0;
          z-index: 2;
          animation: openImageIntro var(--intro-duration) ease-out both;
        }
        .open-image-frame.open-image-frame-settled {
          animation: openImageFloat var(--float-duration) ease-in-out infinite;
        }
        /* Landed on the final frame: slowly grow larger and hold there —
           replaces the bob entirely, since it should read as "settling
           into its full size" rather than continuing to float. The
           scale itself is independent per layout via --final-grow-scale
           (desktop uses OPEN_FINAL_GROW_SCALE, mobile uses
           MOBILE_OPEN_FINAL_GROW_SCALE). */
        .open-image-frame.open-image-frame-final {
          animation: openImageFinalGrow var(--final-grow-duration) cubic-bezier(0.22, 1, 0.36, 1) both;
        }

        .open-image {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: contain;
          filter: drop-shadow(0 10px 30px rgba(0,0,0,0.6)) drop-shadow(0 0 30px rgba(242, 200, 105, 0.35));
        }
        @keyframes openImageIntro {
          0% { opacity: 0; transform: scale(0.15) rotate(0deg); }
          35% { opacity: 1; transform: scale(1.12) rotate(-6deg); }
          50% { transform: scale(1.05) rotate(6deg); }
          65% { transform: scale(1.08) rotate(-4deg); }
          80% { transform: scale(0.98) rotate(3deg); }
          100% { opacity: 1; transform: scale(1) rotate(0deg); }
        }
        @keyframes openImageFloat {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(calc(-1 * var(--float-distance))); }
        }
        @keyframes openImageFinalGrow {
          0% { transform: scale(1); }
          100% { transform: scale(var(--final-grow-scale)); }
        }

        .open-hint {
          position: absolute;
          bottom: 4%;
          left: 50%;
          transform: translateX(-50%);
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 14px;
          color: #d9b979;
          white-space: nowrap;
          z-index: 2;
        }

        /* ===== SHARED: sparkle dots ===== */
        .book-sparkle {
          position: absolute;
          border-radius: 50%;
          background: radial-gradient(circle, ${SPARKLE_COLOR_CORE} 0%, ${SPARKLE_COLOR_EDGE} 60%, transparent 80%);
          transform: translate(-50%, -50%);
          pointer-events: none;
          opacity: 0;
          animation: sparkleTwinkle var(--sparkle-duration) ease-in-out var(--sparkle-delay) infinite;
        }
        @keyframes sparkleTwinkle {
          0%, 100% { opacity: 0; transform: translate(-50%, -50%) scale(0.4); }
          50% { opacity: 1; transform: translate(-50%, -50%) scale(1.15); }
        }

        /* ===== SHARED: ink reveal (frame 22) =====
           Sits absolutely inside whichever *-frame wrapper holds the
           current page image, so it always matches that image's own
           locked render size exactly — including through the final
           grow, since the frame (not the img) carries that scale.
           Plain opacity fade from nothing up to fully shown. */
        .ink-overlay {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: fill;
          z-index: 3;
          pointer-events: none;
          opacity: 0;
          transition: opacity ${INK_FADE_DURATION}s ease-in;
        }
        .ink-overlay.ink-overlay-visible {
          opacity: 1;
        }

        /* ===== PROJECT-IMAGES SCROLL PANEL — shared look for desktop +
           mobile. Only the wrapper (.project-images-panel vs
           .project-images-panel-mobile) differs in how it's rotated. ===== */
        .project-images-panel,
        .project-images-panel-mobile {
          position: fixed;
          top: var(--panel-top);
          left: var(--panel-left);
          width: var(--panel-width);
          height: var(--panel-height);
          z-index: 46;
          background: rgba(20, 14, 6, 0.55);
          border: 1px solid rgba(242, 200, 105, 0.35);
          border-radius: 14px;
          backdrop-filter: blur(6px);
          -webkit-backdrop-filter: blur(6px);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 16px 14px 12px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
          animation: backdropFade 0.5s ease both;
        }

        /* Desktop: just the requested tilt. */
        .project-images-panel {
          transform: translate(-50%, -50%) rotate(var(--panel-rotation, 0deg));
          transform-origin: center center;
        }

        /* Mobile: base 90° (so it reads correctly once the phone is
           physically turned sideways, same trick as .open-image-wrap-
           mobile) PLUS whatever extra tiltDeg the book asks for. */
        .project-images-panel-mobile {
          transform: translate(-50%, -50%) rotate(calc(90deg + var(--panel-rotation, 0deg)));
          transform-origin: center center;
        }

        .project-images-frame {
          position: relative;
          width: 100%;
          flex: 1;
          min-height: 0;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .project-images-img {
          max-width: 100%;
          max-height: 100%;
          object-fit: contain;
          border-radius: 8px;
          display: block;
        }

        .project-images-nav-btn {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: #1a1206;
          border: 1.5px solid #f2c869;
          color: #f2c869;
          font-size: 16px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
          box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        }
        .project-images-nav-prev { left: 6px; }
        .project-images-nav-next { right: 6px; }

        .project-images-count {
          margin-top: 10px;
          font-family: 'Georgia', serif;
          font-style: italic;
          font-size: 13px;
          color: #d9b979;
          letter-spacing: 0.3px;
        }

        /* ===== MAGNIFY ICON — sits on top of the current project-images
           thumbnail, desktop + mobile panels alike ===== */
        .magnify-btn {
          position: absolute;
          top: var(--magnify-top);
          left: var(--magnify-left);
          transform: translate(-50%, -50%);
          width: var(--magnify-size);
          height: var(--magnify-size);
          border-radius: 50%;
          background: rgba(26, 18, 6, 0.75);
          border: 1.5px solid #f2c869;
          color: #f2c869;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 4;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
          animation: backdropFade 0.4s ease both;
        }
        .magnify-btn svg {
          width: 58%;
          height: 58%;
        }

        /* ===== LIGHTBOX — expanded project-images thumbnail ===== */
        .lightbox-backdrop {
          position: fixed;
          inset: 0;
          z-index: 60;
          background: rgba(2, 2, 1, 0.78);
          backdrop-filter: blur(14px);
          -webkit-backdrop-filter: blur(14px);
          display: flex;
          align-items: center;
          justify-content: center;
          animation: backdropFade 0.25s ease both;
        }

        .lightbox-close-btn {
          position: fixed;
          top: calc(var(--nav-height) + 10px);
          right: 20px;
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #1a1206;
          border: 1.5px solid #f2c869;
          color: #f2c869;
          font-size: 18px;
          line-height: 1;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 61;
          box-shadow: 0 4px 14px rgba(0,0,0,0.5);
        }

        .lightbox-image {
          display: block;
          max-width: var(--lightbox-max-w);
          max-height: var(--lightbox-max-h);
          width: auto;
          height: auto;
          object-fit: contain;
          border-radius: 10px;
          box-shadow: 0 20px 60px rgba(0,0,0,0.6);
        }
      `}</style>

      <div className="bg-page">
        <img src={backgroundGif} alt="" className="bg-gif" />
      </div>

      <nav
        className="navbar"
        style={{
          "--nav-height": `${navHeight}px`,
          "--nav-bg": isLight ? "rgba(255, 255, 255, 0.55)" : "rgba(10, 8, 6, 0.45)",
          "--nav-border": isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)",
          "--nav-text": isLight ? "#20180f" : "#f2ece0",
          "--nav-accent": isLight ? "#b8862f" : "#f2c869",
          "--toggle-track-bg": isLight ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
          "--toggle-knob-bg": isLight ? "#20180f" : "#f2c869",
          "--knob-left": isLight ? "2px" : "26px",
        }}
      >
        <a href="/" className="navbar-logo-link" style={{ display: "flex", alignItems: "center" }}>
          <img
            src={NAV_LOGO_SRC}
            alt="Logo"
            className="navbar-logo"
            style={{ "--logo-size": `${navLogoSize}px` }}
          />
        </a>

        {!isMobile && (
          <ul className="navbar-tabs">
            {NAV_TABS.map((tab) => (
              <li key={tab.label}>
                <a href={tab.href} className="navbar-tab">{tab.label}</a>
              </li>
            ))}
          </ul>
        )}

        <div className="navbar-right">
          {!isMobile && (
            <button
              type="button"
              className="theme-toggle"
              aria-label={isLight ? "Switch to dark mode" : "Switch to light mode"}
              onClick={() => setTheme(isLight ? "dark" : "light")}
            >
              <span className="theme-toggle-knob">
                {isLight ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="4" />
                    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="#1a1206">
                    <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" />
                  </svg>
                )}
              </span>
            </button>
          )}

          {isMobile && (
            <button
              type="button"
              className="hamburger-btn"
              aria-label={isMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={isMenuOpen}
              onClick={() => setIsMenuOpen((v) => !v)}
            >
              <span className="hamburger-line" />
              <span className="hamburger-line" />
              <span className="hamburger-line" />
            </button>
          )}
        </div>
      </nav>

      {isMobile && isMenuOpen && (
        <div
          className="mobile-dropdown"
          style={{
            "--nav-height": `${navHeight}px`,
            "--nav-bg": isLight ? "rgba(255, 255, 255, 0.9)" : "rgba(10, 8, 6, 0.92)",
            "--nav-border": isLight ? "rgba(0, 0, 0, 0.08)" : "rgba(255, 255, 255, 0.1)",
            "--nav-text": isLight ? "#20180f" : "#f2ece0",
            "--nav-accent": isLight ? "#b8862f" : "#f2c869",
          }}
        >
          <ul className="mobile-dropdown-tabs">
            {NAV_TABS.map((tab) => (
              <li key={tab.label}>
                <a href={tab.href} className="mobile-dropdown-tab" onClick={() => setIsMenuOpen(false)}>
                  {tab.label}
                </a>
              </li>
            ))}
          </ul>
          <button
            type="button"
            className="mobile-dropdown-theme"
            onClick={() => setTheme(isLight ? "dark" : "light")}
          >
            Switch to {isLight ? "dark" : "light"} mode
          </button>
        </div>
      )}

      {/* ===== SIDE IMAGE — swaps to that book's ALT_SIDE_IMAGE_PATH once any flow starts, on both layouts ===== */}
      <img
        src={sideImageSrc}
        alt=""
        className="side-image"
        style={{
          top: sideImageTop,
          left: sideImageLeft,
          "--side-size": `${sideImageSize}px`,
        }}
      />

      {/* ===== CLICKABLE HOTSPOTS — one per book, hidden while any flow is active =====
          When DEBUG_HOTSPOTS is true, each renders with a visible dashed
          outline + its number (1..7), and swaps to a solid green
          highlight on hover so you can see exactly what you're pointing
          at. Set DEBUG_HOTSPOTS to false above once you're happy with
          the positions — that's the current state, so hotspots render
          fully invisible until hovered, with just the gold glow. */}
      {showHotspots && BOOKS.map((book, index) => {
        const hs = isMobile ? book.mobileHotspot : book.hotspot;
        return (
          <div
            key={book.id}
            className={`hotspot ${HOTSPOT_SHOW_HINT ? "hotspot-hint" : ""} ${DEBUG_HOTSPOTS ? "hotspot-debug" : ""}`}
            style={{
              top: hs.top,
              left: hs.left,
              "--hotspot-width": `${hs.width}px`,
              "--hotspot-height": `${hs.height}px`,
            }}
            onClick={() => (isMobile ? handleMobileHotspotClick(index) : handleHotspotClick(index))}
            role="button"
            tabIndex={0}
            aria-label={`Open ${book.id}`}
          >
            {DEBUG_HOTSPOTS && <span className="hotspot-number">{index + 1}</span>}
          </div>
        );
      })}

      {/* ===== DESKTOP: shaking alert image (active book's 1.png) ===== */}
      {!isMobile && desktopPhase === "alert" && activeBook && (
        <div
          className="alert-wrap"
          style={{
            "--alert-top": activeBook.alert.top,
            "--alert-left": activeBook.alert.left,
            "--alert-size": `${activeBook.alert.size}px`,
            "--alert-shake-cycle": `${ALERT_SHAKE_CYCLE}s`,
            "--alert-close-size": `${ALERT_CLOSE_BTN_SIZE}px`,
            "--alert-close-top": `${ALERT_CLOSE_BTN_TOP_PCT}%`,
            "--alert-close-left": `${ALERT_CLOSE_BTN_LEFT_PCT}%`,
          }}
        >
          <button
            type="button"
            className="alert-close-btn"
            onClick={handleAlertClose}
            aria-label="Dismiss"
          >
            ✕
          </button>
          <img
            src={BOOK_IMAGE_PATH(activeBook.folder, 1)}
            alt="A mysterious page"
            className="alert-image"
            onClick={handleAlertImageClick}
            draggable={false}
          />
        </div>
      )}

      {/* ===== DESKTOP: frameless blurred flipbook overlay ===== */}
      {!isMobile && desktopPhase === "open" && activeBook && (
        <div className="open-backdrop">
          <button
            type="button"
            className="open-close-top"
            style={pinnedCloseStyle}
            onClick={handleOpenClose}
            aria-label="Close"
          >
            ✕
          </button>

          <div
            className="open-image-wrap"
            style={{
              "--open-width": `${OPEN_BOX_WIDTH}px`,
              "--open-height": `${OPEN_BOX_HEIGHT}px`,
            }}
          >
            <div className="open-image-glow" />
            {sparkles.map((s) => (
              <BookSparkle key={s.id} top={s.top} left={s.left} size={s.size} duration={s.duration} delay={s.delay} />
            ))}

            <span
              className={`open-image-frame ${
                frame >= BOOK_FRAME_COUNT ? "open-image-frame-final" : introDone ? "open-image-frame-settled" : ""
              }`}
              style={{
                "--intro-duration": `${OPEN_INTRO_DURATION}s`,
                "--float-duration": `${OPEN_FLOAT_DURATION}s`,
                "--float-distance": `${OPEN_FLOAT_DISTANCE}px`,
                "--final-grow-scale": OPEN_FINAL_GROW_SCALE,
                "--final-grow-duration": `${OPEN_FINAL_GROW_DURATION}s`,
                "--page-w": pageImageStyle.width,
                "--page-h": pageImageStyle.height,
                maxWidth: pageRenderSize ? undefined : pageImageStyle.maxWidth,
                maxHeight: pageRenderSize ? undefined : pageImageStyle.maxHeight,
              }}
            >
              <img
                src={BOOK_IMAGE_PATH(activeBook.folder, frame)}
                alt={`Page ${frame}`}
                className="open-image"
                draggable={false}
              />
              <InkOverlay
                src={INK_IMAGE_PATH(activeBook.folder)}
                visible={inkVisible}
              />
            </span>

          </div>

          {/* ===== DESKTOP: project-images scroll panel — only once the
              22.png ink reveal is visible, and only for books that have
              extra images configured (projectImagesCount > 0). ===== */}
          {inkVisible && activeBook.projectImagesCount > 0 && (
            <div
              className="project-images-panel"
              style={{
                "--panel-top": activeBook.projectImagesPanel?.top ?? PROJECT_IMAGES_PANEL_TOP,
                "--panel-left": activeBook.projectImagesPanel?.left ?? PROJECT_IMAGES_PANEL_LEFT,
                "--panel-width": `${activeBook.projectImagesPanel?.width ?? PROJECT_IMAGES_PANEL_WIDTH}px`,
                "--panel-height": `${activeBook.projectImagesPanel?.height ?? PROJECT_IMAGES_PANEL_HEIGHT}px`,
                "--panel-rotation": `${
                  activeBook.projectImagesPanel?.tiltDeg ?? PROJECT_IMAGES_PANEL_ROTATION_DEG
                }deg`,
              }}
            >
              <ProjectImagesPanelBody
                activeBook={activeBook}
                projectImageIndex={projectImageIndex}
                onPrev={() => handlePrevProjectImage(activeBook.projectImagesCount)}
                onNext={() => handleNextProjectImage(activeBook.projectImagesCount)}
                onMagnify={() => setLightboxOpen(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* ===== MOBILE: alert image (active book's 1.png, near the top) ===== */}
      {isMobile && mobilePhase === "alert" && activeBook && (
        <div
          className="mobile-alert-wrap"
          style={{
            top: activeBook.mobileAlert.top,
            left: activeBook.mobileAlert.left,
            "--mobile-alert-size": `${activeBook.mobileAlert.size}px`,
            "--mobile-alert-close-size": `${MOBILE_ALERT_CLOSE_BTN_SIZE}px`,
            "--mobile-alert-close-top": `${MOBILE_ALERT_CLOSE_BTN_TOP_PCT}%`,
            "--mobile-alert-close-left": `${MOBILE_ALERT_CLOSE_BTN_LEFT_PCT}%`,
            "--alert-shake-cycle": `${ALERT_SHAKE_CYCLE}s`,
          }}
        >
          <button
            type="button"
            className="mobile-alert-close-btn"
            onClick={handleMobileAlertClose}
            aria-label="Dismiss"
          >
            ✕
          </button>
          <img
            src={BOOK_IMAGE_PATH(activeBook.folder, 1)}
            alt="A mysterious page"
            className="mobile-alert-image"
            onClick={handleMobileAlertImageClick}
            draggable={false}
          />
        </div>
      )}

      {/* ===== MOBILE: tilt-to-landscape prompt ===== */}
      {isMobile && mobilePhase === "tilt" && (
        <div className="tilt-backdrop">
          <button
            type="button"
            className="open-close-top"
            style={pinnedCloseStyle}
            onClick={handleMobileOpenClose}
            aria-label="Close"
          >
            ✕
          </button>
          <div className="tilt-prompt">
            <span className="tilt-icon">📱</span>
            <p className="tilt-text">Tilt your phone to landscape…</p>
          </div>
        </div>
      )}

      {/* ===== MOBILE: rotated flipbook overlay (mirrors desktop's open phase) ===== */}
      {isMobile && mobilePhase === "open" && activeBook && (
        <div className="open-backdrop">
          <button
            type="button"
            className="open-close-top"
            style={pinnedCloseStyle}
            onClick={handleMobileOpenClose}
            aria-label="Close"
          >
            ✕
          </button>

          <div
            className="open-image-wrap open-image-wrap-mobile"
            style={{
              "--open-width": `${viewport.h * MOBILE_OPEN_FIT_HEIGHT_RATIO}px`,
              "--open-height": `${viewport.w * MOBILE_OPEN_FIT_WIDTH_RATIO}px`,
            }}
          >
            <div className="open-image-glow" />
            {sparkles.map((s) => (
              <BookSparkle key={s.id} top={s.top} left={s.left} size={s.size} duration={s.duration} delay={s.delay} />
            ))}

            <span
              className={`open-image-frame ${
                frame >= BOOK_FRAME_COUNT ? "open-image-frame-final" : introDone ? "open-image-frame-settled" : ""
              }`}
              style={{
                "--intro-duration": `${OPEN_INTRO_DURATION}s`,
                "--float-duration": `${OPEN_FLOAT_DURATION}s`,
                "--float-distance": `${OPEN_FLOAT_DISTANCE}px`,
                "--final-grow-scale": MOBILE_OPEN_FINAL_GROW_SCALE,
                "--final-grow-duration": `${OPEN_FINAL_GROW_DURATION}s`,
                "--page-w": pageImageStyle.width,
                "--page-h": pageImageStyle.height,
                maxWidth: pageRenderSize ? undefined : pageImageStyle.maxWidth,
                maxHeight: pageRenderSize ? undefined : pageImageStyle.maxHeight,
              }}
            >
              <img
                src={BOOK_IMAGE_PATH(activeBook.folder, frame)}
                alt={`Page ${frame}`}
                className="open-image"
                draggable={false}
              />
              <InkOverlay
                src={INK_IMAGE_PATH(activeBook.folder)}
                visible={inkVisible}
              />
            </span>

          </div>

          {/* ===== MOBILE: project-images scroll panel — mirrors the
              desktop one, but rendered landscape (width > height) and
              carrying the base 90° rotation so it reads correctly once
              the phone is physically turned sideways, just like the
              flipbook itself. Same gating: ink reveal up + this book
              has extra images configured. ===== */}
          {inkVisible && activeBook.projectImagesCount > 0 && (
            <div
              className="project-images-panel-mobile"
              style={{
                "--panel-top": activeBook.projectImagesPanelMobile?.top ?? PROJECT_IMAGES_PANEL_MOBILE_TOP,
                "--panel-left": activeBook.projectImagesPanelMobile?.left ?? PROJECT_IMAGES_PANEL_MOBILE_LEFT,
                "--panel-width": `${activeBook.projectImagesPanelMobile?.width ?? PROJECT_IMAGES_PANEL_MOBILE_WIDTH}px`,
                "--panel-height": `${activeBook.projectImagesPanelMobile?.height ?? PROJECT_IMAGES_PANEL_MOBILE_HEIGHT}px`,
                "--panel-rotation": `${
                  activeBook.projectImagesPanelMobile?.tiltDeg ?? PROJECT_IMAGES_PANEL_MOBILE_ROTATION_DEG
                }deg`,
              }}
            >
              <ProjectImagesPanelBody
                activeBook={activeBook}
                projectImageIndex={projectImageIndex}
                onPrev={() => handlePrevProjectImage(activeBook.projectImagesCount)}
                onNext={() => handleNextProjectImage(activeBook.projectImagesCount)}
                onMagnify={() => setLightboxOpen(true)}
              />
            </div>
          )}
        </div>
      )}

      {/* ===== LIGHTBOX — expanded view of whichever project-images
          thumbnail (1.png, 2.png, ...) the magnify icon was clicked on,
          from either the desktop or mobile panel. Always rendered
          upright/unrotated so it's readable without needing to
          physically turn the phone. ===== */}
      {lightboxOpen && activeBook && (
        <div className="lightbox-backdrop" onClick={() => setLightboxOpen(false)}>
          <button
            type="button"
            className="lightbox-close-btn"
            style={{ "--nav-height": `${navHeight}px` }}
            onClick={(e) => {
              e.stopPropagation();
              setLightboxOpen(false);
            }}
            aria-label="Close"
          >
            ✕
          </button>
          <img
            src={PROJECT_IMAGES_PATH(activeBook.folder, projectImageIndex + 1)}
            alt={`Expanded view — ${activeBook.id} project image ${projectImageIndex + 1}`}
            className="lightbox-image"
            style={{
              "--lightbox-max-w": `${viewport.w * LIGHTBOX_MAX_WIDTH_RATIO}px`,
              "--lightbox-max-h": `${viewport.h * LIGHTBOX_MAX_HEIGHT_RATIO}px`,
            }}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>

  );
}