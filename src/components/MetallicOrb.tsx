"use client";

import React, { useEffect, useRef } from "react";

export type OrbState = "idle" | "generating" | "speaking";

interface MetallicOrbProps {
  size?: number;
  state?: OrbState;
  onClick?: () => void;
  interactive?: boolean;
}

export default function MetallicOrb({
  size = 320,
  state = "idle",
  onClick,
  interactive = false,
}: MetallicOrbProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    let animationFrameId: number;
    let phase = 0;

    const render = () => {
      const speed =
        state === "generating" ? 0.032 : state === "speaking" ? 0.022 : 0.009;
      if (!prefersReducedMotion) {
        phase += speed;
      }

      ctx.clearRect(0, 0, size, size);

      const cx = size / 2;
      const cy = size / 2;
      const pulseOffset =
        state === "speaking" && !prefersReducedMotion
          ? Math.sin(phase * 3) * 3
          : 0;
      const radius = size * 0.29 + pulseOffset;

      // 1. Restrained ambient halo (copper & violet balance)
      const ambientGrad = ctx.createRadialGradient(
        cx,
        cy,
        radius * 0.6,
        cx,
        cy,
        size * 0.48
      );
      ambientGrad.addColorStop(0, "rgba(217, 121, 59, 0.16)");
      ambientGrad.addColorStop(0.55, "rgba(139, 92, 246, 0.07)");
      ambientGrad.addColorStop(1, "rgba(5, 5, 5, 0)");
      ctx.fillStyle = ambientGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.48, 0, Math.PI * 2);
      ctx.fill();

      // 2. Orbital rings helper
      const drawOrbitRing = (
        rx: number,
        ry: number,
        tilt: number,
        rotOffset: number,
        strokeColor: string,
        frontHalf: boolean
      ) => {
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(tilt);
        ctx.beginPath();
        const startAngle = frontHalf ? 0 : Math.PI;
        const endAngle = frontHalf ? Math.PI : Math.PI * 2;
        ctx.ellipse(0, 0, rx, ry, 0, startAngle, endAngle);
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.1;
        ctx.stroke();

        const nodeAngle = rotOffset;
        const inCurrentHalf = frontHalf
          ? Math.sin(nodeAngle) >= 0
          : Math.sin(nodeAngle) < 0;

        if (inCurrentHalf) {
          const nx = Math.cos(nodeAngle) * rx;
          const ny = Math.sin(nodeAngle) * ry;
          ctx.fillStyle = frontHalf ? "#FDE6C4" : "#B49AF5";
          ctx.beginPath();
          ctx.arc(nx, ny, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      };

      drawOrbitRing(
        radius * 1.48,
        radius * 0.42,
        -0.38,
        phase * 0.85,
        "rgba(240, 168, 104, 0.24)",
        false
      );
      drawOrbitRing(
        radius * 1.32,
        radius * 0.36,
        0.48,
        -phase * 0.65,
        "rgba(139, 92, 246, 0.26)",
        false
      );

      // 3. Core 3D Sphere Clipping & Base Metallic Shader
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, radius, 0, Math.PI * 2);
      ctx.clip();

      const lightSweepX =
        cx - radius * 0.32 + Math.cos(phase) * (radius * 0.22);
      const lightSweepY =
        cy - radius * 0.32 + Math.sin(phase * 0.7) * (radius * 0.14);

      const sphereGrad = ctx.createRadialGradient(
        lightSweepX,
        lightSweepY,
        radius * 0.04,
        cx,
        cy,
        radius * 1.05
      );
      sphereGrad.addColorStop(0, "#FFF9F0");
      sphereGrad.addColorStop(0.14, "#FDE6C4");
      sphereGrad.addColorStop(0.38, "#F0A868");
      sphereGrad.addColorStop(0.68, "#C86428");
      sphereGrad.addColorStop(0.88, "#4A1F0A");
      sphereGrad.addColorStop(1, "#180904");

      ctx.fillStyle = sphereGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // 4. Rotating Anisotropic Metallic Surface Reflections
      const bandCount = 5;
      for (let i = 0; i < bandCount; i++) {
        const bandPhase =
          (phase + (i * Math.PI * 2) / bandCount) % (Math.PI * 2);
        const normalizedX = Math.sin(bandPhase);
        const isFrontFacing = Math.cos(bandPhase) > 0;

        if (isFrontFacing) {
          const bandX = cx + normalizedX * radius * 0.85;
          const intensity = Math.cos(bandPhase) * 0.26;
          const bandWidth = radius * 0.28 * Math.cos(bandPhase);

          const bandGrad = ctx.createLinearGradient(
            bandX - bandWidth,
            cy - radius,
            bandX + bandWidth,
            cy + radius
          );
          bandGrad.addColorStop(0, "rgba(253, 230, 196, 0)");
          bandGrad.addColorStop(0.5, `rgba(253, 230, 196, ${intensity})`);
          bandGrad.addColorStop(1, "rgba(253, 230, 196, 0)");

          ctx.fillStyle = bandGrad;
          ctx.beginPath();
          ctx.ellipse(
            bandX,
            cy,
            Math.max(2, Math.abs(bandWidth)),
            radius * 0.96,
            0,
            0,
            Math.PI * 2
          );
          ctx.fill();
        }
      }

      // 5. Secondary Violet Sub-Surface Rim Reflection
      const rimGrad = ctx.createRadialGradient(
        cx + radius * 0.55,
        cy + radius * 0.55,
        radius * 0.05,
        cx + radius * 0.4,
        cy + radius * 0.4,
        radius * 0.85
      );
      rimGrad.addColorStop(0, "rgba(180, 154, 245, 0.28)");
      rimGrad.addColorStop(0.5, "rgba(139, 92, 246, 0.10)");
      rimGrad.addColorStop(1, "rgba(139, 92, 246, 0)");
      ctx.fillStyle = rimGrad;
      ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);

      // 6. Crisp Specular Rim Edge
      ctx.strokeStyle = "rgba(253, 230, 196, 0.35)";
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(cx, cy, radius - 0.75, 0, Math.PI * 2);
      ctx.stroke();

      ctx.restore();

      // 7. Front half of orbital rings
      drawOrbitRing(
        radius * 1.48,
        radius * 0.42,
        -0.38,
        phase * 0.85,
        "rgba(253, 230, 196, 0.48)",
        true
      );
      drawOrbitRing(
        radius * 1.32,
        radius * 0.36,
        0.48,
        -phase * 0.65,
        "rgba(180, 154, 245, 0.45)",
        true
      );

      if (!prefersReducedMotion) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    render();

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [size, state]);

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!interactive || !onClick}
      aria-label={interactive ? "Interact with your companion orb" : "Hey You Companion metallic orb"}
      title={interactive ? "Tap to hear your companion" : undefined}
      className={`relative flex items-center justify-center select-none bg-transparent border-0 outline-none ${interactive && onClick ? "cursor-pointer rounded-full focus-visible:ring-2 focus-visible:ring-violet-400" : "cursor-default"}`}
      style={{ WebkitTapHighlightColor: "transparent" }}
    >
      <canvas ref={canvasRef} style={{ width: `${size}px`, height: `${size}px` }} className={`block transition-transform duration-500 ${interactive ? "hover:scale-[1.035] active:scale-[0.98]" : ""}`} />
    </button>
  );
}
