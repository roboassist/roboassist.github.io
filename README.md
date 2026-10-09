# RoboAssist Project Website

Official project page for **RoboAssist: Interactive Human–Humanoid Planning for Long-Horizon Surgical Assistance**.

The site is a framework-free GitHub Pages project built with HTML, CSS, and JavaScript. Its structure is adapted from the [RoboNurse-VLA project page](https://github.com/RoboNurse-VLA/robonurse-vla.github.io).

## Website features

- Eight demonstration scenes, displayed four per page.
- Synchronized auxiliary camera views for long-horizon execution and interactive replanning.
- Click or tap a video picture to play/pause; drag the shared timeline to seek.
- Playback speeds from 0.5× to 3×, picture-in-picture, and split view.
- Responsive desktop and mobile layouts.

Publication videos are H.264 MP4 web copies with fast-start metadata, capped bitrate, and **no audio tracks**. Original research recordings are not included in this publication snapshot. Browser playback is also fixed to mute. The web compression does not change clip timing or scientific text. Auxiliary time offsets are preview settings, not independently calibrated camera alignment.

## Local preview

Double-click `start-preview.cmd` on Windows, or run:

```sh
python tools/preview.py --port 8000
```

Open `http://127.0.0.1:8000/`. Keep the server terminal open. The included server supports byte-range requests needed for video seeking; an ordinary `python -m http.server` may not support them.

## Files and deployment

- `index.html`: paper project page and scientific sections.
- `static/js/demos-config.js`: scene, media, crop, and camera configuration.
- `static/js/demonstrations.js`: gallery pagination and playback controls.
- `static/css/`: existing visual system and demonstration styling.
- `static/videos/`: silent web-ready recordings and real scene covers.

GitHub Pages deploys the repository's `main` branch from its root directory. No package manager or build framework is required.

Paper and code links, complete BibTeX metadata, and the full supplementary-video link remain pending. Author information is not added during review.
