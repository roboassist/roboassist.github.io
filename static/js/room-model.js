import * as T from '../vendor/three/three.module.js';
import { GLTFLoader } from '../vendor/three/GLTFLoader.js';

// Only the environment is replaced. Actors and the timed rollout remain separate.
export async function loadRoomModel() {
  const { scene: model } = await new GLTFLoader().loadAsync(new URL('../models/room/room_full_01_clean.glb', import.meta.url).href);
  model.name = 'RecordedRoomGLB';
  // glTF is Y-up; the existing animation is Z-up. Align the trainer to the
  // existing surgeon's working position without mirroring the supplied model.
  model.rotation.set(Math.PI / 2, 0, Math.PI, 'ZYX');
  model.position.set(-.45, .88, 0);
  model.updateMatrixWorld(true);
  const gauzeSource = model.getObjectByName('Folded_gauze_piece');
  if (!gauzeSource) throw new Error('Room model is missing the gauze pickup anchor.');
  const gauzeHome = new T.Box3().setFromObject(gauzeSource).getCenter(new T.Vector3());
  gauzeHome.z = new T.Box3().setFromObject(gauzeSource).min.z;
  // Replace the source gauze with the existing transferable prop, not a duplicate.
  model.traverse(object => {
    if (/^(Folded_gauze_piece|Gauze_woven_surface)/.test(object.name)) object.visible = false;
    if (object.isMesh) { object.castShadow = true; object.receiveShadow = true; }
  });
  // Hide only near-side enclosure panels in this illustrative cutaway view.
  // The asset stays intact, and opposite walls reappear when the camera orbits.
  const enclosure = [];
  model.traverse(object => {
    if (!/^(Front_white_partition|Rear_white_partition|Right_white_partition|Left_wall|Grey_window_curtain|Wall_power_outlet)/.test(object.name)) return;
    const bounds = new T.Box3().setFromObject(object), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    const axis = size.x < size.y ? 'x' : 'y';
    const outward = Math.sign(center[axis] - (axis === 'x' ? .2 : -.4));
    enclosure.push({object, axis, outward});
  });
  function updateCutaway(camera) {
    for (const {object, axis, outward} of enclosure) object.visible = (camera.position[axis] - (axis === 'x' ? .2 : -.4)) * outward < 0;
  }
  const labels = [
    ['Sterile table', 'Gauze_worktable_Top'],
    ['Handover table', 'Bottle_worktable_Top'],
    ['Operating table', 'Long_workbench_A_Top']
  ].map(([text, name]) => {
    const object = model.getObjectByName(name);
    if (!object) throw new Error(`Room model is missing ${name}.`);
    const bounds = new T.Box3().setFromObject(object), center = bounds.getCenter(new T.Vector3()), size = bounds.getSize(new T.Vector3());
    return {text, x:center.x, y:center.y, w:size.x, d:size.y};
  });
  // Approach the same side of the sterile table, at the existing hand's reach.
  const pick = new T.Vector2(gauzeHome.x - .15, gauzeHome.y - .385);
  const workTips = [];
  model.traverse(object => {
    if (/^Device_port_center/.test(object.name)) workTips.push(new T.Box3().setFromObject(object).getCenter(new T.Vector3()));
  });
  return { model, gauzeHome, labels, pick, workTips, updateCutaway };
}
