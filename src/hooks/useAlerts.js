import { useCallback, useRef, useState } from "react";

function formatTime(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

const DEFAULT_ALERT_COOLDOWN_MS = 2500;

export default function useAlerts({ cooldownMs = DEFAULT_ALERT_COOLDOWN_MS, soundUrl = null } = {}) {
  const [alerts, setAlerts] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const lastAlertRef = useRef(0);
  const alertAudioRef = useRef(null);

  const playAlertSound = useCallback(() => {
    if (!soundUrl) return;
    try {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio(soundUrl);
        alertAudioRef.current.preload = "auto";
      }

      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;

      alertAudioRef.current.play().catch((error) => {
        console.error("Audio play failed:", error);
      });
    } catch (error) {
      console.error("Audio error:", error);
    }
  }, []);

  const addAlert = useCallback((alertItem) => {
    setAlerts((previous) => [alertItem, ...previous].slice(0, 15));
  }, []);

  const triggerAlert = useCallback(
    (message, fromRemote = false) => {
      const now = Date.now();
      if (now - lastAlertRef.current < cooldownMs) return false;

      lastAlertRef.current = now;

      const item = {
        id: crypto.randomUUID(),
        message,
        time: formatTime(new Date()),
      };

      setActiveAlert(message);
      setAlerts((previous) => [item, ...previous].slice(0, 15));
      playAlertSound();

      return true;
    },
    [cooldownMs, playAlertSound]
  );

  const clearActiveAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  const clearAllAlerts = useCallback(() => {
    setActiveAlert(null);
    setAlerts([]);
  }, []);

  return {
    alerts,
    activeAlert,
    triggerAlert,
    addAlert,
    setActiveAlert,
    clearActiveAlert,
    clearAllAlerts,
    playAlertSound,
  };
}
