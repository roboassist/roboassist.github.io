# Recorded workspace environment

`room_full_01_clean.glb` is the user-supplied environment model (2026-10-11).
Its embedded metadata describes a photo-guided reconstruction with approximate dimensions.
The original file is copied unchanged; the `.blend` authoring file stays outside the website.

`static/js/room-model.js` loads the GLB using the locally vendored Three.js r170
GLTFLoader, converts Y-up into the existing Z-up animation space, and aligns the
laparoscopic trainer with the surgeon. The pickup anchor and table labels come
from named model objects. Near-side walls are hidden dynamically for a cutaway
view; no geometry is deleted from the source asset.

The G1 rig, surgeon, transferable gauze, dialogue, buttons, and task timeline are
separate from this static environment. Navigation retains the existing sequence,
with its sterile-table endpoint calibrated to the new pickup position.

The scene model is user-supplied content, not covered by the Three.js vendor license.
GLTFLoader and BufferGeometryUtils use the included `static/vendor/three/LICENSE.txt`.
