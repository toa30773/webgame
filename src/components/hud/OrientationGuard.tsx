import { useEffect, useState } from "react";

interface OrientationLockApi {
  lock(orientation: string): Promise<void>;
}

function tryLockPortrait(): void {
  if (typeof screen === "undefined") return;
  const so = screen.orientation as unknown as
    | (ScreenOrientation & OrientationLockApi)
    | undefined;
  if (!so || typeof so.lock !== "function") return;
  so.lock("portrait").catch(() => {
    // iOS Safari など未対応端末は無視
  });
}

export function OrientationGuard(): JSX.Element | null {
  const [isLandscape, setIsLandscape] = useState(false);

  useEffect(() => {
    tryLockPortrait();
    const update = (): void => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      setIsLandscape(w > h && w > 480);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);

  if (!isLandscape) return null;
  return (
    <div className="absolute inset-0 z-50 bg-black/95 flex items-center justify-center text-center px-6 pointer-events-auto">
      <div className="flex flex-col items-center gap-3">
        <div className="text-5xl">📱</div>
        <div className="text-xl font-bold text-amber-300">
          端末を縦向きに
        </div>
        <div className="text-sm text-white/80">
          このゲームは縦画面専用です
        </div>
      </div>
    </div>
  );
}
