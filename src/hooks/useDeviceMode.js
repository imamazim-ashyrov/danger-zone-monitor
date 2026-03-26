import { useState } from "react";

const DEVICE_MODE_KEY = "danger-zone-monitor-device-mode";

function resolveDeviceMode() {
  const urlMode = new URLSearchParams(window.location.search).get("monitor");
  if (urlMode === "1") {
    try {
      localStorage.setItem(DEVICE_MODE_KEY, "monitor");
    } catch (err) {
      console.warn("Failed to persist device mode", err);
    }
    return "monitor";
  }

  try {
    const storedMode = localStorage.getItem(DEVICE_MODE_KEY);
    if (storedMode === "monitor" || storedMode === "source") {
      return storedMode;
    }
  } catch (err) {
    console.warn("Failed to read device mode from localStorage", err);
  }

  return "source";
}

export default function useDeviceMode() {
  const [mode] = useState(resolveDeviceMode);

  return {
    mode,
    isSource: mode === "source",
    isMonitor: mode === "monitor",
  };
}
