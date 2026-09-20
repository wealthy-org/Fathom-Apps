"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Reference hero mesh (docs/design/reference.html), ported 1:1 in behavior:
 * faceted red icosahedron, ambient + key + fill lights, slow rotation and
 * bob, x=4.5 desktop / 0 mobile, resize handling. Client-only (dynamic,
 * ssr:false). Reduced motion renders a single static frame then stops.
 * Full cleanup on unmount — no leaked RAF loops, listeners, or GPU objects.
 */

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function HeroMesh() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.z = 10;

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    const mesh = new THREE.Mesh(
      new THREE.IcosahedronGeometry(3, 0),
      new THREE.MeshStandardMaterial({
        color: 0xe34a32,
        roughness: 0.3,
        metalness: 0.6,
        flatShading: true,
      }),
    );
    scene.add(mesh);
    scene.add(new THREE.AmbientLight(0xffffff, 0.7));
    const key = new THREE.DirectionalLight(0xffffff, 1.5);
    key.position.set(4, 5, 7);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0xffc0aa, 0.7);
    fill.position.set(-4, -2, 3);
    scene.add(fill);

    function resize() {
      const w = canvas!.clientWidth;
      const h = canvas!.clientHeight;
      if (w === 0 || h === 0) return;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      mesh.position.x = window.innerWidth < 768 ? 0 : 4.5;
    }
    window.addEventListener("resize", resize);
    resize();

    let raf = 0;
    if (prefersReducedMotion()) {
      renderer.render(scene, camera);
    } else {
      const render = (now: number) => {
        const t = now * 0.001;
        mesh.rotation.x = t * 0.16;
        mesh.rotation.y = t * 0.22;
        mesh.position.y = Math.sin(t * 1.2) * 0.3;
        renderer.render(scene, camera);
        raf = requestAnimationFrame(render);
      };
      raf = requestAnimationFrame(render);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      mesh.geometry.dispose();
      (mesh.material as THREE.Material).dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
    />
  );
}
