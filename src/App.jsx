import { useEffect, useRef, useState } from "react";
import ZoneCanvas from "./components/ZoneCanvas";
import usePersonDetector from "./hooks/usePersonDetector";
import {
  intersectionArea,
  personBoxToRect,
  rectEdgeDistance,
  getPersonDangerPoint,
  pointInsideRect,
} from "./utils/geometry";
import { db } from "./firebase";
import { ref, set, onValue } from "firebase/database";
import accident_signalization from "./assets/audio/accident_signalization.mp3";

const VIDEO_WIDTH = 960;
const VIDEO_HEIGHT = 540;

const DANGER_RATIO_THRESHOLD = 0.01;
const PROXIMITY_PX_THRESHOLD = 90;
const PERSON_POINT_PADDING = 35;
const ALERT_COOLDOWN_MS = 2500;

const ROOM_ID = "home-room-1";

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
  const alertAudioRef = useRef(null);
  const lastAlertRef = useRef(0);
  const zonesRef = useRef([]);
  const activeAlertRef = useRef(null);

  const [isCameraOn, setIsCameraOn] = useState(false);
  const [selectedZoneType, setSelectedZoneType] = useState("socket");
  const [zones, setZones] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [activeAlert, setActiveAlert] = useState(null);
  const [isDrawingMode, setIsDrawingMode] = useState(true);

  const isMonitorMode =
    new URLSearchParams(window.location.search).get("monitor") === "1";

  const { modelStatus, detections, startDetection, stopDetection } =
    usePersonDetector();

  const sendRemoteAlert = async (message) => {
    try {
      await set(ref(db, `alerts/${ROOM_ID}`), {
        message,
        active: true,
        time: Date.now(),
      });
    } catch (error) {
      console.error("sendRemoteAlert error", error);
    }
  };

  useEffect(() => {
    if (!isMonitorMode) return;

    const alertsRef = ref(db, `alerts/${ROOM_ID}`);
    const unsubscribe = onValue(alertsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data || !data.active) {
        setActiveAlert(null);
        return;
      }

      setActiveAlert(data.message);
      setAlerts((prev) => [
        {
          id: `remote-${data.time}-${Math.random()}`,
          message: data.message,
          time: formatTime(new Date(data.time)),
        },
        ...prev,
      ].slice(0, 15));
      playAlertSound();
    });

    return () => {
      unsubscribe();
    };
  }, [isMonitorMode]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  useEffect(() => {
    zonesRef.current = zones;
  }, [zones]);

  const playAlertSound = () => {
    try {
      if (!alertAudioRef.current) {
        alertAudioRef.current = new Audio(accident_signalization);
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
  };

  const triggerAlert = (message, fromRemote = false) => {
    const now = Date.now();

    if (now - lastAlertRef.current < ALERT_COOLDOWN_MS) return;

    lastAlertRef.current = now;

    const item = {
      id: crypto.randomUUID(),
      message,
      time: formatTime(new Date()),
    };

    setActiveAlert(item.message);
    setAlerts((prev) => [item, ...prev].slice(0, 15));
    playAlertSound();

    if (!fromRemote && !isMonitorMode) {
      sendRemoteAlert(message);
    }
  };

  const evaluateDanger = (persons) => {
    const currentZones = zonesRef.current;

    if (!currentZones.length || !persons.length) {
      setActiveAlert(null);
      activeAlertRef.current = null;
      return;
    }

    let foundDanger = false;
    let nextAlertMessage = null;

    for (const person of persons) {
      const personRect = personBoxToRect(person.bbox);
      const personArea = personRect.width * personRect.height;

      if (personArea <= 0) continue;

      const personDangerPoint = getPersonDangerPoint(personRect);

      for (const zone of currentZones) {
        const overlap = intersectionArea(personRect, zone.rect);
        const overlapRatio = overlap / personArea;
        const edgeDistance = rectEdgeDistance(personRect, zone.rect);

        const pointNearZone = pointInsideRect(
          personDangerPoint,
          zone.rect,
          PERSON_POINT_PADDING
        );

        if (
          overlapRatio >= DANGER_RATIO_THRESHOLD ||
          edgeDistance <= PROXIMITY_PX_THRESHOLD ||
          pointNearZone
        ) {
          nextAlertMessage = `Кооптуу аймак: ${zone.label}`;
          foundDanger = true;
          break;
        }
      }

      if (foundDanger) break;
    }

    if (foundDanger) {
      setActiveAlert(nextAlertMessage);

      if (activeAlertRef.current !== nextAlertMessage) {
        activeAlertRef.current = nextAlertMessage;
        triggerAlert(nextAlertMessage);
      }
    } else {
      setActiveAlert(null);
      activeAlertRef.current = null;

      if (!isMonitorMode) {
        set(ref(db, `alerts/${ROOM_ID}`), {
          message: "",
          active: false,
          time: Date.now(),
        }).catch((error) => {
          console.error("clear remote alert error", error);
        });
      }
    }
  };

  const startCamera = async () => {
    if (isMonitorMode) {
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
      startDetection(videoRef, evaluateDanger);
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

    if (alertAudioRef.current) {
      alertAudioRef.current.pause();
      alertAudioRef.current.currentTime = 0;
    }

    setIsCameraOn(false);
    setActiveAlert(null);
    activeAlertRef.current = null;
  };

  const removeZone = (id) => {
    setZones((prev) => prev.filter((zone) => zone.id !== id));
  };

  const clearZones = () => {
    setZones([]);
    zonesRef.current = [];
    setActiveAlert(null);
    activeAlertRef.current = null;
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
                  Камера агымынан адамды таап, кооптуу аймакка жакындаса сигнал
                  берет.
                </p>
              </div>

              <div className="text-sm px-3 py-2 rounded-xl bg-slate-800 border border-slate-700">
                {modelStatus}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              {isMonitorMode ? (
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
                onClick={clearZones}
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

            {isMonitorMode ? (
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
                  onAddZone={(zone) => setZones((prev) => [...prev, zone])}
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
                <div className="text-2xl font-bold mt-1">
                  {detections.length}
                </div>
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
                        x:{Math.round(zone.rect.x)} y:{Math.round(zone.rect.y)} w:
                        {Math.round(zone.rect.width)} h:
                        {Math.round(zone.rect.height)}
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
                    <div className="text-xs text-slate-400 mt-1">
                      {item.time}
                    </div>
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