import { useState, useEffect, useRef, useCallback, useMemo } from "react";

/* =====================================================================
   ABOUT ME - enchanted-parchment / wizarding-academy styled page
   =====================================================================
   Fill-in-the-blanks before shipping:
   - DARK_BG_GIF / LIGHT_BG_GIF: drop background.gif and
     background-light.gif into /public (same files Home.jsx uses) - this
     page now shares that fixed, full-viewport gif background instead of
     a plain starfield.
   - NAV_LOGO_SRC: drop logo.png into /public (same navbar as Home.jsx,
     including the light/dark theme toggle).
   - PORTRAIT_IMAGE_COUNT / PORTRAIT_IMAGE_PATH: drop me1.png .. me15.png
     (or however many frames PORTRAIT_IMAGE_COUNT says) into /public. The
     portrait starts on me1 and steps forward through the sequence as the
     person scrolls the hero out of view - driven purely by scroll
     position, no fade, no frame/box around it. Size it yourself with
     PORTRAIT_WIDTH/HEIGHT and MOBILE_PORTRAIT_WIDTH/HEIGHT below.
   - LETTER_IMG_SRC / STAMP_IMG_SRC: drop your letter + stamp images into
     /public and point these at them. Adjust the size/position constants
     below (LETTER_WIDTH, STAMP_WIDTH/HEIGHT, STAMP_TOP/LEFT) to taste.
   - FLAP_IMAGE_PATH / FLAP_BACK_IMAGE_PATH: drop flap1.png..flap10.png and
     flapback1.png..flapback10.png into /public for the skills grid.
   - TALENT_IMG_SRC: drop a single image into /public and point this at
     it. It slides slanted across the full width of the screen, left edge
     to right edge, purely driven by scroll position as this section
     scrolls through view - see TalentSlideSection below.
   - MAP_IMAGE_SRC: drop your map artwork into /public (e.g. map.png) and
     point this at it. Size/position it with MAP_FRAME_MAX_WIDTH,
     MAP_FRAME_ASPECT_RATIO, MAP_IMAGE_FIT, MAP_IMAGE_SCALE, and
     MAP_IMAGE_OFFSET_TOP/LEFT below.
   - TRAVEL_PLACES: replace the placeholder city/age/year entries with
     your real study & travel history (each has a top/left % to place its
     pin on the map image - nudge those to taste).
   - SCROLL_TOP_IMG_SRC / SCROLL_BOTTOM_IMG_SRC: drop your two scroll-bar
     images (e.g. scroll-top.png, scroll-bottom.png) into /public. They
     sit stacked together (touching) until clicked. The pros/cons content
     - including its own background box - lives directly between the two
     bar images: closed, that box has no border/background and zero
     height, so nothing shows between the bars; opening the scroll grows
     the box open along with the content, and only then does the bottom
     bar drop away. The whole section (intro text, the scroll itself, and
     the closing text) is one self-contained component,
     WandmakerSection, below. Size/position everything via the SCROLL_*
     constants below.
   ===================================================================== */

/* ====== THEME / BACKGROUND CONTROLS — mirrors Home.jsx exactly ====== */
const DARK_BG_GIF = "/background.gif";        // used in dark mode
const LIGHT_BG_GIF = "/background-light.gif"; // used in light mode

const PORTRAIT_WIDTH = 320;         // desktop px - set your own width
const PORTRAIT_HEIGHT = 320;        // desktop px - set your own height
const MOBILE_PORTRAIT_WIDTH = 220;  // mobile px - set your own width
const MOBILE_PORTRAIT_HEIGHT = 220; // mobile px - set your own height

// Nudge the portrait's position independently on each breakpoint (it's
// centered by default - these are offsets from that centered position, in
// px). Positive PORTRAIT_OFFSET_LEFT moves it right, positive
// PORTRAIT_OFFSET_TOP moves it down.
const PORTRAIT_OFFSET_TOP = 0;         // px, desktop
const PORTRAIT_OFFSET_LEFT = 0;        // px, desktop
const MOBILE_PORTRAIT_OFFSET_TOP = 0;  // px, mobile
const MOBILE_PORTRAIT_OFFSET_LEFT = 30; // px, mobile

/* ====== SCROLL-SCRUBBED PORTRAIT SEQUENCE ======
   The portrait shows me1 by default. As the hero section scrolls up and
   away (from fully in view to fully scrolled past), the portrait steps
   forward frame-by-frame all the way to me{PORTRAIT_IMAGE_COUNT}. Frames
   swap instantly (no fade) and it only ever changes in response to actual
   scroll position - never on a timer, hover, or click. */
const PORTRAIT_IMAGE_COUNT = 15;                          // me1 .. me15
const PORTRAIT_IMAGE_PATH = (frame) => `/me${frame}.png`; // <-- drop me1.png .. me15.png into /public

/* ====== LETTER + STAMP CONTROLS ======
   These are two SEPARATE floating images that overlap on top of the
   envelope/scroll - they aren't tied to the envelope's box or background.
   Position each one independently with its own TOP/LEFT (% relative to
   the .envelope box, 0%/0% = top-left corner, 50%/50% = dead centre) and
   size it with its own WIDTH/HEIGHT.
   Clicking the stamp: (1) stamp slides up & fades away, (2) letter
   image fades out, (3) the scroll/content underneath unrolls. */
const LETTER_IMG_SRC = "/letter.png";       // <-- drop your letter art here
const LETTER_WIDTH = 660;                    // desktop px
const LETTER_HEIGHT = 520;                   // desktop px
const MOBILE_LETTER_WIDTH = 450;             // mobile px
const MOBILE_LETTER_HEIGHT = 350;            // mobile px
const LETTER_TOP = "50%";                    // position within the envelope
const LETTER_LEFT = "50%";                   // (top/left are % of the envelope box)

const STAMP_IMG_SRC = "/stamp.png";          // <-- drop your stamp art here
const STAMP_WIDTH = 100;                      // desktop px
const STAMP_HEIGHT = 100;                     // desktop px
const MOBILE_STAMP_WIDTH = 74;               // mobile px
const MOBILE_STAMP_HEIGHT = 74;              // mobile px
const STAMP_TOP = "50%";                     // position within the envelope
const STAMP_LEFT = "50%";                    // (top/left are % of the envelope box, independent of the letter image)

// timing of the click sequence (seconds) - tweak the pacing here
const STAMP_SLIDE_DURATION = 0.5;   // how long the stamp takes to slide away
const LETTER_FADE_DURATION = 0.6;   // how long the letter takes to fade out
const LETTER_FADE_DELAY = STAMP_SLIDE_DURATION; // letter waits for stamp to finish
const SCROLL_UNROLL_DELAY = STAMP_SLIDE_DURATION + LETTER_FADE_DURATION; // content waits for both

/* ====== NAVBAR CONTROLS - mirrors Home.jsx exactly ====== */
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

const NICKNAMES = ["Hasini", "H", "Hasi", "Hasi the VI"];

/* ====== SKILLS / "FLAP" CARD ARTWORK ======
   Each skill card shows flap{n}.png by default and flips to reveal
   flapback{n}.png on hover (or keyboard focus), where n is the card's
   1-indexed position. Drop flap1.png..flap10.png and flapback1.png..
   flapback10.png into /public. Bump FLAP_COUNT if you add more/fewer. */
const FLAP_COUNT = 10;                                // flap1..flap10
const FLAP_IMAGE_PATH = (n) => `/flap${n}.png`;
const FLAP_BACK_IMAGE_PATH = (n) => `/flapback${n}.png`;

// Card size, set yourself - no border, no box, just the image at this size.
const FLAP_CARD_WIDTH = 140;         // desktop px
const FLAP_CARD_HEIGHT = 140;        // desktop px
const MOBILE_FLAP_CARD_WIDTH = 140;  // mobile px
const MOBILE_FLAP_CARD_HEIGHT = 140; // mobile px
const FLAP_COLUMNS_DESKTOP = 5;      // cards per row, desktop
const FLAP_COLUMNS_MOBILE = 2;       // cards per row, mobile

/* ====== TALENT SLIDE IMAGE ======
   Multiple copies of the same image, placed back to back with no gaps
   (like a filmstrip), slide slanted across the full width of the screen
   as one connected strip - starting flush against the very left edge of
   the screen and ending flush against the very right edge - purely
   driven by scroll position as this section scrolls through view (same
   idea as the portrait sequence in the hero: no timers, no hover, no
   click - just scroll). Drop your artwork into /public and point
   TALENT_IMG_SRC at it. */
const TALENT_IMG_SRC = "/talent.png";   // <-- drop your talent artwork here

const TALENT_IMAGE_WIDTH = 1760;          // desktop px
const TALENT_IMAGE_HEIGHT = 1760;         // desktop px
const MOBILE_TALENT_IMAGE_WIDTH = 860;   // mobile px
const MOBILE_TALENT_IMAGE_HEIGHT = 860;  // mobile px

// How many copies of TALENT_IMG_SRC are placed back to back (touching, no
// gap) to form the strip that slides across the screen.
const TALENT_IMAGE_REPEAT_COUNT = 6;         // desktop
const MOBILE_TALENT_IMAGE_REPEAT_COUNT = 4;  // mobile

const TALENT_SLANT_DEG = 0;            // rotation angle, degrees (negative tilts counter-clockwise)

// Height reserved for the sliding track so the section doesn't collapse.
const TALENT_TRACK_HEIGHT = 320;         // desktop px
const MOBILE_TALENT_TRACK_HEIGHT = 220;  // mobile px

// Vertical position of the strip within its track. 0 keeps it dead-center
// (the old default); positive values push it further down toward the
// bottom of the track.
const TALENT_VERTICAL_OFFSET = 90;         // desktop px
const MOBILE_TALENT_VERTICAL_OFFSET = 60;  // mobile px

/* ====== MAP IMAGE CONTROLS ======
   The map is your own artwork (drop it into /public and point
   MAP_IMAGE_SRC at it) rather than a drawn shape. MAP_FRAME_MAX_WIDTH /
   MAP_FRAME_ASPECT_RATIO control the size of the box the image sits in;
   MAP_IMAGE_FIT, MAP_IMAGE_SCALE, and MAP_IMAGE_OFFSET_TOP/LEFT let you
   crop, zoom, and nudge the artwork within that box independently of the
   pins. Pins are positioned separately below via each place's top/left. */
const MAP_IMAGE_SRC = "/map.png";            // <-- drop your map artwork here
const MAP_FRAME_MAX_WIDTH = 760;             // desktop px - overall map box width (centered)
const MOBILE_MAP_FRAME_MAX_WIDTH = 380;      // mobile px
const MAP_FRAME_ASPECT_RATIO = "16 / 10";    // width / height ratio of the map box
const MAP_IMAGE_FIT = "cover";               // "cover" fills the box (may crop), "contain" fits without cropping
const MAP_IMAGE_SCALE = 1;                   // >1 zooms in on the artwork
const MAP_IMAGE_OFFSET_TOP = 0;              // px - nudge the artwork within its frame
const MAP_IMAGE_OFFSET_LEFT = 0;             // px

/* Travel/study history - replace with your real study & travel history.
   type: "lived" (studied there) or "visited". top/left are % positions
   on the map image (0%/0% = top-left corner of the map box, 100%/100% =
   bottom-right) - nudge each pin's top/left to sit exactly where that
   place is on your map artwork. year/age show up in the hover tooltip. */
const TRAVEL_PLACES = [
  { place: "Markham, Toronto, Canada", year: "2021 - present", age: "Age: 12 - present", type: "lived", top: "38%", left: "24%" },
  { place: "NYC, New York, USA", year: "2026", age: "Age: 17", type: "visited", top: "43%", left: "26.2%" },
  { place: "Tuticorin, Tamil Nadu, India", year: "2017-2020", age: "Age: 8-12", type: "lived", top: "59%", left: "65%" },
    { place: "Kuala Kumpur, Malaysia", year: "2009-2014", age: "Age: 8-12", type: "lived", top: "61%", left: "71%" },
  { place: "Saudi Arabia, Dubai", year: "2019", age: "Age: 10", type: "visited", top: "43.5%", left: "52.5%" },
  { place: "Beijing, China", year: "2013", age: "Age: 6", type: "visited", top: "38.5%", left: "80%" },
    { place: "Tokyo, Japan", year: "2019", age: "Age: 11", type: "visited", top: "49.5%", left: "80.5%" },
  { place: "Melbourne, Australia", year: "2015-2016", age: "Age: 7-8", type: "lived", top: "82%", left: "80%" },
];

const PROS = [
  "Excellent memory - can hold a huge amount of information whenever it's needed.",
  "Genuinely wanted to save people's lives - that was the dream since I was four, and I'm not joking.",
];

const CONS = [
  "Zero sense of smell - so yes, blood wouldn't bother me, but for entirely the wrong reason.",
  "Would rather take apart a gadget than take out a gallbladder. I'm fidgety like that.",
];

/* ====== SCROLL BARS (only the bottom bar drops) ======
   Two independent images stacked directly on top of each other (touching,
   so they read as one rolled-up scroll) until the whole thing is clicked -
   then the pros/cons panel between them grows open (background box and
   all), pushing ONLY the bottom bar down; the top bar stays fixed in
   place. Size and position each bar independently; both default to
   centered. SCROLL_WRAP_WIDTH/HEIGHT (and mobile equivalents) control the
   max size of the pros/cons panel once opened, and
   SCROLL_WRAP_OFFSET_TOP/LEFT (and mobile equivalents) let you nudge that
   panel from its default centered position. */
const SCROLL_TOP_IMG_SRC = "/scroll-top.png";       // <-- drop your top scroll-bar art here
const SCROLL_BOTTOM_IMG_SRC = "/scroll-bottom.png"; // <-- drop your bottom scroll-bar art here

// Max size of the pros/cons panel once it's open. Set width/height
// yourself; leave a value as null to let that dimension size to content
// instead of being capped.
const SCROLL_WRAP_WIDTH = 700;              // desktop px (or null to size to content)
const SCROLL_WRAP_HEIGHT = 320;             // desktop px (or null to size to content)
const MOBILE_SCROLL_WRAP_WIDTH = 240;       // mobile px (or null)
const MOBILE_SCROLL_WRAP_HEIGHT = 830;      // mobile px (or null)

// Nudge the pros/cons panel from its default centered position, in px.
// Positive LEFT moves it right, positive TOP moves it down.
const SCROLL_WRAP_OFFSET_TOP = 0;           // px, desktop
const SCROLL_WRAP_OFFSET_LEFT = 0;          // px, desktop
const MOBILE_SCROLL_WRAP_OFFSET_TOP = 0;    // px, mobile
const MOBILE_SCROLL_WRAP_OFFSET_LEFT = 0;   // px, mobile

const SCROLL_TOP_WIDTH = 1080;            // desktop px
const SCROLL_TOP_HEIGHT = 100;            // desktop px
const SCROLL_BOTTOM_WIDTH = 1080;         // desktop px
const SCROLL_BOTTOM_HEIGHT = 100;         // desktop px
const MOBILE_SCROLL_TOP_WIDTH = 320;     // mobile px
const MOBILE_SCROLL_TOP_HEIGHT = 44;     // mobile px
const MOBILE_SCROLL_BOTTOM_WIDTH = 320;  // mobile px
const MOBILE_SCROLL_BOTTOM_HEIGHT = 44;  // mobile px

// Nudge each bar independently from its default centered/touching position,
// in px. Positive LEFT moves right, positive TOP moves down. Handy if your
// artwork has built-in padding and the two bars need a small overlap or gap
// to look properly "attached".
const SCROLL_TOP_OFFSET_TOP = 20;
const SCROLL_TOP_OFFSET_LEFT = -135;
const SCROLL_BOTTOM_OFFSET_TOP = -10;
const SCROLL_BOTTOM_OFFSET_LEFT = -135;
const MOBILE_SCROLL_TOP_OFFSET_TOP = 20;
const MOBILE_SCROLL_TOP_OFFSET_LEFT = 0;
const MOBILE_SCROLL_BOTTOM_OFFSET_TOP = -1;
const MOBILE_SCROLL_BOTTOM_OFFSET_LEFT = 0;

// How far the bottom bar drops away from the top bar when pulled apart, in
// px, and how long the whole pull-apart + unroll takes. The top bar no
// longer moves at all - only the bottom bar travels this distance.
const SCROLL_PULL_DISTANCE = -30;         // desktop px
const MOBILE_SCROLL_PULL_DISTANCE = -20;  // mobile px
const SCROLL_PULL_DURATION = 0.9;         // seconds

/* ---------------------------------------------------------------------
   Small hook: fires `visible = true` the first time the referenced
   element scrolls into view, so sections can "write themselves in" with
   a quill-reveal animation rather than all appearing at once.
--------------------------------------------------------------------- */
function useRevealOnScroll() {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return [ref, visible];
}

function RevealBlock({ children, className = "", as: Tag = "div" }) {
  const [ref, visible] = useRevealOnScroll();
  return (
    <Tag ref={ref} className={`reveal-block ${visible ? "reveal-visible" : ""} ${className}`}>
      {children}
    </Tag>
  );
}

/* Pure image flip card for the skills grid: flap{n}.png by default, flips
   to flapback{n}.png on hover (:hover) or keyboard focus (:focus-within).
   No click/tap toggle, no text - just the two images. */
function FlapCard({ index }) {
  return (
    <div className="flap-card" tabIndex={0}>
      <div className="flap-card-inner">
        <img
          src={FLAP_IMAGE_PATH(index)}
          alt={`Skill ${index}`}
          className="flap-card-face flap-card-front"
        />
        <img
          src={FLAP_BACK_IMAGE_PATH(index)}
          alt={`Skill ${index} detail`}
          className="flap-card-face flap-card-back"
        />
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------
   TalentSlideSection: several copies of the same image, placed back to
   back with no gaps, slide as one connected slanted strip across the
   full width of the screen as this section scrolls through view.
   Progress 0 is the section fully below the viewport (strip's left edge
   flush with the screen's left edge); progress 1 is the section fully
   above the viewport (strip's right edge flush with the screen's right
   edge). Same scroll-scrubbing idea as the portrait in the hero - purely
   tied to scroll position, no timers, hover, or clicks.
--------------------------------------------------------------------- */
function TalentSlideSection({ isMobile }) {
  const sectionRef = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    const updateProgress = () => {
      ticking = false;
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = window.innerHeight + rect.height;
      const p = Math.min(Math.max((window.innerHeight - rect.top) / total, 0), 1);
      setProgress(p);
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateProgress);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const imageWidth = isMobile ? MOBILE_TALENT_IMAGE_WIDTH : TALENT_IMAGE_WIDTH;
  const imageHeight = isMobile ? MOBILE_TALENT_IMAGE_HEIGHT : TALENT_IMAGE_HEIGHT;
  const repeatCount = isMobile ? MOBILE_TALENT_IMAGE_REPEAT_COUNT : TALENT_IMAGE_REPEAT_COUNT;
  const trackHeight = isMobile ? MOBILE_TALENT_TRACK_HEIGHT : TALENT_TRACK_HEIGHT;
  const verticalOffset = isMobile ? MOBILE_TALENT_VERTICAL_OFFSET : TALENT_VERTICAL_OFFSET;
  const stripWidth = imageWidth * repeatCount;

  // The track spans the full 100vw viewport width and the strip starts
  // centered within it (left: 50%). To make the STRIP's left edge land
  // exactly on the screen's left edge at progress 0, and its right edge
  // land exactly on the screen's right edge at progress 1, the offset
  // needs both a vw component (screen-relative) and a px component (half
  // the strip's own total width) - mixed via calc() since they're
  // different units.
  const vwPart = -50 + progress * 100;
  const pxPart = stripWidth * (0.5 - progress);

  return (
    <section className="section talent-section" ref={sectionRef}>
      <RevealBlock as="h2" className="section-title">Talents Outside the Workshop</RevealBlock>
      <div className="section-divider">✦</div>
      <div className="talent-slide-track" style={{ "--talent-track-height": `${trackHeight}px` }}>
        <div
          className="talent-slide-strip"
          style={{
            transform: `translate(-50%, calc(-50% + ${verticalOffset}px)) translateX(calc(${vwPart}vw + ${pxPart}px)) rotate(${TALENT_SLANT_DEG}deg)`,
          }}
        >
          {Array.from({ length: repeatCount }, (_, i) => (
            <img
              key={i}
              src={TALENT_IMG_SRC}
              alt="A talent illustration"
              className="talent-slide-image"
              style={{
                "--talent-image-width": `${imageWidth}px`,
                "--talent-image-height": `${imageHeight}px`,
              }}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* Map pin: sits at place.top/place.left on the map image. Hovering (or
   tapping, or keyboard-focusing) it fires a small burst of particles from
   the pin - sparkling stars for "visited" places, a wand-and-sparkle burst
   for "lived" places - alongside a tooltip with the year and age. The
   burst is rebuilt (via burstKey) every time the pin is re-entered so it
   re-fires cleanly on repeat hovers instead of only playing once. */
function MapPin({ place }) {
  const [open, setOpen] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const particles = useMemo(() => {
    const count = place.type === "lived" ? 9 : 11;
    const symbols =
      place.type === "lived"
        ? ["🪄", "✨", "⋆", "✨", "🪄"]
        : ["✦", "✧", "⋆", "✩", "✯"];

    return Array.from({ length: count }, (_, i) => {
      const angle = (360 / count) * i + (Math.random() * 22 - 11);
      const distance = 30 + Math.random() * 30;
      const delay = Math.random() * 0.18;
      const duration = 0.7 + Math.random() * 0.35;
      const size = place.type === "lived" ? 12 + Math.random() * 7 : 9 + Math.random() * 6;
      const symbol = symbols[Math.floor(Math.random() * symbols.length)];
      return { id: i, angle, distance, delay, duration, size, symbol };
    });
    // Recompute on every fresh burst so repeat hovers feel alive, not identical.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey, place.type]);

  const fire = () => setBurstKey((k) => k + 1);

  return (
    <div
      className={`map-pin ${place.type === "lived" ? "map-pin-lived" : "map-pin-visited"}`}
      style={{ top: place.top, left: place.left }}
      onMouseEnter={() => { setOpen(true); fire(); }}
      onMouseLeave={() => setOpen(false)}
      onClick={() => setOpen((o) => { const next = !o; if (next) fire(); return next; })}
      onFocus={() => { setOpen(true); fire(); }}
      onBlur={() => setOpen(false)}
      tabIndex={0}
      role="button"
    >
      <span className="map-pin-dot" />

      <div className="firework-layer" key={burstKey} aria-hidden="true">
        {particles.map((p) => (
          <span
            key={p.id}
            className="firework-particle"
            style={{
              "--angle": `${p.angle}deg`,
              "--distance": `${p.distance}px`,
              "--particle-delay": `${p.delay}s`,
              "--particle-duration": `${p.duration}s`,
              fontSize: `${p.size}px`,
            }}
          >
            {p.symbol}
          </span>
        ))}
      </div>

      {open && (
        <div className="map-pin-tooltip">
          <strong>{place.place}</strong>
          <br />
          {place.year} · {place.age} {place.type === "lived" ? "· studied here" : "· visited"}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------
   WandmakerSection: the whole "why engineer not doctor" block is one
   self-contained component - intro copy, the click-to-unroll scroll, and
   the closing copy. The pros/cons content (and its background box) sits
   directly between the two scroll-bar images: closed, that box has no
   border/background and zero height, so nothing shows between the bars.
   Opening the scroll grows the box open along with the pros/cons content,
   and only then does the bottom bar drop away to make room.
--------------------------------------------------------------------- */
function WandmakerSection({ isMobile, scrollUnrolled, setScrollUnrolled }) {
  const scrollWrapWidth = isMobile ? MOBILE_SCROLL_WRAP_WIDTH : SCROLL_WRAP_WIDTH;
  const scrollWrapHeight = isMobile ? MOBILE_SCROLL_WRAP_HEIGHT : SCROLL_WRAP_HEIGHT;
  const scrollWrapOffsetTop = isMobile ? MOBILE_SCROLL_WRAP_OFFSET_TOP : SCROLL_WRAP_OFFSET_TOP;
  const scrollWrapOffsetLeft = isMobile ? MOBILE_SCROLL_WRAP_OFFSET_LEFT : SCROLL_WRAP_OFFSET_LEFT;
  const scrollTopWidth = isMobile ? MOBILE_SCROLL_TOP_WIDTH : SCROLL_TOP_WIDTH;
  const scrollTopHeight = isMobile ? MOBILE_SCROLL_TOP_HEIGHT : SCROLL_TOP_HEIGHT;
  const scrollBottomWidth = isMobile ? MOBILE_SCROLL_BOTTOM_WIDTH : SCROLL_BOTTOM_WIDTH;
  const scrollBottomHeight = isMobile ? MOBILE_SCROLL_BOTTOM_HEIGHT : SCROLL_BOTTOM_HEIGHT;
  const scrollTopOffsetTop = isMobile ? MOBILE_SCROLL_TOP_OFFSET_TOP : SCROLL_TOP_OFFSET_TOP;
  const scrollTopOffsetLeft = isMobile ? MOBILE_SCROLL_TOP_OFFSET_LEFT : SCROLL_TOP_OFFSET_LEFT;
  const scrollBottomOffsetTop = isMobile ? MOBILE_SCROLL_BOTTOM_OFFSET_TOP : SCROLL_BOTTOM_OFFSET_TOP;
  const scrollBottomOffsetLeft = isMobile ? MOBILE_SCROLL_BOTTOM_OFFSET_LEFT : SCROLL_BOTTOM_OFFSET_LEFT;
  const scrollPullDistance = isMobile ? MOBILE_SCROLL_PULL_DISTANCE : SCROLL_PULL_DISTANCE;

  return (
    <section className="section">
      <RevealBlock as="h2" className="section-title">Wandmaker, Not Healer?</RevealBlock>
      <div className="section-divider">✦</div>
      <RevealBlock className="section-body">
        <p>
          The question I've probably been asked a hundred times across grades 11 and 12: why an
          engineer, and not a doctor? Click the scroll below for the honest pros and cons.
        </p>
      </RevealBlock>

      <RevealBlock style={{ marginTop: 20 }}>
        <div
          className="scroll-bars-stage"
          style={{
            "--scroll-top-width": `${scrollTopWidth}px`,
            "--scroll-top-height": `${scrollTopHeight}px`,
            "--scroll-bottom-width": `${scrollBottomWidth}px`,
            "--scroll-bottom-height": `${scrollBottomHeight}px`,
            "--scroll-top-offset-top": `${scrollTopOffsetTop}px`,
            "--scroll-top-offset-left": `${scrollTopOffsetLeft}px`,
            "--scroll-bottom-offset-top": `${scrollBottomOffsetTop}px`,
            "--scroll-bottom-offset-left": `${scrollBottomOffsetLeft}px`,
            "--scroll-pull-distance": `${scrollPullDistance}px`,
            "--scroll-pull-duration": `${SCROLL_PULL_DURATION}s`,
          }}
          onClick={() => setScrollUnrolled((v) => !v)}
          role="button"
          tabIndex={0}
          aria-expanded={scrollUnrolled}
          aria-label={scrollUnrolled ? "Roll the scroll back up" : "Unroll the scroll"}
        >
          <img
            src={SCROLL_TOP_IMG_SRC}
            alt=""
            draggable={false}
            className="scroll-bar scroll-bar-top"
          />

          <div
            className={`pros-cons-panel ${scrollUnrolled ? "panel-open" : ""}`}
            style={{
              "--scroll-wrap-width": scrollWrapWidth != null ? `${scrollWrapWidth}px` : undefined,
              "--scroll-wrap-height": scrollWrapHeight != null ? `${scrollWrapHeight}px` : undefined,
              "--scroll-wrap-offset-top": `${scrollWrapOffsetTop}px`,
              "--scroll-wrap-offset-left": `${scrollWrapOffsetLeft}px`,
            }}
          >
            <div className={`pros-cons ${scrollUnrolled ? "pc-open" : ""}`}>
              <div className="pc-col pc-pros">
                <h4>Pros</h4>
                <ul>
                  {PROS.map((p, i) => (
                    <li key={i} style={{ transitionDelay: scrollUnrolled ? `${i * 0.12}s` : "0s" }}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className="pc-col pc-cons">
                <h4>Cons</h4>
                <ul>
                  {CONS.map((c, i) => (
                    <li key={i} style={{ transitionDelay: scrollUnrolled ? `${i * 0.12}s` : "0s" }}>{c}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          <img
            src={SCROLL_BOTTOM_IMG_SRC}
            alt=""
            draggable={false}
            className={`scroll-bar scroll-bar-bottom ${scrollUnrolled ? "scroll-bar-open" : ""}`}
          />
        </div>
      </RevealBlock>

      <RevealBlock className="section-body" style={{ marginTop: 26 }}>
        <p>
          I've got a growth mindset at heart! I don't want to stay in the same spot for long,
          and I'd rather move through different roles across my life than settle into just one.
        </p>
      </RevealBlock>
    </section>
  );
}

export default function About() {
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState("dark");
  const [sealOpen, setSealOpen] = useState(false);
  const [nickIndex, setNickIndex] = useState(0);
  const [scrollUnrolled, setScrollUnrolled] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [portraitFrame, setPortraitFrame] = useState(1);
  const heroRef = useRef(null);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  // Lock page scrolling entirely until the stamp has been clicked / the
  // letter has been opened. Nothing below the hero can be reached before then.
  useEffect(() => {
    if (sealOpen) {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    } else {
      document.body.style.overflow = "hidden";
      document.documentElement.style.overflow = "hidden";
    }
    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
    };
  }, [sealOpen]);

  // Scrub the portrait sequence purely off scroll position: progress 0 is the
  // hero fully in view (me1), progress 1 is the hero fully scrolled above the
  // viewport (me{PORTRAIT_IMAGE_COUNT}). Nothing else moves this frame index.
  useEffect(() => {
    let ticking = false;

    const updateFrame = () => {
      ticking = false;
      const el = heroRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const progress = Math.min(Math.max(-rect.top / rect.height, 0), 1);
      const frame = 1 + Math.round(progress * (PORTRAIT_IMAGE_COUNT - 1));
      setPortraitFrame(frame);
    };

    const handleScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(updateFrame);
    };

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("resize", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("resize", handleScroll);
    };
  }, []);

  const portraitWidth = isMobile ? MOBILE_PORTRAIT_WIDTH : PORTRAIT_WIDTH;
  const portraitHeight = isMobile ? MOBILE_PORTRAIT_HEIGHT : PORTRAIT_HEIGHT;
  const portraitOffsetTop = isMobile ? MOBILE_PORTRAIT_OFFSET_TOP : PORTRAIT_OFFSET_TOP;
  const portraitOffsetLeft = isMobile ? MOBILE_PORTRAIT_OFFSET_LEFT : PORTRAIT_OFFSET_LEFT;
  const flapCardWidth = isMobile ? MOBILE_FLAP_CARD_WIDTH : FLAP_CARD_WIDTH;
  const flapCardHeight = isMobile ? MOBILE_FLAP_CARD_HEIGHT : FLAP_CARD_HEIGHT;
  const flapColumns = isMobile ? FLAP_COLUMNS_MOBILE : FLAP_COLUMNS_DESKTOP;
  const navHeight = isMobile ? MOBILE_NAV_HEIGHT : NAV_HEIGHT;
  const navLogoSize = isMobile ? MOBILE_NAV_LOGO_SIZE : NAV_LOGO_SIZE;
  const letterWidth = isMobile ? MOBILE_LETTER_WIDTH : LETTER_WIDTH;
  const letterHeight = isMobile ? MOBILE_LETTER_HEIGHT : LETTER_HEIGHT;
  const stampWidth = isMobile ? MOBILE_STAMP_WIDTH : STAMP_WIDTH;
  const stampHeight = isMobile ? MOBILE_STAMP_HEIGHT : STAMP_HEIGHT;
  const mapFrameMaxWidth = isMobile ? MOBILE_MAP_FRAME_MAX_WIDTH : MAP_FRAME_MAX_WIDTH;
  const backgroundGif = theme === "light" ? LIGHT_BG_GIF : DARK_BG_GIF;
  const isLight = theme === "light";

  const cycleNickname = useCallback(() => {
    setNickIndex((i) => (i + 1) % NICKNAMES.length);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cinzel+Decorative:wght@700;900&family=EB+Garamond:ital,wght@0,400;0,600;1,400&family=Caveat:wght@500;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; }

        html, body {
          height: 100%;
          background: #000;
        }

        .parchment-page {
          position: relative;
          min-height: 100vh;
          color: #4a2e14;
          font-family: 'EB Garamond', Georgia, serif;
          overflow-x: hidden;
        }

        /* ===== GIF BACKGROUND — mirrors Home.jsx exactly ===== */
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

        h1, h2, h3, .display-font {
          font-family: 'Cinzel Decorative', serif;
          color: #f2c869;
          letter-spacing: 0.02em;
        }

        .ink-script {
          font-family: 'Caveat', cursive;
        }

        /* ===== NAVBAR - mirrors Home.jsx exactly ===== */
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

        .mobile-dropdown-tabs {
          list-style: none;
          display: flex;
          flex-direction: column;
        }

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

        /* ===== HERO / LETTER + STAMP =====
           Full viewport height on every breakpoint so nothing below the
           fold is visible until the person actually scrolls - and they
           can't scroll at all until the letter is opened. */
        .hero {
          position: relative;
          z-index: 2;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          text-align: center;
          padding: calc(40px + var(--nav-height)) 20px 90px;
        }

        .envelope {
          position: relative;
          width: min(90vw, 460px);
          padding: 50px 30px;
          background: linear-gradient(160deg, #f4e6c4, #e0c58f);
          border: 2px solid #8a6a34;
          border-radius: 6px;
          box-shadow: 0 18px 45px rgba(43, 27, 14, 0.35);
        }

        /* While unopened, the whole letter+stamp gives an impatient little
           shake every few seconds - like it's waiting to be read. The shake
           itself only takes up the last slice of each cycle, so it reads as
           a quick jolt followed by a pause, not constant jitter. Stops the
           moment the stamp is clicked. */
        .envelope-shake {
          animation: envelopeShake 4.5s ease-in-out infinite;
        }
        @keyframes envelopeShake {
          0%, 90%, 100% { transform: translate(0, 0) rotate(0deg); }
          91% { transform: translate(-4px, 0) rotate(-2deg); }
          92% { transform: translate(4px, -2px) rotate(2deg); }
          93% { transform: translate(-4px, 2px) rotate(-1.5deg); }
          94% { transform: translate(4px, 0) rotate(1.5deg); }
          95% { transform: translate(-3px, -1px) rotate(-1deg); }
          96% { transform: translate(3px, 1px) rotate(1deg); }
          97% { transform: translate(-2px, 0) rotate(-0.5deg); }
          98% { transform: translate(2px, 0) rotate(0.5deg); }
          99% { transform: translate(0, 0) rotate(0deg); }
        }

        /* Letter image + stamp: two independent floating images that overlap
           on top of the envelope/scroll. Position & size each one yourself
           with the LETTER_/STAMP_ TOP/LEFT/WIDTH/HEIGHT constants above -
           they aren't tied to the envelope's shape or background. */
        .letter-image {
          position: absolute;
          top: var(--letter-top);
          left: var(--letter-left);
          width: var(--letter-width);
          height: var(--letter-height);
          transform: translate(-50%, -50%);
          object-fit: contain;
          user-select: none;
          pointer-events: none;
          z-index: 3;
          transition: opacity var(--letter-fade-duration) ease var(--letter-fade-delay);
        }
        .letter-image.letter-fading {
          opacity: 0;
        }

        .stamp-image {
          position: absolute;
          top: var(--stamp-top);
          left: var(--stamp-left);
          width: var(--stamp-width);
          height: var(--stamp-height);
          transform: translate(-50%, -50%);
          cursor: pointer;
          object-fit: contain;
          z-index: 4;
          transition: transform var(--stamp-slide-duration) ease, opacity var(--stamp-slide-duration) ease;
        }
        .stamp-image.stamp-away {
          transform: translate(-50%, calc(-50% - 220px));
          opacity: 0;
          pointer-events: none;
        }

        .letter-content {
          max-height: 0;
          overflow: hidden;
          transition: max-height 1s ease var(--scroll-unroll-delay);
        }
        .letter-content.letter-open {
          max-height: 900px;
        }

        .hero-name {
          font-size: clamp(34px, 6vw, 56px);
          margin: 14px 0 6px;
          cursor: pointer;
          user-select: none;
        }

        .hero-sub {
          font-size: 18px;
          font-style: italic;
          color: #5c4322;
        }

        .hero-nick-hint {
          margin-top: 6px;
          font-family: 'Caveat', cursive;
          font-size: 17px;
          color: #7a5a2a;
        }

        /* ===== SECTIONS ===== */
        .section {
          position: relative;
          z-index: 2;
          max-width: 880px;
          margin: 0 auto;
          padding: 70px 24px;
        }

        .section-divider {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 14px;
          margin: 10px 0 34px;
          color: #f2c869;
        }
        .section-divider::before, .section-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: linear-gradient(90deg, transparent, #b8862f, transparent);
        }

        .reveal-block {
          opacity: 0;
          transform: translateY(24px);
          transition: opacity 0.8s ease, transform 0.8s ease;
        }
        .reveal-visible { opacity: 1; transform: translateY(0); }

        .section-title {
          font-size: clamp(26px, 4vw, 36px);
          text-align: center;
          margin-bottom: 8px;
        }

        /* The talent strip's track uses overflow: visible and can spill
           above/below its own box, overlapping neighboring sections
           (e.g. the flap cards). Without this, it ties with those
           sections at z-index 2 and - since it comes later in the DOM -
           would paint (and intercept drags/hovers) on top of them. This
           drops the whole section below its siblings, while staying
           above the fixed background gif (z-index 0). */
        .talent-section {
          z-index: 1;
        }

        .section-body {
          font-size: 18px;
          line-height: 1.8;
          color: #d9b979;
        }

        /* ===== PORTRAIT FRAME ===== */
        .portrait-wrap {
          display: flex;
          justify-content: center;
          margin: 10px 0 30px;
        }
        /* No wrapping box, no fade - just the raw portrait at whatever size
           you set via PORTRAIT_WIDTH/HEIGHT (and the mobile equivalents).
           The src swaps instantly as portraitFrame changes on scroll. */
        .portrait-image {
          display: block;
          width: var(--portrait-width);
          height: var(--portrait-height);
          object-fit: contain;
        }
        .portrait-caption {
          text-align: center;
          font-family: 'Caveat', cursive;
          font-size: 18px;
          color: #6b4a1e;
          margin-top: 8px;
        }

        /* ===== SKILLS / FLAP CARDS (images only, no border/box) =====
           Each card is a 3D flip: perspective lives on the card itself
           (not just the grid) so the flip renders reliably across
           browsers, and backface-visibility is prefixed for Safari. */
        .flap-grid {
          display: grid;
          grid-template-columns: repeat(var(--flap-columns), var(--flap-card-width));
          justify-content: center;
          gap: 16px;
        }
        .flap-card {
          width: var(--flap-card-width);
          height: var(--flap-card-height);
          cursor: pointer;
          outline: none;
          perspective: 800px;
        }
        .flap-card-inner {
          position: relative;
          width: 100%;
          height: 100%;
          transition: transform 0.6s cubic-bezier(0.4, 0.2, 0.2, 1);
          transform-style: preserve-3d;
        }
        .flap-card:hover .flap-card-inner,
        .flap-card:focus-within .flap-card-inner,
        .flap-card:focus .flap-card-inner {
          transform: rotateY(180deg);
        }
        .flap-card-face {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: top;
          backface-visibility: hidden;
          -webkit-backface-visibility: hidden;
        }
        .flap-card-back {
          transform: rotateY(180deg);
        }

        /* ===== TALENT SLIDE =====
           .talent-slide-track breaks out of the section's max-width to
           span the full viewport width (100vw), so the strip has room to
           travel edge to edge. Its height is fixed via
           --talent-track-height so the section doesn't collapse.
           .talent-slide-strip is a flex row of repeated images placed
           back to back with no gap, centered in the track by default and
           then pushed left/right by JS (mixed vw + px via calc()) based
           on scroll progress, with a constant slant (rotation) applied to
           the whole strip. */
        .talent-slide-track {
          position: relative;
          z-index: 1;
          width: 100vw;
          left: 50%;
          transform: translateX(-50%);
          height: var(--talent-track-height, 320px);
          overflow: visible;
        }
        .talent-slide-strip {
          position: absolute;
          top: 50%;
          left: 50%;
          z-index: 1;
          display: flex;
          gap: 0;
          will-change: transform;
        }
        .talent-slide-image {
          display: block;
          width: var(--talent-image-width);
          height: var(--talent-image-height);
          object-fit: contain;
          flex-shrink: 0;
        }

        /* ===== MAP =====
           .map-frame is the sizing box (width/aspect-ratio driven by the
           MAP_FRAME_* constants); .map-image is your artwork filling it,
           positioned/scaled via CSS vars from MAP_IMAGE_*. Pins sit on top,
           positioned independently via each place's top/left %. */
        .map-frame {
          position: relative;
          width: min(100%, var(--map-frame-max-width));
          margin: 0 auto;
          aspect-ratio: var(--map-frame-aspect-ratio);
          border: 3px solid #6b4a1e;
          border-radius: 8px;
          overflow: hidden;
          background: linear-gradient(160deg, #ecd9a8, #c9ad7f);
          box-shadow: inset 0 0 60px rgba(90, 60, 20, 0.25), 0 18px 40px rgba(20, 12, 4, 0.4);
        }
        .map-image {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
          object-fit: var(--map-image-fit);
          object-position: center;
          transform: scale(var(--map-image-scale)) translate(var(--map-image-offset-left), var(--map-image-offset-top));
          transform-origin: center;
          user-select: none;
          pointer-events: none;
        }
        .map-pin {
          position: absolute;
          transform: translate(-50%, -50%);
          cursor: pointer;
          z-index: 2;
        }
        .map-pin-dot {
          display: block;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          border: 2px solid #2b1b0e;
          box-shadow: 0 0 8px rgba(0,0,0,0.4);
          animation: pinPulse 2.4s ease-in-out infinite;
        }
        .map-pin-lived .map-pin-dot { background: #b8862f; }
        .map-pin-visited .map-pin-dot { background: #9c2b2b; }
        @keyframes pinPulse {
          0%, 100% { box-shadow: 0 0 0 0 rgba(184,134,47,0.5); }
          50% { box-shadow: 0 0 0 8px rgba(184,134,47,0); }
        }

        /* ===== FIREWORK BURST (on pin hover / focus / tap) =====
           Each particle is placed dead-center on the pin, then flies
           outward along --angle for --distance while fading out. The
           layer is remounted (fresh React elements, via the burstKey) on
           every hover so the animation restarts cleanly every time. */
        .firework-layer {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          pointer-events: none;
        }
        .firework-particle {
          position: absolute;
          top: 0;
          left: 0;
          opacity: 0;
          line-height: 1;
          transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0);
          animation: fireworkBurst var(--particle-duration, 0.8s) ease-out var(--particle-delay, 0s) forwards;
          filter: drop-shadow(0 0 3px rgba(255, 220, 150, 0.8));
        }
        .map-pin-visited .firework-particle {
          color: #fff3d0;
        }
        .map-pin-lived .firework-particle {
          color: #f2c869;
        }
        @keyframes fireworkBurst {
          0% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(0) scale(0.4);
          }
          22% {
            opacity: 1;
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50%) rotate(var(--angle)) translateX(var(--distance)) scale(1);
          }
        }

        .map-pin-tooltip {
          position: absolute;
          bottom: 22px;
          left: 50%;
          transform: translateX(-50%);
          background: #2b1b0e;
          color: #f2ece0;
          padding: 8px 12px;
          border-radius: 6px;
          font-size: 13px;
          white-space: nowrap;
          box-shadow: 0 6px 16px rgba(0,0,0,0.4);
          z-index: 5;
        }
        .map-legend {
          display: flex;
          gap: 22px;
          justify-content: center;
          margin-top: 14px;
          font-size: 14px;
        }
        .map-legend-swatch {
          display: inline-block;
          width: 12px; height: 12px;
          border-radius: 50%;
          margin-right: 6px;
          vertical-align: middle;
        }

        /* ===== SCROLL (why engineer not doctor) =====
           Two bar images stacked directly together (touching, so they
           read as one rolled-up scroll) - clicking the assembly opens the
           pros/cons panel that sits directly between the two bar images,
           pushing ONLY the bottom bar down as it grows; the top bar stays
           fixed in place. */
        .scroll-bars-stage {
          cursor: pointer;
          outline: none;
        }

        .scroll-bar {
          display: block;
          margin: 0 auto;
          object-fit: contain;
          position: relative;
          z-index: 2;
          user-select: none;
          -webkit-user-drag: none;
          transition: transform var(--scroll-pull-duration) cubic-bezier(0.22, 1, 0.36, 1);
        }
        .scroll-bar-top {
          width: var(--scroll-top-width);
          height: var(--scroll-top-height);
          transform: translate(var(--scroll-top-offset-left), var(--scroll-top-offset-top));
        }
        /* The top bar intentionally has no .scroll-bar-open rule - it
           stays exactly where it started, both closed and open. */
        .scroll-bar-bottom {
          width: var(--scroll-bottom-width);
          height: var(--scroll-bottom-height);
          transform: translate(var(--scroll-bottom-offset-left), var(--scroll-bottom-offset-top));
        }
        .scroll-bar-bottom.scroll-bar-open {
          transform: translate(
            var(--scroll-bottom-offset-left),
            calc(var(--scroll-bottom-offset-top) + var(--scroll-pull-distance))
          );
        }

        /* Sits directly between the two scroll-bar images, so it's part of
           the content flow rather than a permanent card. Closed, it has no
           border/background and zero height - nothing shows between the
           bars. Opening the scroll grows this box open (border, background,
           and vertical padding all animate in together) along with the
           pros/cons content inside it. Sized via --scroll-wrap-width/height
           and nudged via --scroll-wrap-offset-top/left. */
        .pros-cons-panel {
          width: var(--scroll-wrap-width, auto);
          max-width: 100%;
          margin: 0 auto;
          transform: translate(var(--scroll-wrap-offset-left, 0px), var(--scroll-wrap-offset-top, 0px));
          max-height: 0;
          overflow: hidden;
          border-radius: 10px;
          border: 2px solid transparent;
          padding: 0 28px;
          background: transparent;
          transition:
            max-height var(--scroll-pull-duration, 1.1s) ease,
            padding-top var(--scroll-pull-duration, 1.1s) ease,
            padding-bottom var(--scroll-pull-duration, 1.1s) ease,
            border-color var(--scroll-pull-duration, 1.1s) ease,
            background var(--scroll-pull-duration, 1.1s) ease;
        }
        .pros-cons-panel.panel-open {
          max-height: var(--scroll-wrap-height, 600px);
          padding-top: 28px;
          padding-bottom: 28px;
          border-color: #8a6a34;
          background: linear-gradient(160deg, #f4e6c4, #e0c58f);
        }

        .pros-cons {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 22px;
        }
        @media (max-width: 640px) {
          .pros-cons { grid-template-columns: 1fr; }
        }
        .pc-col h4 {
          font-family: 'Cinzel Decorative', serif;
          font-size: 17px;
          margin-bottom: 10px;
        }
        .pc-col ul { list-style: none; }
        .pc-col li {
          padding: 8px 0 8px 26px;
          position: relative;
          font-size: 15.5px;
          line-height: 1.55;
          color: #3b2410;
          opacity: 0;
          transform: translateX(-8px);
          transition: opacity 0.5s ease, transform 0.5s ease;
        }
        .pc-open .pc-col li { opacity: 1; transform: translateX(0); }
        .pc-col li::before {
          position: absolute;
          left: 0;
          top: 8px;
        }
        .pc-pros li::before { content: "✦"; color: #2f6b3c; }
        .pc-cons li::before { content: "✦"; color: #9c2b2b; }

        footer.about-footer {
          position: relative;
          z-index: 2;
          text-align: center;
          padding: 40px 20px 60px;
          font-family: 'Caveat', cursive;
          font-size: 20px;
          color: #d9b979;
        }
      `}</style>

      <div
        className="parchment-page"
        style={{
          "--nav-height": `${navHeight}px`,
          "--letter-width": `${letterWidth}px`,
          "--letter-height": `${letterHeight}px`,
          "--letter-top": LETTER_TOP,
          "--letter-left": LETTER_LEFT,
          "--stamp-width": `${stampWidth}px`,
          "--stamp-height": `${stampHeight}px`,
          "--stamp-top": STAMP_TOP,
          "--stamp-left": STAMP_LEFT,
          "--stamp-slide-duration": `${STAMP_SLIDE_DURATION}s`,
          "--letter-fade-duration": `${LETTER_FADE_DURATION}s`,
          "--letter-fade-delay": `${LETTER_FADE_DELAY}s`,
          "--scroll-unroll-delay": `${SCROLL_UNROLL_DELAY}s`,
        }}
      >
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
                  <a
                    href={tab.href}
                    className="mobile-dropdown-tab"
                    onClick={() => setIsMenuOpen(false)}
                  >
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

        {/* ===== HERO: click the stamp to peel it away, fade the letter, and unroll ===== */}
        <section className="hero" ref={heroRef}>
          <div className={`envelope ${!sealOpen ? "envelope-shake" : ""}`}>
            <img
              src={LETTER_IMG_SRC}
              alt="A folded letter"
              className={`letter-image ${sealOpen ? "letter-fading" : ""}`}
            />
            <img
              src={STAMP_IMG_SRC}
              alt="A wax stamp - click to open the letter"
              className={`stamp-image ${sealOpen ? "stamp-away" : ""}`}
              onClick={() => setSealOpen(true)}
              role="button"
              tabIndex={0}
            />

            <div className={`letter-content ${sealOpen ? "letter-open" : ""}`}>
              <h1 className="hero-name" onClick={cycleNickname} title="Click for another name">
                {NICKNAMES[nickIndex]}
              </h1>
              <p className="hero-sub">First-year Computer Engineering conjurer at UWaterloo</p>
              <p className="hero-nick-hint">
                (most people go for "H" - I don't mind. Yes, there are roman numerals in my name...)
              </p>

              <div className="portrait-wrap">
                <div>
                  <img
                    src={PORTRAIT_IMAGE_PATH(portraitFrame)}
                    alt="A moving portrait"
                    className="portrait-image"
                    style={{
                      "--portrait-width": `${portraitWidth}px`,
                      "--portrait-height": `${portraitHeight}px`,
                      transform: `translate(${portraitOffsetLeft}px, ${portraitOffsetTop}px)`,
                    }}
                  />
                  <p className="portrait-caption">- a moving portrait; scroll, and watch it stir -</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ===== CODING / SKILLS ===== */}
        <section className="section">
          <RevealBlock as="h2" className="section-title">Spells I've Taught Myself</RevealBlock>
          <div className="section-divider">✦</div>
          <RevealBlock className="section-body">
            <p>
              On the professional side of the wand, I love to code - a lot. I've built plenty of
              projects in my own time, teaching myself the skills below one at a time. Hover a
              card (or tab to it) to see its flip side.
            </p>
          </RevealBlock>
          <RevealBlock>
            <div
              className="flap-grid"
              style={{
                marginTop: 24,
                "--flap-card-width": `${flapCardWidth}px`,
                "--flap-card-height": `${flapCardHeight}px`,
                "--flap-columns": flapColumns,
              }}
            >
              {Array.from({ length: FLAP_COUNT }, (_, i) => (
                <FlapCard key={i + 1} index={i + 1} />
              ))}
            </div>
          </RevealBlock>
          <RevealBlock className="section-body" style={{ marginTop: 22 }}>
            <p>
              I've also prototyped a few basic Arduino and Raspberry Pi hardware projects on the
              side - so enchanted-objects work is on the table too.
            </p>
          </RevealBlock>
        </section>

        {/* ===== TALENTS: single image slides slanted across the screen on scroll ===== */}
        <TalentSlideSection isMobile={isMobile} />

        {/* ===== MAP: places lived + visited ===== */}
        <section className="section">
          <RevealBlock as="h2" className="section-title">Everywhere I've Studied &amp; Wandered</RevealBlock>
          <div className="section-divider">✦</div>
          <RevealBlock className="section-body">
            <p>
              I've studied at a good few places around the world - the rest of the pins below are
              places I've visited. Hover (or tap) each pin to see the year and how old I was.
            </p>
          </RevealBlock>
          <RevealBlock style={{ marginTop: 22 }}>
            <div
              className="map-frame"
              style={{
                "--map-frame-max-width": `${mapFrameMaxWidth}px`,
                "--map-frame-aspect-ratio": MAP_FRAME_ASPECT_RATIO,
                "--map-image-fit": MAP_IMAGE_FIT,
                "--map-image-scale": MAP_IMAGE_SCALE,
                "--map-image-offset-top": `${MAP_IMAGE_OFFSET_TOP}px`,
                "--map-image-offset-left": `${MAP_IMAGE_OFFSET_LEFT}px`,
              }}
            >
              <img src={MAP_IMAGE_SRC} alt="A hand-drawn map marking everywhere I've studied and wandered" className="map-image" />
              {TRAVEL_PLACES.map((place, i) => (
                <MapPin key={i} place={place} />
              ))}
            </div>
            <div className="map-legend">
              <span><span className="map-legend-swatch" style={{ background: "#b8862f" }} />studied here</span>
              <span><span className="map-legend-swatch" style={{ background: "#9c2b2b" }} />visited</span>
            </div>
          </RevealBlock>
        </section>

        {/* ===== WHY ENGINEER NOT DOCTOR - one self-contained component ===== */}
        <WandmakerSection
          isMobile={isMobile}
          scrollUnrolled={scrollUnrolled}
          setScrollUnrolled={setScrollUnrolled}
        />

        <footer className="about-footer">~ mischief managed ~</footer>
      </div>
    </>
  );
}