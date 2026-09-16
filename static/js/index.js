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

  const copyButton = document.querySelector("#copy-bibtex");
  const bibtexCode = document.querySelector("#bibtex-code");
  const copyStatus = document.querySelector("#copy-status");

  if (!copyButton || !bibtexCode || !copyStatus) return;

  copyButton.addEventListener("click", async () => {
    const citation = bibtexCode.textContent.trim();

    try {
      await navigator.clipboard.writeText(citation);
      copyButton.textContent = "Copied";
      copyStatus.textContent = "BibTeX copied to clipboard.";
    } catch (error) {
      const range = document.createRange();
      range.selectNodeContents(bibtexCode);
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      copyStatus.textContent = "Clipboard access was unavailable. The BibTeX text is selected for manual copying.";
    }

    window.setTimeout(() => {
      copyButton.textContent = "Copy BibTeX";
    }, 1800);
  });
});
