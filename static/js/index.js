document.addEventListener("DOMContentLoaded", () => {
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

});
