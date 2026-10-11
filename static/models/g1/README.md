# Unitree G1 model

The visual geometry and joint hierarchy are derived from Unitree Robotics' official
`g1_29dof_rev_1_0_with_inspire_hand_DFQ.urdf` and the STL meshes it references:

https://github.com/unitreerobotics/unitree_ros/tree/master/robots/g1_description

Retrieved 2026-10-09. The upstream BSD-3-Clause notice is preserved in
`LICENSE-Unitree.txt`. The website's MIT license does not replace this notice.

`g1.json` contains visual origins, material colors, the URDF joint tree, axes,
limits, and binary geometry offsets. `g1.bin` contains little-endian float32
positions/normals and uint32 triangle indices. Original meshes were reduced with
quadratic error decimation; the robot remains articulated and uses its original
coordinate system (X forward, Z up). The browser loads no collision or physics
engine and does not send robot commands.

The five-finger Inspire hand variant visually matches the supplied recording;
the exact hardware revision has not been independently identified. The animated
walking, grasping, and handover poses are illustrative, not captured trajectories
or a replay of the research system's controller. The room is modeled from the
supplied video, not metrically reconstructed by photogrammetry.

Rendering: local Three.js 0.170.0 and OrbitControls (MIT), with their license in
`../../vendor/three/LICENSE.txt`. OrbitControls' import path is changed to the
local vendored renderer. No package manager, runtime CDN, or build step is needed.
