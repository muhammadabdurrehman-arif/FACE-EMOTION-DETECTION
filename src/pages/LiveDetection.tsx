import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CameraOff,
  Gauge,
  Smartphone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiUrl, fetchJson } from "@/lib/api";

type Face = {
  emotion: string;
  confidence: number;
  probabilities?: Record<string, number>;
};

type LiveResponse = {
  success: boolean;
  face_count: number;
  faces: Face[];
  processed_image: string;
  fps: number;
  inference_time_ms: number;
};

type HealthResponse = {
  status: string;
  model_loaded: boolean;
};

const emotions = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"];

const emotionColors: Record<string, string> = {
  Angry: "#ef4444",
  Disgust: "#22c55e",
  Fear: "#a855f7",
  Happy: "#10b981",
  Sad: "#3b82f6",
  Surprise: "#f59e0b",
  Neutral: "#6b7280",
};

const LiveDetection = () => {
  const [streaming, setStreaming] = useState(false);
  const [predictions, setPredictions] = useState<Face[]>([]);
  const [processedImage, setProcessedImage] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("user");
  const [status, setStatus] = useState("Ready");
  const [fps, setFps] = useState(0);
  const [inferenceMs, setInferenceMs] = useState(0);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    busyRef.current = false;
    setStreaming(false);
    setPredictions([]);
    setProcessedImage("");
    setFps(0);
    setInferenceMs(0);
    setStatus("Stopped");
  }, []);

  const captureAndPredict = useCallback(async () => {
    if (busyRef.current || !videoRef.current) return;

    const video = videoRef.current;
    const width = video.videoWidth;
    const height = video.videoHeight;
    if (!width || !height) return;

    busyRef.current = true;
    const canvas = document.createElement("canvas");
    const maxWidth = 720;
    const scale = Math.min(1, maxWidth / width);
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      busyRef.current = false;
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    try {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/jpeg", 0.82);
      });

      if (!blob) return;

      const formData = new FormData();
      formData.append("image", blob, "mobile-frame.jpg");

      const data = await fetchJson<LiveResponse>("/liveDetection", {
        method: "POST",
        body: formData,
      });

      setPredictions(Array.isArray(data.faces) ? data.faces : []);
      setProcessedImage(data.processed_image || "");
      setFps(Number(data.fps) || 0);
      setInferenceMs(Number(data.inference_time_ms) || 0);
      setStatus(data.face_count > 0 ? `${data.face_count} face detected` : "No face detected");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Backend not responding";
      setStatus(message);
      setPredictions([]);
      setProcessedImage("");
    } finally {
      busyRef.current = false;
    }
  }, []);

  const startCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Camera is not supported in this browser");
      return;
    }

    stopCamera();
    setStatus("Opening camera...");

    try {
      const health = await fetchJson<HealthResponse>("/health");
      if (!health.model_loaded) {
        toast.error("Backend model is not loaded");
        setStatus("Backend model not loaded");
        return;
      }
    } catch {
      toast.error(`Backend not reachable at ${apiUrl("/health")}`);
      setStatus("Backend offline");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setStreaming(true);
      setStatus("Detecting...");
      toast.success("Camera started");

      await captureAndPredict();
      intervalRef.current = setInterval(captureAndPredict, 1200);
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Camera permission denied"
          : "Camera could not start";
      toast.error(message);
      setStatus(message);
      stopCamera();
    }
  }, [captureAndPredict, facingMode, stopCamera]);

  useEffect(() => stopCamera, [stopCamera]);

  const liveEmotionMap: Record<string, number> = {};
  predictions.forEach((prediction) => {
    liveEmotionMap[prediction.emotion] = Math.max(
      liveEmotionMap[prediction.emotion] || 0,
      Number(prediction.confidence) || 0
    );
  });

  const topPrediction = predictions[0];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Emotion Detection</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={startCamera} disabled={streaming}>
            <Camera size={16} className="mr-2" /> Start
          </Button>
          <Button onClick={stopCamera} disabled={!streaming} variant="secondary">
            <CameraOff size={16} className="mr-2" /> Stop
          </Button>
        </div>
      </div>

      <div className="glass-card p-4 md:p-6 grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-4">
          <div className="relative overflow-hidden rounded-lg border bg-black aspect-video">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
            {!streaming && (
              <div className="absolute inset-0 grid place-items-center text-sm text-white/70">
                
              </div>
            )}
          </div>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground">
              
            </h2>
            {emotions.map((emotion) => {
              const value = liveEmotionMap[emotion] || 0;
              return (
                <div key={emotion} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span>{emotion}</span>
                    <span>{value.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(value, 100)}%` }}
                      transition={{ duration: 0.35 }}
                      className="h-full rounded-full"
                      style={{ background: emotionColors[emotion] }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default LiveDetection;