import { useEffect } from "react";
import { db } from "../firebase";
import { ref, set, onValue } from "firebase/database";

export default function useRemoteAlerts({
  roomId,
  isMonitorMode,
  onRemoteAlert = () => {},
  onRemoteClear = () => {},
}) {
  useEffect(() => {
    if (!isMonitorMode) return;

    const alertsRef = ref(db, `alerts/${roomId}`);
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.active) {
        onRemoteClear();
        return;
      }

      onRemoteAlert(data.message, data.time);
    });

    return () => {
      unsubscribe();
    };
  }, [roomId, isMonitorMode, onRemoteAlert, onRemoteClear]);

  const sendRemoteAlert = async (message) => {
    try {
      await set(ref(db, `alerts/${roomId}`), {
        message,
        active: true,
        time: Date.now(),
      });
    } catch (error) {
      console.error("sendRemoteAlert error", error);
    }
  };

  const clearRemoteAlert = async () => {
    try {
      await set(ref(db, `alerts/${roomId}`), {
        message: "",
        active: false,
        time: Date.now(),
      });
    } catch (error) {
      console.error("clearRemoteAlert error", error);
    }
  };

  return {
    sendRemoteAlert,
    clearRemoteAlert,
  };
}
