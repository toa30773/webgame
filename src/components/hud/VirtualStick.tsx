import { useEffect, useRef } from "react";
import { useInputStore } from "@/store/inputStore";

const RADIUS = 64; // px
const KNOB_RADIUS = 28;

export function VirtualStick(): JSX.Element {
  const baseRef = useRef<HTMLDivElement | null>(null);
  const knobRef = useRef<HTMLDivElement | null>(null);
  const stateRef = useRef<{ active: boolean; pid: number | null }>({
    active: false,
    pid: null,
  });

  useEffect(() => {
    const base = baseRef.current;
    const knob = knobRef.current;
    if (!base || !knob) return;

    const setMove = useInputStore.getState().setMove;

    function getCenter(): { cx: number; cy: number } {
      if (!base) return { cx: 0, cy: 0 };
      const r = base.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    }

    function update(clientX: number, clientY: number): void {
      const { cx, cy } = getCenter();
      const dx = clientX - cx;
      const dy = clientY - cy;
      const len = Math.hypot(dx, dy);
      const max = RADIUS;
      const cl = Math.min(len, max);
      const ux = len === 0 ? 0 : dx / len;
      const uy = len === 0 ? 0 : dy / len;
      const kx = ux * cl;
      const ky = uy * cl;
      if (knob) {
        knob.style.transform = `translate(${kx}px, ${ky}px)`;
      }
      const inputX = ux * (cl / max);
      const inputY = uy * (cl / max);
      setMove(inputX, inputY);
    }

    function reset(): void {
      if (knob) knob.style.transform = "translate(0px, 0px)";
      setMove(0, 0);
    }

    function onStart(e: PointerEvent): void {
      stateRef.current.active = true;
      stateRef.current.pid = e.pointerId;
      base?.setPointerCapture(e.pointerId);
      update(e.clientX, e.clientY);
      e.preventDefault();
    }
    function onMove(e: PointerEvent): void {
      if (!stateRef.current.active) return;
      if (stateRef.current.pid !== e.pointerId) return;
      update(e.clientX, e.clientY);
    }
    function onEnd(e: PointerEvent): void {
      if (stateRef.current.pid !== e.pointerId) return;
      stateRef.current.active = false;
      stateRef.current.pid = null;
      try {
        base?.releasePointerCapture(e.pointerId);
      } catch {
        /* noop */
      }
      reset();
    }

    base.addEventListener("pointerdown", onStart, { passive: false });
    base.addEventListener("pointermove", onMove, { passive: false });
    base.addEventListener("pointerup", onEnd);
    base.addEventListener("pointercancel", onEnd);

    return () => {
      base.removeEventListener("pointerdown", onStart);
      base.removeEventListener("pointermove", onMove);
      base.removeEventListener("pointerup", onEnd);
      base.removeEventListener("pointercancel", onEnd);
      setMove(0, 0);
    };
  }, []);

  return (
    <div
      ref={baseRef}
      className="absolute rounded-full bg-white/10 border border-white/20"
      style={{
        width: RADIUS * 2,
        height: RADIUS * 2,
        touchAction: "none",
        left: `calc(env(safe-area-inset-left) + 1.5rem)`,
        bottom: `calc(env(safe-area-inset-bottom) + 1.5rem)`,
      }}
    >
      <div
        ref={knobRef}
        className="absolute rounded-full bg-white/80 border border-white"
        style={{
          width: KNOB_RADIUS * 2,
          height: KNOB_RADIUS * 2,
          left: RADIUS - KNOB_RADIUS,
          top: RADIUS - KNOB_RADIUS,
          transition: "transform 0.05s linear",
        }}
      />
    </div>
  );
}
