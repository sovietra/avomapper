import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

const EARTH_DAY  = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg'
const EARTH_BUMP = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-topology.png'

export default function GlobeView({ onZoomIn, visible }) {
  const mountRef = useRef(null)
  // track whether a drag happened so we don't fire onZoomIn on drag-release
  const didDragRef = useRef(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const w = mount.clientWidth  || window.innerWidth
    const h = mount.clientHeight || window.innerHeight

    // ── Renderer ──
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(w, h)
    renderer.setClearColor(0x000000)
    mount.appendChild(renderer.domElement)

    // ── Scene & Camera ──
    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 2000)
    camera.position.z = 2.6

    // ── OrbitControls ──
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true   // smooth inertia
    controls.dampingFactor  = 0.06
    controls.enablePan      = false  // no panning — only rotate + zoom
    controls.minDistance    = 1.25   // can't go inside the Earth
    controls.maxDistance    = 6.0    // can't zoom too far out
    controls.rotateSpeed    = 0.5
    controls.zoomSpeed      = 0.8
    controls.autoRotate     = true   // slow idle spin
    controls.autoRotateSpeed = 0.5

    // Stop auto-rotate the moment the user touches the globe
    controls.addEventListener('start', () => {
      controls.autoRotate = false
      didDragRef.current  = false   // reset on interaction start
    })
    // Flag that a drag move happened
    controls.addEventListener('change', () => {
      didDragRef.current = true
    })
    // Resume auto-rotate 4 s after user lets go
    let resumeTimer
    controls.addEventListener('end', () => {
      clearTimeout(resumeTimer)
      resumeTimer = setTimeout(() => { controls.autoRotate = true }, 4000)
    })

    // ── Stars ──
    const starGeo = new THREE.BufferGeometry()
    const starCount = 8000
    const positions = new Float32Array(starCount * 3)
    for (let i = 0; i < starCount; i++) {
      const r     = 300 + Math.random() * 200
      const theta = Math.random() * Math.PI * 2
      const phi   = Math.acos(2 * Math.random() - 1)
      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)
    }
    starGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({
      color: 0xffffff, size: 0.25, sizeAttenuation: true,
      transparent: true, opacity: 0.85,
    })))

    // ── Earth ──
    const loader   = new THREE.TextureLoader()
    const earthGeo = new THREE.SphereGeometry(1, 64, 64)
    const earthMat = new THREE.MeshPhongMaterial({
      map:       loader.load(EARTH_DAY),
      bumpMap:   loader.load(EARTH_BUMP),
      bumpScale: 0.06,
      specular:  new THREE.Color(0x1a3a5c),
      shininess: 18,
    })
    const earth = new THREE.Mesh(earthGeo, earthMat)
    earth.rotation.x = 0.2
    scene.add(earth)

    // ── Atmosphere ──
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.025, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x2255cc, transparent: true, opacity: 0.10,
        side: THREE.FrontSide, depthWrite: false,
      })
    ))
    scene.add(new THREE.Mesh(
      new THREE.SphereGeometry(1.18, 64, 64),
      new THREE.MeshPhongMaterial({
        color: 0x1133aa, transparent: true, opacity: 0.04,
        side: THREE.BackSide, depthWrite: false,
      })
    ))

    // ── Lighting ──
    const sun = new THREE.DirectionalLight(0xfff8e8, 1.5)
    sun.position.set(4, 2, 3)
    scene.add(sun)
    scene.add(new THREE.AmbientLight(0x0a0d1a, 1.0))
    const rim = new THREE.DirectionalLight(0x1133cc, 0.3)
    rim.position.set(-4, -1, -3)
    scene.add(rim)

    // ── Animation loop ──
    let animId
    const animate = () => {
      animId = requestAnimationFrame(animate)
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    // ── Resize ──
    const onResize = () => {
      const nw = mount.clientWidth
      const nh = mount.clientHeight
      camera.aspect = nw / nh
      camera.updateProjectionMatrix()
      renderer.setSize(nw, nh)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animId)
      clearTimeout(resumeTimer)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      renderer.dispose()
    }
  }, [])

  const handleClick = () => {
    // Only fire zoom-in if user just clicked without dragging
    if (!didDragRef.current) onZoomIn()
    didDragRef.current = false
  }

  return (
    <div
      ref={mountRef}
      className={`globe-view ${visible ? 'visible' : ''}`}
      onClick={handleClick}
    >
      <div className="globe-label">
        <strong>Earth</strong>&nbsp; Home · 365-day orbit
      </div>
      <div className="globe-hint">Drag · Scroll to zoom · Click to enter</div>
    </div>
  )
}
