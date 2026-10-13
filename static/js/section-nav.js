(() => {
  "use strict";
  const nav = document.querySelector(".section-nav");
  if (!nav) return;
  const disclosure = nav.querySelector("details");
  const toggle = nav.querySelector("summary");
  const links = Array.from(nav.querySelectorAll('.section-nav__list a[href^="#"]'));
  const chapters = links.map((link) => ({
    link,
    section: document.getElementById(link.hash.slice(1)),
  })).filter((chapter) => chapter.section);
  const wideScreen = window.matchMedia("(min-width: 1760px)");
  let scheduled = false;
  let activeLink = null;

  const update = () => {
    scheduled = false;
    let active = null;
    chapters.forEach((chapter) => {
      if (chapter.section.getBoundingClientRect().top <= 140) active = chapter;
    });
    // The final chapter may be too short to reach the activation line.
    if (window.scrollY > 0 && window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      active = chapters[chapters.length - 1];
    }
    nav.classList.toggle("is-before-content", !active);
    const nextLink = active ? active.link : null;
    if (nextLink === activeLink) return;
    activeLink = nextLink;
    chapters.forEach(({ link }) => {
      if (link === activeLink) link.setAttribute("aria-current", "location");
      else link.removeAttribute("aria-current");
    });
    if (wideScreen.matches && activeLink) {
      const panel = nav.querySelector(".section-nav__panel");
      const item = activeLink.getBoundingClientRect();
      const bounds = panel.getBoundingClientRect();
      if (item.top < bounds.top) panel.scrollTop -= bounds.top - item.top;
      else if (item.bottom > bounds.bottom) panel.scrollTop += item.bottom - bounds.bottom;
    }
  };

  const scheduleUpdate = () => {
    if (scheduled) return;
    scheduled = true;
    window.requestAnimationFrame(update);
  };

  const applyLayout = () => {
    disclosure.open = wideScreen.matches;
    scheduleUpdate();
  };
  wideScreen.addEventListener("change", applyLayout);
  window.addEventListener("scroll", scheduleUpdate, { passive: true });
  window.addEventListener("resize", scheduleUpdate);
  window.addEventListener("hashchange", scheduleUpdate);
  window.addEventListener("load", scheduleUpdate);
  // Refresh after images, embeds or expanding content change chapter positions.
  if ("ResizeObserver" in window) new ResizeObserver(scheduleUpdate).observe(document.querySelector("main"));

  nav.addEventListener("click", (event) => {
    const link = event.target.closest("a");
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!wideScreen.matches) {
      disclosure.open = false;
      // Keep keyboard focus visible after the menu closes; native anchors still navigate.
      toggle.focus({ preventScroll: true });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && disclosure.open && !wideScreen.matches) {
      disclosure.open = false;
      toggle.focus({ preventScroll: true });
    }
  });
  document.addEventListener("click", (event) => {
    if (!wideScreen.matches && !nav.contains(event.target)) disclosure.open = false;
  });
  applyLayout();
})();
