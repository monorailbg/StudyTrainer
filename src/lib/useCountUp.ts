import { useEffect, useRef, useState } from 'react';

// Eased count-up from 0 to `target` over `duration`ms, restarting whenever
// `active` flips true. Shared by QuizViewer's results screen and any stat
// tile that wants the same "counting up" reveal (Home dashboard, subject
// progress dashboards).
export function useCountUp(target: number, active: boolean, duration = 900): number {
  const [val, setVal] = useState(0);
  const rafRef = useRef(0);

  useEffect(() => {
    if (!active) { setVal(0); return; }
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - t) * (1 - t);
      setVal(Math.round(eased * target));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, active, duration]);

  return val;
}
