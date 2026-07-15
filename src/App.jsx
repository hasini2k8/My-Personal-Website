import { useRef, useEffect } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./Home";
import About from "./About";
import Project from "./Project";
import Blog from "./Blog";

export default function App() {
  const audioRef = useRef(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    // Most browsers block audio-with-sound autoplay until the user
    // interacts with the page. Try to play immediately; if it's
    // blocked, fall back to starting on the first click/keypress.
    const tryPlay = () => audio.play().catch(() => {});

    tryPlay();

    const resumeOnInteraction = () => {
      tryPlay();
      window.removeEventListener("click", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
    };

    window.addEventListener("click", resumeOnInteraction);
    window.addEventListener("keydown", resumeOnInteraction);

    return () => {
      window.removeEventListener("click", resumeOnInteraction);
      window.removeEventListener("keydown", resumeOnInteraction);
    };
  }, []);

  return (
    <BrowserRouter>
      <audio ref={audioRef} src="/theme.mp3" loop autoPlay />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />
        <Route path="/projects" element={<Project />} />
        <Route path="/blog" element={<Blog />} />
      </Routes>
    </BrowserRouter>
  );
}