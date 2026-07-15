import { useState, useEffect } from "react";

/* ====== NAVBAR CONTROLS ====== */
const NAV_LOGO_SRC = "/logo.png";   // path to your logo image — drop the file into your /public folder
const NAV_LOGO_SIZE = 40;           // desktop logo height in px — change this to scale it
const MOBILE_NAV_LOGO_SIZE = 30;    // mobile logo height in px — change this to scale it on phones
const NAV_TABS = [
  { label: "Home", href: "/" },
  { label: "About Me", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Blog", href: "/blog" },
];
const NAV_HEIGHT = 68;        // px, desktop
const MOBILE_NAV_HEIGHT = 56; // px, phones
const MOBILE_BREAKPOINT = 640;

/* ====== BACKGROUND CONTROLS ====== */
const BG_GIF = "/blog-background.gif";

export default function Blog() {
  const [isMobile, setIsMobile] = useState(false);
  const [theme, setTheme] = useState("dark"); // "dark" | "light"
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    const checkSize = () => setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    checkSize();
    window.addEventListener("resize", checkSize);
    return () => window.removeEventListener("resize", checkSize);
  }, []);

  useEffect(() => {
    if (!isMobile) setIsMenuOpen(false);
  }, [isMobile]);

  const navHeight = isMobile ? MOBILE_NAV_HEIGHT : NAV_HEIGHT;
  const navLogoSize = isMobile ? MOBILE_NAV_LOGO_SIZE : NAV_LOGO_SIZE;
  const isLight = theme === "light";

  return (
    <>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        html, body {
          height: 100%;
          overflow: hidden;
          background: #000;
        }

        .bg-page {
          position: fixed;
          inset: 0;
          width: 100vw;
          height: 100vh;
          height: 100dvh;
          overflow: hidden;
        }

        .bg-gif {
          width: 100%;
          height: 100%;
          object-fit: cover;
          object-position: center;
          display: block;
        }

        /* ===== NAVBAR ===== */
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
          z-index: 10;
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

        .navbar-tab:hover {
          opacity: 1;
        }

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

        .navbar-tab:hover::after {
          width: 100%;
        }

        .navbar-right {
          display: flex;
          align-items: center;
          gap: 20px;
        }

        /* Theme toggle switch */
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

        .theme-toggle-knob svg {
          width: 13px;
          height: 13px;
        }

        /* Mobile hamburger button */
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

        /* Mobile dropdown panel */
        .mobile-dropdown {
          position: fixed;
          top: var(--nav-height);
          left: 0;
          right: 0;
          z-index: 9;
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
      `}</style>

      <div className="bg-page">
        <img src={BG_GIF} alt="" className="bg-gif" />
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
    </>
  );
}
