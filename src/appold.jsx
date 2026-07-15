import { useState, useEffect, useRef } from "react";

// ── CONFIG — fill these in ──────────────────────────────────────────────────
const GROQ_API_KEY = import.meta.env.VITE_GROQ_API_KEY;
const GOOGLE_DOC_ID = "1V45y-uCJ7SkHU0P_UydQd0GFQ7MjeErZRessSIG1Y24";
// The doc must be shared as "Anyone with link can view"
// ───────────────────────────────────────────────────────────────────────────

// Drop your 5 images in /public as 1.png, 2.png, 3.png, 4.png, 5.png
// (change the extension here if yours are .jpg / .webp / etc.)
const PHOTOS_CONFIG = [
  { id: 1, src: "/1.png" },
  { id: 2, src: "/2.png" },
  { id: 3, src: "/3.png" },
  { id: 4, src: "/4.png" },
  { id: 5, src: "/5.png" },
];

// Inset (px) between the constrained drag/resize area and the edge of the
// photo board — this is the "spacing at the ends" so photos can't be
// dragged flush against the boundary.
const BOARD_PADDING = 20;

// Starting layout — scattered loosely across the left half, like pinned
// photos. x/y are px offsets from the top-left of the photo board, width
// is the starting size. The user can drag/resize freely from here; nothing
// is persisted, so a page refresh resets to this layout.
const INITIAL_PHOTOS = [
  { id: 1, x: 20,  y: 10,  width: 190, rotation: -4, z: 31 },
  { id: 2, x: 210, y: 50,  width: 170, rotation: 5,  z: 32 },
  { id: 3, x: 45,  y: 210, width: 200, rotation: 3,  z: 33 },
  { id: 4, x: 265, y: 250, width: 175, rotation: -6, z: 34 },
  { id: 5, x: 130, y: 410, width: 185, rotation: 2,  z: 35 },
].map((pos) => ({ ...pos, src: PHOTOS_CONFIG.find((p) => p.id === pos.id).src }));

// Drag + resize + rotate logic for the photo board. Pointer events cover
// mouse, touch, and pen in one code path. Takes the photos array and its
// setter from outside (the draft state while editing) plus an `enabled`
// flag so nothing is interactive unless edit mode is on. `boardRef` points
// at the .photo-board element, whose padded content box is the drag/resize
// boundary (see BOARD_PADDING).
function usePhotoBoard(photos, setPhotos, enabled, boardRef) {
  const dragRef = useRef(null);
  const resizeRef = useRef(null);
  const rotateRef = useRef(null);
  const itemRefs = useRef({});
  const zCounterRef = useRef(40);

  const bringToFront = (id) => {
    zCounterRef.current += 1;
    const z = zCounterRef.current;
    setPhotos((ps) => ps.map((p) => (p.id === id ? { ...p, z } : p)));
  };

  // Reads the board's current content-box size (px), so bounds stay correct
  // across responsive breakpoints without hardcoding a width/height.
  const getBoardSize = () => {
    const el = boardRef?.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  };

  const onDragMove = (e) => {
    const d = dragRef.current;
    if (!d) return;
    const dx = e.clientX - d.startX;
    const dy = e.clientY - d.startY;
    let nextX = d.origX + dx;
    let nextY = d.origY + dy;
    const board = getBoardSize();
    const node = itemRefs.current[d.id];
    if (board && node) {
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const maxX = Math.max(BOARD_PADDING, board.width - BOARD_PADDING - w);
      const maxY = Math.max(BOARD_PADDING, board.height - BOARD_PADDING - h);
      nextX = Math.min(Math.max(nextX, BOARD_PADDING), maxX);
      nextY = Math.min(Math.max(nextY, BOARD_PADDING), maxY);
    }
    setPhotos((ps) => ps.map((p) => (p.id === d.id ? { ...p, x: nextX, y: nextY } : p)));
  };
  const onDragEnd = () => {
    dragRef.current = null;
    window.removeEventListener("pointermove", onDragMove);
    window.removeEventListener("pointerup", onDragEnd);
  };
  const onDragStart = (e, id) => {
    if (!enabled) return;
    e.preventDefault();
    const photo = photos.find((p) => p.id === id);
    dragRef.current = { id, startX: e.clientX, startY: e.clientY, origX: photo.x, origY: photo.y };
    bringToFront(id);
    window.addEventListener("pointermove", onDragMove);
    window.addEventListener("pointerup", onDragEnd);
  };

  const onResizeMove = (e) => {
    const r = resizeRef.current;
    if (!r) return;
    const dx = e.clientX - r.startX;
    let newWidth = Math.max(60, r.origWidth + dx);
    const board = getBoardSize();
    if (board) {
      const maxWidthByX = board.width - BOARD_PADDING - r.origX;
      const maxWidthByY = (board.height - BOARD_PADDING - r.origY) / r.aspect;
      newWidth = Math.min(newWidth, maxWidthByX, maxWidthByY);
      newWidth = Math.max(60, newWidth);
    }
    setPhotos((ps) => ps.map((p) => (p.id === r.id ? { ...p, width: newWidth } : p)));
  };
  const onResizeEnd = () => {
    resizeRef.current = null;
    window.removeEventListener("pointermove", onResizeMove);
    window.removeEventListener("pointerup", onResizeEnd);
  };
  const onResizeStart = (e, id) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    const photo = photos.find((p) => p.id === id);
    const node = itemRefs.current[id];
    const aspect = node ? node.offsetHeight / node.offsetWidth : 1;
    resizeRef.current = { id, startX: e.clientX, origWidth: photo.width, origX: photo.x, origY: photo.y, aspect };
    bringToFront(id);
    window.addEventListener("pointermove", onResizeMove);
    window.addEventListener("pointerup", onResizeEnd);
  };

  const onRotateMove = (e) => {
    const r = rotateRef.current;
    if (!r) return;
    const angle = Math.atan2(e.clientY - r.centerY, e.clientX - r.centerX) * (180 / Math.PI);
    const delta = angle - r.startAngle;
    setPhotos((ps) => ps.map((p) => (p.id === r.id ? { ...p, rotation: r.origRotation + delta } : p)));
  };
  const onRotateEnd = () => {
    rotateRef.current = null;
    window.removeEventListener("pointermove", onRotateMove);
    window.removeEventListener("pointerup", onRotateEnd);
  };
  const onRotateStart = (e, id) => {
    if (!enabled) return;
    e.preventDefault();
    e.stopPropagation();
    const photo = photos.find((p) => p.id === id);
    const node = itemRefs.current[id];
    const rect = node.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX) * (180 / Math.PI);
    rotateRef.current = { id, centerX, centerY, startAngle, origRotation: photo.rotation };
    bringToFront(id);
    window.addEventListener("pointermove", onRotateMove);
    window.addEventListener("pointerup", onRotateEnd);
  };

  return { onDragStart, onResizeStart, onRotateStart, itemRefs };
}

const NAV_ITEMS = [
  { label: "About", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
];

const SUGGESTED = [
  "What are some projects Hasini has done?",
  "What are some of Hasini's hobbies?",
  "What is her secret talent?",
];

const BASE_SYSTEM_PROMPT = `You are PawBot 🐾, a friendly and cute AI chat companion on Hasini's personal portfolio website. Answer questions about Hasini in a warm, enthusiastic, and slightly playful tone. Keep answers concise (2–4 sentences max). Use the information provided below about Hasini to answer questions accurately. If asked something not covered, say "Oops, that's outside my paw-ledge! 🐾"`;

const PAGE_STYLES = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garant:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Inter:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  html { -webkit-text-size-adjust: 100%; }

  .theme-root {
    --bg-page: #FAF7FF; --bg-panel: #F5F0FF; --bg-card: #ffffff;
    --bg-header: #FAF7FF; --bg-bubble-assistant: #F0EAFF; --bg-chip: #F0EAFF;
    --bg-chip-hover: #DDD0FF; --bg-input: #F5F0FF; --bg-input-focus: #EDE8FF;
    --bg-fav-hover: #EDE8FF; --border-soft: #E8DEFF; --border-header: #EDE8FF;
    --border-divider: #C4A8FF; --border-input-row: #F0EAFF;
    --text-heading: #2D1B69; --text-body: #4A3480; --text-muted: #9B89C4;
    --text-placeholder: #B8A9DC; --accent: #8B5CF6; --accent-hover: #7C3AED;
    --accent-soft: #C4A8FF; --accent-disabled: #D8CCFF; --scrollbar-thumb: #E0D6FF;
    --tooltip-bg: #2D1B69; --tooltip-text: #F5F0FF; --user-bubble-text: #ffffff;
    color-scheme: light;
  }

  /* ===========================
     RESPONSIVE SCALE TOKENS
     One knob per breakpoint controls the hand-positioned GIF stack so every
     absolute-positioned child (intro text, side buddy, reaction gif, etc.)
     scales together and keeps its relative position. Tune --gif-scale /
     --gif-stack-h if the crop looks off once you see the real assets.
     =========================== */
  .theme-root {
    --gif-scale: 1;
    --gif-stack-h: 620px; /* approx natural height of the stack at scale 1 */
    --card-h: 500px;
    --card-margin-top: 120px;
  }

  /* ===========================
   INTRO TYPEWRITER
   =========================== */

.intro-text {
  position: absolute;

  /* ---------- MOVE THE TEXT ---------- */
  top: 70px;
  left: 33px;

  /* ---------- BOX SIZE ---------- */
  width: 200px;

  /* ---------- FONT ---------- */
  font-family: "Courier New", monospace;
  font-size: 11px;
  font-weight: 400;
  line-height: 1.55;
  color: black;

  white-space: pre-wrap;
  z-index: 100;
  pointer-events: none;

  text-shadow:
      0 1px 2px rgba(0,0,0,0.45);
}

.type-cursor::after{
  content:"|";
  animation: blink 0.8s infinite;
}

@keyframes blink{
  50%{
    opacity:0;
  }
}

  .theme-root.dark {
    --bg-page: #1A1130; --bg-panel: #150D26; --bg-card: #21163D;
    --bg-header: #1C1334; --bg-bubble-assistant: #2C1F52; --bg-chip: #2C1F52;
    --bg-chip-hover: #3A2A6B; --bg-input: #2C1F52; --bg-input-focus: #3A2A6B;
    --bg-fav-hover: #3A2A6B; --border-soft: #382964; --border-header: #2C1F52;
    --border-divider: #6E4FB8; --border-input-row: #2C1F52;
    --text-heading: #F1ECFF; --text-body: #D7C9FF; --text-muted: #9883C9;
    --text-placeholder: #6E5C99; --accent: #A78BFA; --accent-hover: #C4A8FF;
    --accent-soft: #6E4FB8; --accent-disabled: #4B3A7A; --scrollbar-thumb: #4B3A7A;
    --tooltip-bg: #3A2A6B; --tooltip-text: #F1ECFF; --user-bubble-text: #ffffff;
    color-scheme: dark;
  }

  body { background: var(--bg-page); color: var(--text-heading); font-family: 'Inter', sans-serif; overflow-x: hidden; }
  body.custom-cursor { cursor: url('/flower.png') 16 16, auto; }
  .theme-root { background: var(--bg-page); transition: background 0.25s ease; overflow-x: hidden; }

  .cursor-trigger { width: 50px; height: auto; margin-top: 16px; cursor: pointer; transition: transform 0.2s ease; }
  .cursor-trigger:hover { transform: scale(1.08); }

  /* ── NAVBAR ── */
  .navbar {
    position: sticky; top: 0; z-index: 60;
    display: flex; align-items: center; justify-content: space-between;
    padding: 18px 48px; background: var(--bg-header);
    border-bottom: 1px solid var(--border-header);
    transition: background 0.25s ease, border-color 0.25s ease;
    flex-wrap: wrap; gap: 12px;
  }
  .navbar-links { display: flex; align-items: center; gap: 40px; flex-wrap: wrap; }
  .navbar-link {
    position: relative; font-family: 'Inter', sans-serif; font-size: 12.5px;
    font-weight: 500; letter-spacing: 0.04em; text-transform: uppercase;
    color: var(--text-muted); text-decoration: none; cursor: pointer;
    padding-bottom: 3px; border: none; background: none;
    transition: color 0.18s ease;
  }
  .navbar-link::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1.5px;
    background: var(--accent); transform: scaleX(0); transform-origin: left;
    transition: transform 0.2s ease;
  }
  .navbar-link:hover { color: var(--text-heading); }
  .navbar-link:hover::after { transform: scaleX(1); }
  .navbar-link.active { color: var(--accent); }
  .navbar-link.active::after { transform: scaleX(1); }
  .navbar-right { display: flex; align-items: center; gap: 24px; flex-wrap: wrap; }
  .navbar-title {
    font-family: 'Cormorant Garant', serif; font-style: italic; font-weight: 400;
    font-size: 19px; letter-spacing: 0.01em; color: var(--text-heading);
    white-space: nowrap;
  }

  .theme-transition-overlay {
    position: fixed; inset: 0; z-index: 999; background: transparent;
    display: flex; align-items: center; justify-content: center;
    opacity: 1; transition: opacity 500ms ease; pointer-events: none;
  }
  .theme-transition-overlay.fading { opacity: 0; pointer-events: none; }
  .theme-transition-gif { width: 100%; height: 100%; object-fit: cover; }

  /* ── SEND GIF — absolute inside the card, same behaviour as idle.png ── */
  .send-gif-overlay {
    position: absolute;
    width: 500px;   /* ← SIZE: change this */
    max-width: 90%;
    bottom: -20px;  /* ← VERTICAL position from bottom of card */
    left: 16px;     /* ← HORIZONTAL position from left edge of card */
    height: auto; pointer-events: none; opacity: 0;
    transition: opacity 200ms ease; z-index: 11;
  }
  .send-gif-overlay.playing { opacity: 1; }
  .send-gif-overlay.fading  { opacity: 0; }
  .send-gif-img { display: block; width: 100%; height: auto; }

  .theme-toggle {
    display: flex; align-items: center; gap: 8px;
    background: var(--bg-card); border: 1.5px solid var(--border-soft);
    border-radius: 999px; padding: 6px 14px 6px 6px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    color: var(--text-body); box-shadow: 0 4px 16px rgba(139,92,246,0.12);
    transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
  }
  .theme-toggle:hover { border-color: var(--accent-soft); }
  .theme-toggle:disabled { cursor: not-allowed; opacity: 0.7; }
  .theme-toggle-icon {
    width: 26px; height: 26px; border-radius: 50%; background: var(--accent);
    display: flex; align-items: center; justify-content: center; font-size: 13px; flex-shrink: 0;
  }

  /* ── LEFT ── */
  .left {
    padding: 36px 64px 72px 72px;
    display: flex; flex-direction: column;
    justify-content: flex-start;
    gap: 48px; border-right: 1px solid var(--border-soft);
    min-width: 0;
  }

  .eyebrow {
    font-family: 'Cormorant Garant', serif; font-weight: 300;
    font-size: clamp(40px, 6vw, 80px); line-height: 1.0;
    letter-spacing: -0.02em; color: var(--text-heading);
  }
  .divider { width: 32px; height: 1px; background: var(--border-divider); opacity: 0.6; }
  .items-list { display: flex; flex-direction: column; gap: 16px; }
  .item {
    position: relative; display: flex; align-items: flex-start; gap: 14px;
    opacity: 0; transform: translateY(8px);
    transition: opacity 0.45s ease, transform 0.45s ease;
  }
  .item.show { opacity: 1; transform: translateY(0); }
  .item-symbol { font-size: 12px; margin-top: 2px; flex-shrink: 0; width: 16px; text-align: center; }
  .item-text {
    font-family: 'Inter', sans-serif; font-size: 13.5px; font-weight: 300;
    line-height: 1.6; color: var(--text-body); cursor: pointer;
    text-decoration: underline; text-decoration-color: transparent;
    text-underline-offset: 3px; transition: color 0.18s ease, text-decoration-color 0.18s ease;
  }
  .item-text:hover { color: var(--accent); text-decoration-color: var(--accent-soft); }
  .item-tooltip {
    position: absolute; left: 0; top: 100%; margin-top: 6px;
    background: var(--tooltip-bg); color: var(--tooltip-text);
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 300;
    line-height: 1.5; padding: 8px 12px; border-radius: 8px;
    max-width: min(280px, 80vw); z-index: 10; opacity: 0; transform: translateY(-4px);
    pointer-events: none;
    transition: opacity 0.15s ease, transform 0.15s ease;
    box-shadow: 0 6px 20px rgba(45,27,105,0.25);
  }
  .item-tooltip.show { opacity: 1; transform: translateY(0); }
  /* ── DRAGGABLE / RESIZABLE / ROTATABLE PHOTO BOARD ── */
  .photo-board {
    position: relative;
    width: 100%;
    min-height: 480px;
    flex: 1;
    margin-top: -34px; /* pulls the board up tight against the flower icon above */
    /* deliberately not clipped — photos can be dragged past this box,
       even over the right column, and will still render on top of it */
    overflow: visible;
  }
  /* Permanent background behind the photos. object-fit: contain keeps the
     whole image visible with no cropped edges — if its aspect ratio
     doesn't match the box below, it'll letterbox rather than crop.
     Edit width/height/top/left directly to resize or reposition it;
     defaults just happen to match the drag/resize boundary (20px inset)
     but are otherwise independent of it now. */
.photo-board-background {
    position: absolute;
    top: -290px;                   /* ← VERTICAL position */
    left: -20px;                   /* ← HORIZONTAL position */
    width: calc(100% + 40px);      /* ← SIZE: change this (or use a fixed px value) */
    height: calc(100% + 550px);    /* ← SIZE: change this (or use a fixed px value) */
    object-fit: contain;
    object-position: center;
    border-radius: 10px;
    pointer-events: none;
    z-index: 0;
  }
  /* Visualizes the drag/resize boundary — 20px inset on every side to
     match BOARD_PADDING in the JS. Only shown while editing. */
  .photo-board-bounds {
    position: absolute;
    top: 20px; left: 20px; right: 20px; bottom: 20px;
    border: 1.5px dashed var(--border-divider);
    border-radius: 10px;
    pointer-events: none;
    z-index: 0;
  }
  .photo-item {
    position: absolute;
    top: 0; left: 0;
    /* no card / background — just the raw image */
    background: transparent;
    user-select: none;
    touch-action: none;
    cursor: default;
  }
  .photo-item.editable { cursor: grab; }
  .photo-item.editable:active { cursor: grabbing; }
  .photo-item img {
    display: block; width: 100%; height: auto;
    border-radius: 3px; pointer-events: none;
  }
  .photo-resize-handle {
    position: absolute;
    right: -7px; bottom: -7px;
    width: 16px; height: 16px;
    border-radius: 50%;
    background: var(--accent);
    border: 2px solid var(--bg-card);
    cursor: nwse-resize;
    touch-action: none;
  }
  .photo-resize-handle:hover { background: var(--accent-hover); }
  .photo-rotate-handle {
    position: absolute;
    top: -28px; left: 50%; transform: translateX(-50%);
    width: 20px; height: 20px; border-radius: 50%;
    background: var(--bg-card); border: 2px solid var(--accent);
    display: flex; align-items: center; justify-content: center;
    font-size: 11px; color: var(--accent);
    cursor: grab; touch-action: none;
  }
  .photo-rotate-handle:active { cursor: grabbing; }
  .photo-rotate-handle::after {
    content: ""; position: absolute; bottom: -11px; left: 50%;
    width: 1px; height: 11px; background: var(--accent-soft);
    transform: translateX(-50%);
  }

  /* ── EDIT / SAVE / CANCEL CONTROLS (sits below the flower.png) ── */
  .photo-edit-controls { display: flex; align-items: center; justify-content: center; width: 100%; }
  .edit-toggle-btn {
    display: flex; align-items: center; gap: 6px;
    background: var(--bg-card); border: 1.5px solid var(--border-soft);
    border-radius: 999px; padding: 8px 16px; cursor: pointer;
    font-family: 'Inter', sans-serif; font-size: 12px; font-weight: 500;
    color: var(--text-body); box-shadow: 0 4px 16px rgba(139,92,246,0.12);
    transition: border-color 0.2s ease, color 0.2s ease;
  }
  .edit-toggle-btn:hover { border-color: var(--accent-soft); color: var(--text-heading); }
  .edit-actions { display: flex; align-items: center; gap: 10px; }
  .edit-hint {
    font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 400;
    color: var(--text-muted); margin-right: 4px;
  }
  .edit-action-btn {
    width: 34px; height: 34px; border-radius: 50%; border: none;
    display: flex; align-items: center; justify-content: center;
    font-size: 15px; cursor: pointer; flex-shrink: 0;
    transition: transform 0.15s ease, background 0.2s ease;
  }
  .edit-action-btn:hover { transform: scale(1.08); }
  .edit-action-btn.confirm { background: var(--accent); color: #ffffff; }
  .edit-action-btn.confirm:hover { background: var(--accent-hover); }
  .edit-action-btn.cancel { background: var(--bg-chip); color: var(--text-body); }
  .edit-action-btn.cancel:hover { background: var(--bg-chip-hover); color: var(--text-heading); }

  .blog-tag {
    display: inline-block; font-family: 'Cormorant Garant', serif;
    font-style: italic; font-size: 18px; font-weight: 300; color: var(--accent);
    border: 1px solid var(--border-divider); border-radius: 2px; padding: 6px 18px;
    width: fit-content; letter-spacing: 0.04em;
    transition: background 0.2s ease, color 0.2s ease; cursor: pointer;
  }
  .blog-tag:hover { background: var(--bg-fav-hover); color: var(--text-heading); }

  /* ── RIGHT ── */
  .right {
    background: var(--bg-panel); display: flex; flex-direction: column;
    align-items: center;
    padding: 20px 40px 40px 40px;
    gap: 0; position: relative; transition: background 0.25s ease;
    min-width: 0;
  }

  /* Scaler wrapper: reserves only the visually-scaled height so the layout
     doesn't leave a big empty gap under the shrunk GIF stack. */
  .gif-stack-scaler {
    width: 100%;
    display: flex;
    justify-content: center;
    /* overflow stays visible at full scale so me.gif's intentional
       off-the-edge bleed still shows on desktop; only breakpoints that
       shrink --gif-scale below 1 turn overflow: hidden back on below. */
    overflow: visible;
    height: auto;
  }
  .gif-stack {
    position: relative; width: 400px; margin-bottom: 16px; margin-left: 20px; flex-shrink: 0;
    transform: scale(var(--gif-scale));
    transform-origin: top center;
  }
  .gif-img { display: block; width: 400px; height: auto; margin-left: 20px; }
  .gif-layer-bottom { position: relative; top: 180px; }
  .gif-img.gif-layer-top { width: 250px; }
  .gif-layer-top { position: absolute; top: 0; left: 230px; pointer-events: none; }
  .gif-img.gif-layer-side { width: 250px; }   /* ← SIZE: change this */
  .gif-layer-side {
    position: absolute;
    top: -20px;    /* ← VERTICAL position */
    left: 0px;  /* ← HORIZONTAL position (negative pulls it further left, off the stack) */
    pointer-events: none;
    z-index: 1;   /* ← raise above 1 to sit in front of the bottom gif, above me.gif's z-index to sit in front of it too */
  }
  .gif-img.gif-layer-reaction { width: 495px; }
  .gif-layer-reaction { position: absolute; top: -20px; left: 0px; pointer-events: none; }

  /* ── PAWBOT CARD ── */
  .pawbot-card {
    height: var(--card-h); width: 100%; max-width: 500px;
    background: var(--bg-card); border-radius: 28px;
    box-shadow: 0 4px 32px rgba(139,92,246,0.10), 0 1px 6px rgba(139,92,246,0.06);
    display: flex; flex-direction: column; overflow: hidden;
    margin-top: var(--card-margin-top);
    margin-bottom: 40px; transition: background 0.25s ease, height 0.2s ease, margin-top 0.2s ease;
    position: relative;
  }

  .idle-overlay {
    position: absolute;
    width: 130px;   /* ← SIZE */
    max-width: 32%;
    bottom: -20px;  /* ← VERTICAL */
    left: 16px;     /* ← HORIZONTAL */
    height: auto; pointer-events: none; opacity: 1;
    transition: opacity 200ms ease; z-index: 10;
  }
  .idle-overlay.hidden { opacity: 0; }
  .idle-overlay-img { width: 100%; height: auto; display: block; }

  .doc-status {
    position: absolute; top: 60px; left: 0; right: 0; z-index: 20;
    text-align: center; font-family: 'Inter', sans-serif; font-size: 11px;
    font-weight: 400; color: var(--text-muted); padding: 4px 0; pointer-events: none;
  }

  .pawbot-header {
    padding: 20px 24px 16px; display: flex; align-items: center;
    justify-content: space-between; background: var(--bg-header);
    border-bottom: 1px solid var(--border-header); flex-shrink: 0;
  }
  .pawbot-header-left { display: flex; align-items: center; gap: 10px; min-width: 0; }
  .pawbot-sparkles { display: flex; flex-direction: column; gap: 2px; }
  .spark { color: var(--accent-soft); font-size: 10px; }
  .spark.big { font-size: 15px; }
  .pawbot-title-block { display: flex; flex-direction: column; align-items: center; min-width: 0; }
  .pawbot-name {
    font-family: 'Inter', sans-serif; font-weight: 700; font-size: 20px;
    color: var(--text-heading); letter-spacing: -0.01em;
    display: flex; align-items: center; gap: 4px;
  }
  .pawbot-heart { font-size: 14px; }
  .pawbot-subtitle {
    font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 400;
    color: var(--text-muted); letter-spacing: 0.02em; text-align: center;
  }
  .pawbot-fav-btn {
    width: 38px; height: 38px; border-radius: 12px; flex-shrink: 0;
    border: 1.5px solid var(--border-soft); background: transparent;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; color: var(--accent-soft); font-size: 16px;
    transition: background 0.2s, color 0.2s;
  }
  .pawbot-fav-btn:hover { background: var(--bg-fav-hover); color: var(--accent); }

  .pawbot-messages {
    flex: 1; min-height: 0; overflow-y: auto; padding: 20px 20px 12px;
    display: flex; flex-direction: column; gap: 12px;
    -webkit-overflow-scrolling: touch;
  }
  .pawbot-messages::-webkit-scrollbar { width: 4px; }
  .pawbot-messages::-webkit-scrollbar-track { background: transparent; }
  .pawbot-messages::-webkit-scrollbar-thumb { background: var(--scrollbar-thumb); border-radius: 4px; }

  .msg-row { display: flex; }
  .msg-row.user { justify-content: flex-end; }
  .msg-row.assistant { justify-content: flex-start; }
  .msg-bubble {
    max-width: 80%; padding: 10px 14px; border-radius: 18px;
    font-size: 13px; line-height: 1.55; font-family: 'Inter', sans-serif; font-weight: 400;
    word-break: break-word;
  }
  .msg-bubble.assistant { background: var(--bg-bubble-assistant); color: var(--text-heading); border-bottom-left-radius: 6px; }
  .msg-bubble.user { background: var(--accent); color: var(--user-bubble-text); border-bottom-right-radius: 6px; }

  .suggested-grid {
    display: flex; flex-direction: row; gap: 8px; padding: 0 20px 8px; flex-shrink: 0;
    flex-wrap: wrap;
  }
  .suggested-chip {
    flex: 1 1 auto; min-width: 0; background: var(--bg-chip); border: none; border-radius: 16px;
    padding: 10px 12px; font-family: 'Inter', sans-serif; font-size: 12px;
    font-weight: 500; color: var(--text-body); cursor: pointer;
    line-height: 1.4; text-align: center; transition: background 0.18s, color 0.18s;
  }
  .suggested-chip:hover { background: var(--bg-chip-hover); color: var(--text-heading); }

  .typing-indicator {
    display: flex; align-items: center; gap: 4px; padding: 10px 14px;
    background: var(--bg-bubble-assistant); border-radius: 18px;
    border-bottom-left-radius: 6px; width: fit-content;
  }
  .typing-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: var(--accent-soft); animation: bounce 1.2s infinite ease-in-out;
  }
  .typing-dot:nth-child(2) { animation-delay: 0.2s; }
  .typing-dot:nth-child(3) { animation-delay: 0.4s; }
  @keyframes bounce {
    0%, 60%, 100% { transform: translateY(0); }
    30% { transform: translateY(-5px); }
  }

  .pawbot-input-row {
    padding: 12px 16px 16px 122px; display: flex; align-items: center;
    gap: 10px; border-top: 1px solid var(--border-input-row); flex-shrink: 0;
  }
  .pawbot-input {
    flex: 1; min-width: 0; background: var(--bg-input); border: none; border-radius: 24px;
    padding: 11px 18px; font-family: 'Inter', sans-serif; font-size: 16px;
    color: var(--text-heading); outline: none; transition: background 0.2s;
  }
  .pawbot-input::placeholder { color: var(--text-placeholder); }
  .pawbot-input:focus { background: var(--bg-input-focus); }
  .pawbot-send-btn {
    width: 42px; height: 42px; border-radius: 50%; border: none;
    background: var(--accent); color: white; font-size: 18px;
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; flex-shrink: 0; transition: background 0.2s, transform 0.15s;
  }
  .pawbot-send-btn:hover { background: var(--accent-hover); transform: scale(1.05); }
  .pawbot-send-btn:disabled { background: var(--accent-disabled); cursor: not-allowed; transform: none; }

  .page {
    min-height: calc(100vh - 66px);
    display: grid; grid-template-columns: 1fr 1fr;
    position: relative;
  }

  /* ===========================
     BREAKPOINTS
     =========================== */

  /* Smaller laptops / narrow desktops: keep the two-column layout but
     tighten paddings and shrink the decorative stack + card a touch so
     nothing overflows or collides. */
  @media (max-width: 1180px) {
    .theme-root { --gif-scale: 0.85; --card-h: 460px; --card-margin-top: 80px; }
    .left { padding: 32px 36px 48px 40px; gap: 36px; }
    .right { padding: 20px 24px 32px; }
    .gif-stack-scaler {
      overflow: hidden;
      height: calc(var(--gif-stack-h) * var(--gif-scale));
    }
  }

  /* Tablets / large phones: stack the columns, chat card becomes full width. */
  @media (max-width: 900px) {
    .page { grid-template-columns: 1fr; }
    .left {
      border-right: none; border-bottom: 1px solid var(--border-soft);
      padding: 40px 28px; gap: 28px;
    }
    .right { padding: 32px 20px 40px; }
    .theme-root { --gif-scale: 0.7; --card-h: 480px; --card-margin-top: 24px; }
    .pawbot-input-row { padding-left: 90px; }
  }

  @media (max-width: 768px) {
    .navbar { padding: 14px 20px; }
    .navbar-links { gap: 18px; }
    .navbar-title { font-size: 15px; }
    .navbar-right { gap: 14px; }
  }

  /* Phones */
  @media (max-width: 560px) {
    .theme-root { --gif-scale: 0.55; --card-h: 440px; --card-margin-top: 12px; }
    .left { padding: 32px 20px; gap: 24px; }
    .right { padding: 20px 14px 32px; }
    .eyebrow { font-size: clamp(36px, 12vw, 52px); }
    .item-text { font-size: 13px; }
    .pawbot-card { border-radius: 20px; }
    .pawbot-input-row { padding: 10px 12px 14px 70px; }
    .idle-overlay { width: 90px; }
    .pawbot-header { padding: 16px 16px 12px; }
    .pawbot-name { font-size: 17px; }
    .pawbot-subtitle { font-size: 10px; }
    .suggested-grid { flex-direction: column; }
    .suggested-chip { text-align: left; }
    .navbar { flex-direction: column; align-items: flex-start; gap: 8px; }
    .navbar-right { width: 100%; justify-content: space-between; }
  }

  @media (max-width: 400px) {
    .theme-root { --gif-scale: 0.46; --card-h: 400px; }
    .idle-overlay { width: 70px; }
    .pawbot-input-row { padding-left: 56px; }
  }
`;
const INTRO_TEXT = `Heya Heya :3 I'm Hasini, a first year CE student at Waterloo! I really love building cool and fun stuff in my pastime! I'm a vocalist, a reader, an engineer, and have a dashhund named Sigma!`;

function Typewriter({ text, speed = 35 }) {
  const [displayed, setDisplayed] = useState("");

  useEffect(() => {
    let i = 0;

    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i + 1));
      i++;

      if (i >= text.length) clearInterval(interval);
    }, speed);

    return () => clearInterval(interval);
  }, [text, speed]);

  return <span>{displayed}</span>;
}
export default function AboutPage() {
  const activePage = "About";

  // The "true" layout is savedPhotos. While editing, changes happen on
  // draftPhotos only — nothing touches savedPhotos until Save is pressed,
  // so Cancel can throw the draft away with zero side effects.
  const [savedPhotos, setSavedPhotos] = useState(INITIAL_PHOTOS);
  const [draftPhotos, setDraftPhotos] = useState(INITIAL_PHOTOS);
  const [isEditing, setIsEditing] = useState(false);
  const displayedPhotos = isEditing ? draftPhotos : savedPhotos;
  const boardRef = useRef(null);

  const { onDragStart, onResizeStart, onRotateStart, itemRefs } = usePhotoBoard(
    displayedPhotos,
    isEditing ? setDraftPhotos : () => {},
    isEditing,
    boardRef
  );

  const startEditingPhotos = () => {
    setDraftPhotos(savedPhotos);
    setIsEditing(true);
  };
  const saveEditingPhotos = () => {
    setSavedPhotos(draftPhotos);
    setIsEditing(false);
  };
  const cancelEditingPhotos = () => {
    setIsEditing(false); // draftPhotos just gets thrown away next edit
  };

  const [theme, setTheme] = useState("light");
  const [transitioning, setTransitioning] = useState(false);
  const [transitionFading, setTransitionFading] = useState(false);
  const TRANSITION_GIF_DURATION_MS = 2200;
  const TRANSITION_FADE_MS = 500;

  const toggleTheme = () => {
    if (transitioning) return;
    if (theme === "light") {
      // light → dark
      setTransitioning(true);
      setTransitionFading(false);
      setTimeout(() => {
        setTheme("dark");
        setTransitionFading(true);
        setTimeout(() => { setTransitioning(false); setTransitionFading(false); }, TRANSITION_FADE_MS);
      }, TRANSITION_GIF_DURATION_MS);
    } else {
      // dark → light — same gif, same timing
      setTransitioning(true);
      setTransitionFading(false);
      setTimeout(() => {
        setTheme("light");
        setTransitionFading(true);
        setTimeout(() => { setTransitioning(false); setTransitionFading(false); }, TRANSITION_FADE_MS);
      }, TRANSITION_GIF_DURATION_MS);
    }
  };

  const [gifFrozen, setGifFrozen] = useState(false);
  const gifTimerRef = useRef(null);
  const GIF_DURATION_MS = 3000;
  useEffect(() => {
    gifTimerRef.current = setTimeout(() => setGifFrozen(true), GIF_DURATION_MS);
    return () => clearTimeout(gifTimerRef.current);
  }, []);

  const [meGifReplaced, setMeGifReplaced] = useState(false);
  const [reactionVariant, setReactionVariant] = useState("light");
  const CLICK_GIF_DURATION_LIGHT_MS = 700;
  const CLICK_GIF_DURATION_DARK_MS  = 2300;
  const meGifClickTimerRef = useRef(null);
  const reactionGifRef = useRef(null);

  const handleMeGifClick = () => {
    if (meGifReplaced) return;
    const variant = theme === "dark" ? "dark" : "light";
    setReactionVariant(variant);
    const node = reactionGifRef.current;
    if (node) node.src = variant === "dark" ? "/me-click-dark.gif" : "/me-click.gif";
    setMeGifReplaced(true);
    meGifClickTimerRef.current = setTimeout(() => setMeGifReplaced(false),
      variant === "dark" ? CLICK_GIF_DURATION_DARK_MS : CLICK_GIF_DURATION_LIGHT_MS);
  };
  useEffect(() => { return () => clearTimeout(meGifClickTimerRef.current); }, []);

  const [sendGifPlaying, setSendGifPlaying] = useState(false);
  const [sendGifFading, setSendGifFading] = useState(false);
  const SEND_GIF_DURATION_MS = 3700;
  const SEND_GIF_FADE_MS = 200;
  const sendGifRef = useRef(null);
  const sendGifTimerRef = useRef(null);
  const barkAudioRef = useRef(null); // holds the bark Audio object

  // Pre-load the bark sound so it plays instantly on click
  useEffect(() => {
    barkAudioRef.current = new Audio("/bark.mp3"); // ← replace with your sound file path
    barkAudioRef.current.volume = 1.0;             // ← adjust volume 0.0–1.0
    return () => {
      if (barkAudioRef.current) {
        barkAudioRef.current.pause();
        barkAudioRef.current = null;
      }
    };
  }, []);

  const [docContent, setDocContent] = useState("");
  const [docStatus, setDocStatus] = useState("loading");

  useEffect(() => {
    const fetchDoc = async () => {
      try {
        const url = `https://docs.google.com/document/d/${GOOGLE_DOC_ID}/export?format=txt`;
        const res = await fetch(url);
        if (!res.ok) throw new Error("Could not fetch doc");
        const text = await res.text();
        setDocContent(text);
        setDocStatus("ready");
      } catch {
        setDocStatus("error");
      }
    };
    fetchDoc();
  }, []);

  const systemPrompt = docStatus === "ready" && docContent
    ? `${BASE_SYSTEM_PROMPT}\n\n--- INFORMATION ABOUT HASINI (from her Google Doc) ---\n${docContent}`
    : BASE_SYSTEM_PROMPT;

  const [messages, setMessages] = useState([
    { role: "assistant", text: "Hey! I'm PawBot 🐾 Ask me anything about Hasini!" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef(null);
  const pendingTextRef = useRef("");

  useEffect(() => {
    if (messagesRef.current) messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
  }, [messages, loading]);

  const activateCursor = () => document.body.classList.add("custom-cursor");

  const sendMessage = async (text) => {
    const userText = text.trim();
    if (!userText) return;
    const newMessages = [...messages, { role: "user", text: userText }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const groqMessages = [
        { role: "system", content: systemPrompt },
        ...newMessages
          .filter((m) => !(m.role === "assistant" && m.text.startsWith("Hey! I'm PawBot")))
          .map((m) => ({ role: m.role, content: m.text })),
      ];
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: groqMessages,
          max_tokens: 300,
        }),
      });
      const data = await res.json();
      const reply = data?.choices?.[0]?.message?.content ||
        `Error ${res.status}: ${data?.error?.message || JSON.stringify(data)}`;
      setMessages((prev) => [...prev, { role: "assistant", text: reply }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: "assistant", text: `Network error: ${err.message}` }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (text) => {
    const userText = (typeof text === "string" ? text : input).trim();
    if (!userText || loading || sendGifPlaying) return;
    pendingTextRef.current = userText;
    setInput("");

    // Restart send gif from frame 0
    const node = sendGifRef.current;
    if (node) { node.src = ""; node.src = "/send.gif"; }

    // Play bark sound from the start
    const bark = barkAudioRef.current;
    if (bark) { bark.currentTime = 0; bark.play().catch(() => {}); }

    setSendGifPlaying(true);
    setSendGifFading(false);
    sendGifTimerRef.current = setTimeout(() => {
      setSendGifFading(true);
      setTimeout(() => {
        setSendGifPlaying(false);
        setSendGifFading(false);
        // Stop bark when message is sent
        if (barkAudioRef.current) { barkAudioRef.current.pause(); barkAudioRef.current.currentTime = 0; }
        sendMessage(pendingTextRef.current);
      }, SEND_GIF_FADE_MS);
    }, SEND_GIF_DURATION_MS);
  };
  useEffect(() => { return () => clearTimeout(sendGifTimerRef.current); }, []);

  const handleKey = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } };
  const showSuggested = messages.length <= 1;

  return (
    <>
      <style>{PAGE_STYLES}</style>
      <div className={`theme-root${theme === "dark" ? " dark" : ""}`}>

        {transitioning && (
          <div className={`theme-transition-overlay${transitionFading ? " fading" : ""}`}>
            <img src="/theme-transition.gif" alt="" className="theme-transition-gif" />
          </div>
        )}

        <nav className="navbar">
          <div className="navbar-links">
            {NAV_ITEMS.map((navItem) => (
              <a
                key={navItem.label}
                href={navItem.href}
                className={`navbar-link${navItem.label === activePage ? " active" : ""}`}
              >
                {navItem.label}
              </a>
            ))}
          </div>
          <div className="navbar-right">
            <button className="theme-toggle" onClick={toggleTheme} disabled={transitioning} title="Toggle theme">
              <span className="theme-toggle-icon">{theme === "light" ? "☀️" : "🌙"}</span>
              {theme === "light" ? "Light" : "Dark"}
            </button>
            <span className="navbar-title">Hasini Vijay Inbasri</span>
          </div>
        </nav>

        <div className="page">
          <div className="left">
            <div className="heading-block">
              <p className="eyebrow">About me</p>
              <img src="/flower.png" alt="cursor icon" className="cursor-trigger" onClick={activateCursor} />
            </div>
            <div className="photo-board" ref={boardRef}>
              <img src="/corkboard.png" alt="" className="photo-board-background" />
              {isEditing && <div className="photo-board-bounds" />}
              {displayedPhotos.map((photo) => (
                <div
                  key={photo.id}
                  ref={(el) => (itemRefs.current[photo.id] = el)}
                  className={`photo-item${isEditing ? " editable" : ""}`}
                  style={{
                    left: photo.x,
                    top: photo.y,
                    width: photo.width,
                    zIndex: photo.z,
                    transform: `rotate(${photo.rotation}deg)`,
                  }}
                  onPointerDown={(e) => onDragStart(e, photo.id)}
                >
                  <img src={photo.src} alt={`photo ${photo.id}`} draggable={false} />
                  {isEditing && (
                    <>
                      <div
                        className="photo-resize-handle"
                        onPointerDown={(e) => onResizeStart(e, photo.id)}
                      />
                      <div
                        className="photo-rotate-handle"
                        onPointerDown={(e) => onRotateStart(e, photo.id)}
                      >
                        ⟳
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="photo-edit-controls">
              {!isEditing ? (
                <button className="edit-toggle-btn" onClick={startEditingPhotos}>
                  ✏️ Design the board!
                </button>
              ) : (
                <div className="edit-actions">
                  <span className="edit-hint">Drag, resize, rotate — then</span>
                  <button className="edit-action-btn confirm" onClick={saveEditingPhotos} title="Save">✓</button>
                  <button className="edit-action-btn cancel" onClick={cancelEditingPhotos} title="Discard changes">✕</button>
                </div>
              )}
            </div>
            <span className="blog-tag">Blog</span>
          </div>

          <div className="right">
            <div className="gif-stack-scaler">
              <div className="gif-stack">
                <div className="intro-text">
                  <span className="type-cursor">
                    <Typewriter
                      text={INTRO_TEXT}
                      speed={28}   // smaller = faster typing
                    />
                  </span>
                </div>
                <img
                  src={gifFrozen ? "/your-animation-final-frame.png" : "/your-animation.gif"}
                  alt="character animation" className="gif-img gif-layer-bottom"
                />
                <img
                  src="/side-buddy.png" alt="side character" className="gif-img gif-layer-side"
                />
                <img
                  src="/me.gif" alt="overlay animation" className="gif-img gif-layer-top"
                  onClick={handleMeGifClick}
                  style={{
                    pointerEvents: meGifReplaced ? "none" : "auto", cursor: "pointer",
                    visibility: meGifReplaced ? "hidden" : "visible",
                    opacity: meGifReplaced ? 0 : 1, transition: "opacity 0.15s ease",
                  }}
                />
                <img
                  ref={reactionGifRef} src="/me-click.gif" alt="reaction animation"
                  className="gif-img gif-layer-reaction"
                  style={{
                    visibility: meGifReplaced ? "visible" : "hidden",
                    opacity: meGifReplaced ? 1 : 0, pointerEvents: "none",
                    transition: "opacity 0.15s ease",
                    ...(reactionVariant === "dark"
                      ? { width: "500px", top: "22px", left: "-10px" }
                      : { width: "495px", top: "-20px", left: "0px" }),
                  }}
                />
              </div>
            </div>

            <div className="pawbot-card">
              <div className={`idle-overlay${sendGifPlaying ? " hidden" : ""}`}>
                <img src="/idle.png" alt="" className="idle-overlay-img" />
              </div>
              <div className={`send-gif-overlay${sendGifPlaying && !sendGifFading ? " playing" : ""}${sendGifFading ? " fading" : ""}`}>
                <img ref={sendGifRef} src="/send.gif" alt="" className="send-gif-img" />
              </div>

              <div className="pawbot-header">
                <div className="pawbot-header-left">
                  <div className="pawbot-sparkles">
                    <span className="spark big">✦</span><span className="spark">✦</span>
                  </div>
                  <div className="pawbot-title-block">
                    <span className="pawbot-name">PawBot <span className="pawbot-heart">💜</span></span>
                    <span className="pawbot-subtitle">
                      AI Chat Companion
                      {docStatus === "loading" && " · loading info…"}
                      {docStatus === "error"   && " · (offline info)"}
                    </span>
                  </div>
                </div>
                <button className="pawbot-fav-btn" title="Favourite">♡</button>
              </div>

              <div className="pawbot-messages" ref={messagesRef}>
                {messages.map((m, i) => (
                  <div key={i} className={`msg-row ${m.role}`}>
                    <div className={`msg-bubble ${m.role}`}>{m.text}</div>
                  </div>
                ))}
                {loading && (
                  <div className="msg-row assistant">
                    <div className="typing-indicator">
                      <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
                    </div>
                  </div>
                )}
              </div>

              {showSuggested && (
                <div className="suggested-grid">
                  {SUGGESTED.map((s, i) => (
                    <button key={i} className="suggested-chip" onClick={() => handleSend(s)}>{s}</button>
                  ))}
                </div>
              )}

              <div className="pawbot-input-row">
                <input
                  className="pawbot-input" placeholder="Type your message..."
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKey} disabled={loading || sendGifPlaying}
                />
                <button className="pawbot-send-btn" onClick={() => handleSend()}
                  disabled={loading || sendGifPlaying || !input.trim()} title="Send">
                  🐾
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
