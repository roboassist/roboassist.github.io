document.addEventListener("DOMContentLoaded", () => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const heroVideo = document.querySelector("#hero-background-video");
  const heroVideoToggle = document.querySelector(".hero-video-toggle");

  if (heroVideo && heroVideoToggle) {
    const hero = heroVideo.closest(".project-hero");
    heroVideo.muted = true;

    const updateHeroPlayback = () => {
      heroVideoToggle.textContent = heroVideo.paused
        ? "Play background video"
        : "Pause background video";
    };

    heroVideo.addEventListener("loadeddata", () => {
      hero.classList.add("has-video");
      heroVideoToggle.hidden = false;
      updateHeroPlayback();
    });
    heroVideo.addEventListener("play", updateHeroPlayback);
    heroVideo.addEventListener("pause", updateHeroPlayback);
    heroVideo.addEventListener("error", () => {
      hero.classList.remove("has-video");
      heroVideoToggle.hidden = true;
    });
    heroVideoToggle.addEventListener("click", () => {
      if (heroVideo.paused) {
        heroVideo.play().catch(updateHeroPlayback);
      } else {
        heroVideo.pause();
      }
    });

    const applyMotionPreference = () => {
      heroVideo.autoplay = !reducedMotion.matches;
      if (reducedMotion.matches) heroVideo.pause();
      else heroVideo.play().catch(updateHeroPlayback);
    };
    reducedMotion.addEventListener("change", applyMotionPreference);
    applyMotionPreference();
    if (heroVideo.readyState >= 2) {
      hero.classList.add("has-video");
      heroVideoToggle.hidden = false;
      updateHeroPlayback();
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

  const faqList = document.querySelector("[data-faq-list]");

  if (faqList) {
    const questions = Array.from(faqList.querySelectorAll(".faq-question"));

    const setFaqState = (question, open) => {
      const answer = document.getElementById(question.getAttribute("aria-controls"));
      if (!answer) return;

      question.setAttribute("aria-expanded", String(open));
      question.closest(".faq-item")?.classList.toggle("is-open", open);

      if (reducedMotion.matches) {
        answer.style.height = open ? "auto" : "0px";
        answer.style.opacity = open ? "1" : "0";
        return;
      }

      if (open) {
        answer.style.height = `${answer.scrollHeight}px`;
        answer.style.opacity = "1";
        answer.addEventListener("transitionend", () => {
          if (question.getAttribute("aria-expanded") === "true") answer.style.height = "auto";
        }, { once: true });
      } else {
        if (answer.style.height === "auto") answer.style.height = `${answer.scrollHeight}px`;
        requestAnimationFrame(() => {
          answer.style.height = "0px";
          answer.style.opacity = "0";
        });
      }
    };

    questions.forEach((question) => {
      const answer = document.getElementById(question.getAttribute("aria-controls"));
      if (answer) {
        answer.style.height = "0px";
        answer.style.opacity = "0";
      }

      question.addEventListener("click", () => {
        const shouldOpen = question.getAttribute("aria-expanded") !== "true";
        questions.forEach((candidate) => setFaqState(candidate, candidate === question && shouldOpen));
      });
    });
  }

  const taskDemo = document.querySelector("[data-task-demo]");

  if (taskDemo) {
    const scene = taskDemo.querySelector("[data-task-scene]");
    const sendButton = taskDemo.querySelector("[data-task-send]");
    const instruction = taskDemo.querySelector("#task-instruction");
    const speech = taskDemo.querySelector("[data-task-speech]");
    const status = taskDemo.querySelector("[data-task-status]");
    const sceneStatus = taskDemo.querySelector("[data-scene-status]");
    const consoleState = taskDemo.querySelector("[data-console-state]");
    const steps = Array.from(taskDemo.querySelectorAll("[data-task-step]"));
    let rolloutTimers = [];

    const rollout = [
      { state: "understand", label: "Aligning request", delay: 0 },
      { state: "navigate", label: "Navigating to sterile table", delay: 1000 },
      { state: "pick", label: "Picking up gauze", delay: 2400 },
      { state: "return", label: "Returning to handover table", delay: 3600 },
      { state: "handover", label: "Handing over gauze", delay: 4800 },
      { state: "complete", label: "Task complete", delay: 6000 },
    ];

    const clearRollout = () => {
      rolloutTimers.forEach(window.clearTimeout);
      rolloutTimers = [];
    };

    const applyTaskState = (state, label) => {
      scene.dataset.taskState = state;
      status.textContent = label;
      sceneStatus.textContent = label;
      consoleState.textContent = state === "complete" ? "Complete" : "Executing";

      let activeIndex = rollout.findIndex((item) => item.state === state);
      if (state === "complete") activeIndex = steps.length;

      steps.forEach((step, index) => {
        step.classList.toggle("is-active", index === activeIndex);
        step.classList.toggle("is-complete", index < activeIndex || state === "complete");
      });

      if (state === "complete") {
        sendButton.disabled = false;
        sendButton.querySelector("span").textContent = "Replay";
      }
    };

    sendButton.addEventListener("click", () => {
      const command = instruction.value.trim();
      if (!command) {
        instruction.focus();
        status.textContent = "Enter an instruction first";
        return;
      }

      clearRollout();
      speech.textContent = command;
      sendButton.disabled = true;
      sendButton.querySelector("span").textContent = "Running";
      consoleState.textContent = "Planning";
      scene.dataset.taskState = "idle";
      steps.forEach((step) => step.classList.remove("is-active", "is-complete"));

      if (reducedMotion.matches) {
        applyTaskState("complete", "Task complete");
        return;
      }

      rollout.forEach(({ state, label, delay }) => {
        rolloutTimers.push(window.setTimeout(() => applyTaskState(state, label), delay));
      });
    });
  }

});
