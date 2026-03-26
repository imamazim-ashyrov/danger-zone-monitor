import { useEffect, useState } from "react";

function loadZones(roomId) {
  try {
    const storageKey = `zones-${roomId}`;
    const raw = localStorage.getItem(storageKey);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to read saved zones", error);
    return [];
  }
}

export default function useZoneStorage(roomId) {
  const [zones, setZones] = useState(() => loadZones(roomId));

  useEffect(() => {
    try {
      const storageKey = `zones-${roomId}`;
      localStorage.setItem(storageKey, JSON.stringify(zones));
    } catch (error) {
      console.error("Failed to persist zones", error);
    }
  }, [zones, roomId]);

  useEffect(() => {
    setZones(loadZones(roomId));
  }, [roomId]);

  const addZone = (zone) => {
    setZones((previous) => [...previous, zone]);
  };

  const removeZone = (zoneId) => {
    setZones((previous) => previous.filter((zone) => zone.id !== zoneId));
  };

  const clearZones = () => {
    setZones([]);
  };

  return {
    zones,
    setZones,
    addZone,
    removeZone,
    clearZones,
  };
}
