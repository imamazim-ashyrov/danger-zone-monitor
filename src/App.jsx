import { useEffect, useRef, useState } from "react";
import ZoneCanvas from "./components/ZoneCanvas";
import usePersonDetector from "./hooks/usePersonDetector";
import useAlerts from "./hooks/useAlerts";
import useRemoteAlerts from "./hooks/useRemoteAlerts";
import useZoneStorage from "./hooks/useZoneStorage";
import useDeviceMode from "./hooks/useDeviceMode";
import useStreamingChannel from "./hooks/useStreamingChannel";
import { evaluateDanger } from "./utils/dangerEvaluator";
import accident_signalization from "./assets/audio/accident_signalization.mp3";

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 540;

const ROOM_KEY = "danger-zone-monitor-room-id";

function resolveRoomId() {
  const urlRoom = new URLSearchParams(window.location.search).get("room");
  if (urlRoom) {
    try {
      localStorage.setItem(ROOM_KEY, urlRoom);
    } catch (err) {
      console.warn("Failed to save room id", err);
    }
    return urlRoom;
  }

  try {
    const storedRoom = localStorage.getItem(ROOM_KEY);
    if (storedRoom) return storedRoom;
  } catch (err) {
    console.warn("Failed to read room id from localStorage", err);
  }

  const generated =
    typeof crypto?.randomUUID === "function"
      ? crypto.randomUUID()
      : `room-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

  try {
    localStorage.setItem(ROOM_KEY, generated);
  } catch (err) {
    console.warn("Failed to persist generated room id", err);
  }

  return generated;
}

const ZONE_TYPES = [
  { key: "socket", label: "Розетка" },
  { key: "window", label: "Терезе" },
  { key: "stove", label: "Плита" },
  { key: "custom", label: "Башка" },
];

function formatTime(date) {
  return new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(date);
}

export default function App() {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const activeAlertRef = useRef(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedZoneType, setSelectedZoneType] = useState("socket");
  const [isDrawingMode, setIsDrawingMode] = useState(true);
  const [roomId] = useState(resolveRoomId);

  const { isSource, isMonitor } = useDeviceMode();

  const { modelStatus, detections, startDetection, stopDetection } = usePersonDetector();
  const { zones, addZone, removeZone, clearZones } = useZoneStorage(roomId);
  const {
    alerts,
    activeAlert,
    triggerAlert,
    addAlert,
    setActiveAlert,
    clearActiveAlert,
    playAlertSound,
  } = useAlerts({ soundUrl: accident_signalization });

  // Future: useStreamingChannel will handle WebRTC/streaming when implemented
  useStreamingChannel({ roomId, mode: isSource ? "source" : "monitor" });

  const { sendRemoteAlert, clearRemoteAlert } = useRemoteAlerts({
    roomId: ROOM_KEY,
    isMonitorMode: isMonitor,
    onRemoteAlert: (message, timestamp) => {
      if (!message) {
        clearActiveAlert();
        return;
      }

      setActiveAlert(message);
      addAlert({
        id: `remote-${timestamp}-${Math.random()}`,
        message,
        time: formatTime(new Date(timestamp)),
      });
      playAlertSound();
    },
    onRemoteClear: () => {
      clearActiveAlert();
    },
  });

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleDetections = (persons) => {
    const { danger, message } = evaluateDanger(persons, zones);

    if (!danger) {
      clearActiveAlert();
      activeAlertRef.current = null;

      if (isSource) {
        clearRemoteAlert();
      }

      return;
    }

    setActiveAlert(message);

    if (activeAlertRef.current !== message) {
      activeAlertRef.current = message;
      const triggered = triggerAlert(message, false);

      if (triggered && isSource) {
        sendRemoteAlert(message);
      }
    }
  };

  const startCamera = async () => {
    if (isMonitor) {
      alert("Monitor mode: camera & detection отключены.");
      return;
    }

    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        alert("Бул браузер камера API колдобойт.");
        return;
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: VIDEO_WIDTH },
          height: { ideal: VIDEO_HEIGHT },
        },
        audio: false,
      });

      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) return;

      video.srcObject = stream;
      await video.play();

      setIsCameraOn(true);
      startDetection(videoRef, handleDetections);
    } catch (error) {
      console.error(error);
      alert("Камерага уруксат берилген жок же камера ачылган жок.");
    }
  };

  const stopCamera = () => {
    stopDetection();

    const stream = streamRef.current;
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    const video = videoRef.current;
    if (video) {
      video.pause();
      video.srcObject = null;
    }

    clearActiveAlert();
    activeAlertRef.current = null;

    if (isSource) {
      clearRemoteAlert();
    }

    setIsCameraOn(false);
  };

  const handleClearZones = () => {
    clearZones();
    clearActiveAlert();
    activeAlertRef.current = null;

    if (isSource) {
      clearRemoteAlert();
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-7xl mx-auto grid gap-6 lg:grid-cols-[1.5fr_0.9fr]">
        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 md:p-5 shadow-2xl">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <h1 className="text-2xl md:text-3xl font-bold">
                  Danger Zone Monitor
                </h1>
                <p className="text-slate-400 mt-1">
                  Камера агымынан адамды тап, кооптуу аймакка жакындаса сигнал берет.
                </p>
              </div>

              <div className="text-sm px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                {modelStatus}
              </div>
            </div>

            <div className="mt-2 text-xs text-slate-400">
              Room ID: <span className="font-medium text-white">{roomId}</span>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {isMonitor ? (
                <span className="px-4 py-2 rounded-2xl bg-blue-500 text-white font-semibold">
                  Monitor mode (текетүз сигнал угуп, камера жок)
                </span>
              ) : !isCameraOn ? (
                <button
                  onClick={startCamera}
                  className="px-4 py-2 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold"
                >
                  Камераны иштетүү
                </button>
              ) : (
                <button
                  onClick={stopCamera}
                  className="px-4 py-2 rounded-2xl bg-rose-500 hover:bg-rose-400 text-white font-semibold"
                >
                  Камераны токтотуу
                </button>
              )}

              <button
                onClick={() => setIsDrawingMode((prev) => !prev)}
                className={`px-4 py-2 rounded-2xl font-semibold border ${
                  isDrawingMode
                    ? "bg-amber-400 text-slate-950 border-amber-300"
                    : "bg-slate-800 text-slate-100 border-slate-700"
                }`}
              >
                {isDrawingMode ? "Зона чийүү режими" : "Көрүү режими"}
              </button>

              <button
                onClick={handleClearZones}
                className="px-4 py-2 rounded-2xl bg-slate-800 hover:bg-slate-700 border border-slate-700 font-semibold"
              >
                Бардык зоналарды тазалоо
              </button>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <label className="text-sm text-slate-300">Зона түрү:</label>

              <select
                value={selectedZoneType}
                onChange={(e) => setSelectedZoneType(e.target.value)}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm"
              >
                {ZONE_TYPES.map((zone) => (
                  <option key={zone.key} value={zone.key}>
                    {zone.label}
                  </option>
                ))}
              </select>

              <span className="text-sm text-slate-400">
                Камераны иштет → чийүү режиминде кооптуу аймакты белгилe.
              </span>
            </div>

            {isMonitor ? (
              <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400">
                Монитор режим: видео агым жок, детекция жок. Текетүз Firebaseдан сигналдарды угат.
              </div>
            ) : (
              <div className="relative aspect-video w-full overflow-hidden rounded-3xl bg-black border border-slate-800">
                <video
                  ref={videoRef}
                  autoPlay
                  muted
                  playsInline
                  width={VIDEO_WIDTH}
                  height={VIDEO_HEIGHT}
                  className="absolute inset-0 h-full w-full object-fill transform scale-x-[-1]"
                />

                <ZoneCanvas
                  zones={zones}
                  detections={detections}
                  isDrawingMode={isDrawingMode}
                  selectedZoneType={selectedZoneType}
                  onAddZone={addZone}
                  zoneTypes={ZONE_TYPES}
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
            <h2 className="text-xl font-bold">Абал</h2>

            <div className="mt-3 space-y-3">
              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-sm text-slate-400">Табылган адамдар</div>
                <div className="text-2xl font-bold mt-1">{detections.length}</div>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-950 p-3">
                <div className="text-sm text-slate-400">Белгиленген зоналар</div>
                <div className="text-2xl font-bold mt-1">{zones.length}</div>
              </div>

              <div
                className={`rounded-2xl border p-3 ${
                  activeAlert
                    ? "border-rose-500 bg-rose-500/10"
                    : "border-emerald-500 bg-emerald-500/10"
                }`}
              >
                <div className="text-sm text-slate-300">Сигнал</div>
                <div className="text-lg font-bold mt-1">
                  {activeAlert ? activeAlert : "Коопсуз"}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Кооптуу зоналар</h2>
              <span className="text-xs text-slate-400">Чийип кошулат</span>
            </div>

            <div className="mt-3 space-y-2 max-h-64 overflow-auto pr-1">
              {zones.length === 0 ? (
                <div className="text-sm text-slate-400">Азырынча зона жок.</div>
              ) : (
                zones.map((zone, idx) => (
                  <div
                    key={zone.id}
                    className="rounded-2xl border border-slate-800 bg-slate-950 p-3 flex items-center justify-between gap-3"
                  >
                    <div>
                      <div className="font-semibold">
                        {idx + 1}. {zone.label}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        x:{Math.round(zone.rect.x)} y:{Math.round(zone.rect.y)} w:{Math.round(zone.rect.width)} h:{Math.round(zone.rect.height)}
                      </div>
                    </div>

                    <button
                      onClick={() => removeZone(zone.id)}
                      className="text-sm px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700"
                    >
                      Өчүрүү
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold">Alert history</h2>
              <span className="text-xs text-slate-400">Акыркы 15 окуя</span>
            </div>

            <div className="mt-3 space-y-2 max-h-72 overflow-auto pr-1">
              {alerts.length === 0 ? (
                <div className="text-sm text-slate-400">Сигнал боло элек.</div>
              ) : (
                alerts.map((item) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border border-rose-800 bg-rose-900/20 p-3"
                  >
                    <div className="font-semibold">{item.message}</div>
                    <div className="text-xs text-slate-400 mt-1">{item.time}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-4 shadow-2xl">
            <h2 className="text-xl font-bold">Эскертүү</h2>
            <ul className="mt-3 text-sm text-slate-300 space-y-2 list-disc pl-5">
              <li>Бул MVP адамды гана табат.</li>
              <li>Сигнал жакындаганда же зонага киргенде күйөт.</li>
              <li>
                `object-cover` ордуна `object-fill` колдонулду, координаталар
                туурараак дал келиши үчүн.
              </li>
              <li>Сигнал үнү mp3 файлдан ойнойт.</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
