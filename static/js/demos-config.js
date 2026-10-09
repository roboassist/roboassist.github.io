// Enable a resource only after uploading its real file. Unavailable resources are never requested.
// Mapping: auxiliaryTime = mainTime + timeOffset (seconds).
window.ROBOASSIST_DEMOS = {
  supplementary: { src: "./static/videos/full-supplementary.mp4", available: false },
  scenes: [
    {
      id: "long-horizon",
      title: "Long-Horizon Task Execution",
      description: "Continuous navigation, grasping, transport, and handover across a long-horizon assistance task.",
      main: { src: "./static/videos/long-horizon/main.mp4?v=20261009-release", available: true, displayCrop: { x: 0, y: 90, width: 960, height: 540 } },
      poster: { src: "./static/videos/long-horizon/poster.jpg?v=20261008-3", available: true },
      views: [
        // Initial preview uses zero offsets; matching durations do not prove camera alignment.
        { id: "head", label: "Head Camera", type: "video", src: "./static/videos/long-horizon/head.mp4?v=20261008-range-seek", available: true, timeOffset: 0 },
        { id: "handover", label: "Sterile Table Camera", type: "video", src: "./static/videos/long-horizon/handover.mp4?v=20261008-range-seek", available: true, timeOffset: 0 },
        { id: "delivery", label: "Delivery Close-Up", type: "video", src: "./static/videos/long-horizon/delivery.mp4?v=20261009-release", available: true, timeOffset: 0, displayCrop: { x: 0, y: 110, width: 960, height: 540 } },
      ],
      events: [],
    },
    {
      id: "replanning",
      title: "Interactive Task Replanning",
      description: "Residual replanning updates the remaining task sequence after a change in the surgeon’s request.",
      main: { src: "./static/videos/replanning/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/replanning/poster.jpg?v=20261009-silent-files", available: true },
      views: [
        // Zero offsets are for preview; confirm matching actions before calibration.
        { id: "head", label: "Head Camera", type: "video", src: "./static/videos/replanning/head.mp4?v=20261009-release", available: true, timeOffset: 0, displayCrop: { x: 172, y: 0, width: 936, height: 720 } },
        { id: "handover", label: "Handover Table Camera", type: "video", src: "./static/videos/replanning/handover.mp4?v=20261009-release", available: true, timeOffset: 0, displayCrop: { x: 168, y: 0, width: 944, height: 720 } },
        { id: "delivery", label: "Handover Close-Up", type: "video", src: "./static/videos/replanning/delivery.mp4?v=20261009-release", available: true, timeOffset: 0, displayCrop: { x: 6, y: 0, width: 1268, height: 720 } },
      ],
      // Add only verified times: { time: secondsOnMainVideo, label: "Request Change" }.
      events: [],
    },
    {
      id: "navigation",
      title: "Surgeon-Aware Navigation",
      description: "Speed regulation and stopping behavior near the surgeon’s protected operating region.",
      main: { src: "./static/videos/navigation/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/navigation/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
    {
      id: "safe-delivery",
      title: "Safe Delivery",
      description: "Robot assistance during a safe delivery task.",
      main: { src: "./static/videos/safe-delivery/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/safe-delivery/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
    {
      id: "handover",
      title: "Safe Human–Robot Handover — Medical Aluminum Box",
      description: "Single-object handover demonstration with a medical aluminum box.",
      main: { src: "./static/videos/handover/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/handover/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
    {
      id: "handover-disinfectant",
      title: "Safe Human–Robot Handover — Disinfectant",
      description: "Single-object handover demonstration with a disinfectant container.",
      main: { src: "./static/videos/handover/disinfectant/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/handover/disinfectant/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
    {
      id: "handover-gauze",
      title: "Safe Human–Robot Handover — Gauze",
      description: "Single-object handover demonstration with gauze.",
      main: { src: "./static/videos/handover/gauze/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/handover/gauze/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
    {
      id: "handover-alcohol-bottle",
      title: "Safe Human–Robot Handover — Alcohol Bottle",
      description: "Single-object handover demonstration with an alcohol bottle.",
      main: { src: "./static/videos/handover/alcohol-bottle/main.mp4?v=20261009-silent-files", available: true },
      poster: { src: "./static/videos/handover/alcohol-bottle/poster.jpg?v=20261009-silent-files", available: true },
      views: [],
      events: [],
    },
  ],
};
