document.addEventListener("DOMContentLoaded", () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const demoVideo = document.querySelector("#main-demo-video");
  const demoPlaceholder = document.querySelector("#main-demo-placeholder");

  if (demoVideo) {
    const source = (demoVideo.dataset.src || "").trim();
    if (source && source.toUpperCase() !== "TODO") {
      demoVideo.src = source;
      demoVideo.hidden = false;
      if (demoPlaceholder) demoPlaceholder.hidden = true;
    }
  }

  const stepper = document.querySelector("[data-safety-stepper]");

  if (stepper) {
    const tabs = Array.from(stepper.querySelectorAll("[role='tab']"));
    const panels = Array.from(stepper.querySelectorAll("[role='tabpanel']"));
    const authorityLevels = Array.from(stepper.querySelectorAll("[data-authority-level]"));

    const activateSafetyLevel = (tab, moveFocus = false) => {
      const level = tab.dataset.safetyLevel;

      tabs.forEach((candidate) => {
        const isActive = candidate === tab;
        candidate.classList.toggle("is-active", isActive);
        candidate.setAttribute("aria-selected", String(isActive));
        candidate.tabIndex = isActive ? 0 : -1;
      });

      panels.forEach((panel) => {
        const isActive = panel.dataset.safetyPanel === level;
        panel.classList.remove("is-active");
        panel.hidden = !isActive;
        panel.setAttribute("aria-hidden", String(!isActive));

        if (isActive) {
          void panel.offsetWidth;
          panel.classList.add("is-active");
        }
      });

      authorityLevels.forEach((item) => {
        item.classList.toggle("is-current", item.dataset.authorityLevel === level);
      });

      if (moveFocus) tab.focus();
    };

    tabs.forEach((tab, index) => {
      tab.addEventListener("click", () => activateSafetyLevel(tab));
      tab.addEventListener("keydown", (event) => {
        let targetIndex = index;

        if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          targetIndex = (index + 1) % tabs.length;
        } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          targetIndex = (index - 1 + tabs.length) % tabs.length;
        } else if (event.key === "Home") {
          targetIndex = 0;
        } else if (event.key === "End") {
          targetIndex = tabs.length - 1;
        } else {
          return;
        }

        event.preventDefault();
        activateSafetyLevel(tabs[targetIndex], true);
      });
    });
  }

  const chapterLinks = Array.from(document.querySelectorAll("[data-chapter-link]"));
  const chapterSections = chapterLinks
    .map((link) => document.querySelector(link.getAttribute("href")))
    .filter(Boolean);

  const setActiveChapter = (sectionId) => {
    chapterLinks.forEach((link) => {
      const isActive = link.getAttribute("href") === `#${sectionId}`;
      link.classList.toggle("is-active", isActive);
      if (isActive) {
        link.setAttribute("aria-current", "true");
      } else {
        link.removeAttribute("aria-current");
      }
    });
  };

  chapterLinks.forEach((link) => {
    link.addEventListener("click", (event) => {
      const target = document.querySelector(link.getAttribute("href"));
      if (!target) return;

      event.preventDefault();
      target.scrollIntoView({
        behavior: reducedMotion.matches ? "auto" : "smooth",
        block: "start",
      });
      window.history.replaceState(null, "", link.getAttribute("href"));
      setActiveChapter(target.id);
    });
  });

  if ("IntersectionObserver" in window && chapterSections.length) {
    const chapterObserver = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        if (visibleEntries.length) {
          setActiveChapter(visibleEntries[0].target.id);
        }
      },
      { rootMargin: "0px 0px -70% 0px", threshold: 0.01 },
    );

    chapterSections.forEach((section) => chapterObserver.observe(section));
  }

});
