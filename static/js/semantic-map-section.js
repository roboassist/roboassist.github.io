document.addEventListener('DOMContentLoaded', () => {
  const start = document.getElementById('semantic-start');
  const close = document.getElementById('semantic-close');
  const frame = document.getElementById('semantic-frame');
  const cover = document.getElementById('semantic-cover');
  if (!start || !frame) return;
  const signal = (type) => frame.contentWindow?.postMessage({ type }, location.origin);
  let inView = false;
  frame.addEventListener('load', () => signal(inView && !frame.hidden ? 'roboassist:resume' : 'roboassist:pause'));
  start.addEventListener('click', () => {
    if (!frame.getAttribute('src')) frame.src = frame.dataset.src;
    cover.hidden = true; frame.hidden = false; close.hidden = false;
    signal('roboassist:resume'); frame.focus({ preventScroll: true });
  });
  close.addEventListener('click', () => {
    signal('roboassist:pause'); frame.hidden = true; cover.hidden = false; close.hidden = true; start.focus();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      inView = entries[0].isIntersecting;
      signal(inView && !frame.hidden ? 'roboassist:resume' : 'roboassist:pause');
    }, { rootMargin:'120px' }).observe(frame);
  }
});
