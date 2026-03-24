import { useCallback, useEffect, useRef, useState } from "react";
import * as cocoSsd from "@tensorflow-models/coco-ssd";
import "@tensorflow/tfjs";

const PERSON_SCORE_THRESHOLD = 0.55;
const VIDEO_WIDTH = 960;

export default function usePersonDetector() {
  const detectorRef = useRef(null);
  const rafRef = useRef(null);

  const [modelStatus, setModelStatus] = useState("Модель жүктөлгөн жок");
  const [detections, setDetections] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadModel() {
      try {
        setModelStatus("Модель жүктөлүп жатат...");
        const model = await cocoSsd.load({ base: "lite_mobilenet_v2" });
        if (!mounted) return;

        detectorRef.current = model;
        setModelStatus("Модель даяр");
      } catch (error) {
        console.error(error);
        if (mounted) {
          setModelStatus("Модель жүктөлгөн жок");
        }
      }
    }

    loadModel();

    return () => {
      mounted = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    };
  }, []);

  const startDetection = useCallback((videoRef, onDetect) => {
    const detectFrame = async () => {
      const video = videoRef.current;
      const detector = detectorRef.current;

      if (
        !video ||
        !detector ||
        video.readyState < 2 ||
        video.videoWidth === 0 ||
        video.videoHeight === 0
      ) {
        rafRef.current = requestAnimationFrame(detectFrame);
        return;
      }

      try {
        const predictions = await detector.detect(video);
        const persons = predictions.filter(
          (p) => p.class === "person" && p.score >= PERSON_SCORE_THRESHOLD
        ).map(person => ({
          ...person,
          bbox: [
            VIDEO_WIDTH - person.bbox[0] - person.bbox[2], // invert x
            person.bbox[1],
            person.bbox[2],
            person.bbox[3]
          ]
        }));

        setDetections(persons);

        if (onDetect) {
          onDetect(persons);
        }
      } catch (error) {
        console.error("Detection error:", error);
      }

      rafRef.current = requestAnimationFrame(detectFrame);
    };

    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
    }

    rafRef.current = requestAnimationFrame(detectFrame);
  }, []);

  const stopDetection = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    setDetections([]);
  }, []);

  return {
    modelStatus,
    detections,
    startDetection,
    stopDetection,
  };
}