import * as THREE from 'three';
import { PLYLoader } from 'three/addons/loaders/PLYLoader.js';

async function fetchChecked(url, responseType) {
  const response = await fetch(url, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`Failed to load ${url}: HTTP ${response.status}`);
  return responseType === 'json' ? response.json() : response.arrayBuffer();
}

export async function loadSemanticMap(dataBaseUrl, options = {}) {
  const base = dataBaseUrl.replace(/\/$/, '');
  const manifest = await fetchChecked(`${base}/manifest.json`, 'json');
  if (manifest.format !== 'semantic_web_map_v1') {
    throw new Error(`Unsupported semantic map format: ${manifest.format}`);
  }

  const [positionBuffer, colorBuffer] = await Promise.all([
    fetchChecked(`${base}/${manifest.semantic_geometry.positions.file}`, 'arrayBuffer'),
    fetchChecked(`${base}/${manifest.semantic_geometry.colors.file}`, 'arrayBuffer'),
  ]);
  const expectedPoints = manifest.semantic_geometry.point_count;
  if (positionBuffer.byteLength !== expectedPoints * 12 || colorBuffer.byteLength !== expectedPoints * 3) {
    throw new Error('Semantic geometry byte length does not match manifest.json');
  }

  const pointSize = options.pointSize ?? 0.018;
  const group = new THREE.Group();
  group.name = `semantic-map:${manifest.scene_id}`;
  group.userData.manifest = manifest;
  const registry = new Map();

  for (const item of manifest.objects) {
    const positionOffset = item.point_offset * 12;
    const colorOffset = item.point_offset * 3;
    const positions = new Float32Array(positionBuffer, positionOffset, item.point_count * 3);
    const colors = new Uint8Array(colorBuffer, colorOffset, item.point_count * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
    geometry.boundingBox = new THREE.Box3(
      new THREE.Vector3(...item.min_bound), new THREE.Vector3(...item.max_bound),
    );
    const material = new THREE.PointsMaterial({
      size: pointSize * (item.point_size_scale ?? 1),
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 1,
    });
    const points = new THREE.Points(geometry, material);
    points.name = item.id;
    points.userData.semanticObject = item;
    group.add(points);
    registry.set(item.id, points);
  }

  return new SemanticMapController(group, manifest, registry, pointSize);
}

export async function loadEnvironment(dataBaseUrl, options = {}) {
  const base = dataBaseUrl.replace(/\/$/, '');
  const manifest = await fetchChecked(`${base}/manifest.json`, 'json');
  const loader = new PLYLoader();
  const geometry = loader.parse(await fetchChecked(`${base}/${manifest.environment.file}`, 'arrayBuffer'));
  if (geometry.attributes.position.count !== manifest.environment.point_count) {
    throw new Error('Environment geometry point count does not match manifest.json');
  }
  const material = new THREE.PointsMaterial({
    size: options.pointSize ?? 0.012,
    sizeAttenuation: true,
    vertexColors: true,
    transparent: true,
    opacity: options.opacity ?? 0.32,
    depthWrite: false,
  });
  const cloud = new THREE.Points(geometry, material);
  cloud.name = `environment:${manifest.scene_id}`;
  return cloud;
}

export function configureCameraForRosZUp(camera) {
  camera.up.set(0, 0, 1);
  camera.updateProjectionMatrix();
}

export class SemanticMapController {
  constructor(group, manifest, registry, normalPointSize) {
    this.group = group;
    this.manifest = manifest;
    this.registry = registry;
    this.normalPointSize = normalPointSize;
  }

  labels() {
    const counts = new Map();
    for (const points of this.registry.values()) {
      const label = points.userData.semanticObject.label;
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return [...counts].map(([label, count]) => ({label, count}));
  }

  resetHighlight() {
    for (const points of this.registry.values()) {
      points.visible = true;
      points.material.vertexColors = true;
      points.material.color.set(0xffffff);
      points.material.opacity = 1;
      points.material.size = this.normalPointSize * (points.userData.semanticObject.point_size_scale ?? 1);
      points.material.depthWrite = true;
      points.material.needsUpdate = true;
    }
  }

  highlightByIds(ids, options = {}) {
    const selected = new Set(ids);
    const highlightColor = options.color ?? 0xffd400;
    const dimOpacity = options.dimOpacity ?? 0.08;
    const sizeScale = options.sizeScale ?? 1.8;
    for (const [id, points] of this.registry) {
      const active = selected.has(id);
      points.visible = active || !options.hideOthers;
      points.material.vertexColors = !active;
      points.material.color.set(active ? highlightColor : 0xffffff);
      points.material.opacity = active ? 1 : dimOpacity;
      points.material.size = this.normalPointSize * (points.userData.semanticObject.point_size_scale ?? 1) * (active ? sizeScale : 1);
      points.material.depthWrite = active;
      points.material.needsUpdate = true;
    }
    return [...selected].map((id) => this.registry.get(id)?.userData.semanticObject).filter(Boolean);
  }

  highlightByLabel(label, options = {}) {
    const wanted = label.trim().toLocaleLowerCase();
    const ids = [...this.registry.values()].map(points => points.userData.semanticObject)
      .filter((item) => item.label.toLocaleLowerCase() === wanted)
      .map((item) => item.id);
    return this.highlightByIds(ids, options);
  }

  highlightById(id, options = {}) {
    return this.highlightByIds([id], options);
  }

  dispose() {
    for (const points of this.registry.values()) {
      points.geometry.dispose();
      points.material.dispose();
    }
    this.group.clear();
    this.registry.clear();
  }
}
