import { useCallback, useRef } from "react";

const DANGER_CONFIRMATION_MS = 1200;
const DANGER_TOLERANCE_MS = 300;

export default function useDangerConfirmation({
  evaluateDanger,
  onDangerConfirmed,
  onDangerCleared,
  thresholdMs = DANGER_CONFIRMATION_MS,
  toleranceMs = DANGER_TOLERANCE_MS,
} = {}) {
  const dangerStartTimeRef = useRef(null);
  const lastSafeFrameTimeRef = useRef(null);
  const dangerConfirmedRef = useRef(false);
  const lastDangerMessageRef = useRef(null);

  return useCallback(
    (persons, zones) => {
      const result = evaluateDanger(persons, zones);
      const now = Date.now();

      if (result.danger) {
        const sameMessage = result.message === lastDangerMessageRef.current;
        lastDangerMessageRef.current = result.message;

        if (dangerStartTimeRef.current === null) {
          dangerStartTimeRef.current = now;
        }

        if (lastSafeFrameTimeRef.current !== null) {
          if (now - lastSafeFrameTimeRef.current > toleranceMs) {
            dangerStartTimeRef.current = now;
          }
          lastSafeFrameTimeRef.current = null;
        }

        if (now - dangerStartTimeRef.current >= thresholdMs) {
          if (!dangerConfirmedRef.current || !sameMessage) {
            dangerConfirmedRef.current = true;
            onDangerConfirmed?.(result);
          }
        }

        return;
      }

      if (dangerConfirmedRef.current) {
        dangerConfirmedRef.current = false;
        dangerStartTimeRef.current = null;
        lastDangerMessageRef.current = null;
        lastSafeFrameTimeRef.current = null;
        onDangerCleared?.();
        return;
      }

      if (dangerStartTimeRef.current !== null) {
        if (lastSafeFrameTimeRef.current === null) {
          lastSafeFrameTimeRef.current = now;
          return;
        }

        if (now - lastSafeFrameTimeRef.current > toleranceMs) {
          dangerStartTimeRef.current = null;
          lastDangerMessageRef.current = null;
          lastSafeFrameTimeRef.current = null;
        }
      }
    },
    [evaluateDanger, onDangerConfirmed, onDangerCleared, thresholdMs, toleranceMs]
  );
}
