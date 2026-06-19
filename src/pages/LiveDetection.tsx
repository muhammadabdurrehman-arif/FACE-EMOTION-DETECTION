import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Camera,
  CameraOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiUrl, fetchJson } from "@/lib/api";

type Face = {
  emotion: string;
  confidence: number;
  probabilities?: Record<string, number>;
  bbox?: [number, number, number, number];
  landmarks?: [number, number][];
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
  Disgust: "#8b5cf6",
  Fear: "#f59e0b",
  Happy: "#22c55e",
  Sad: "#3b82f6",
  Surprise: "#ec4899",
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const busyRef = useRef(false);
  const streamRef = useRef<MediaStream | null>(null);

  //  STRONGER STABILIZATION
  const emotionHistoryRef = useRef<{emotion: string, confidence: number}[]>([]);
  const MAX_HISTORY = 8; // More history for stability
  const CONFIDENCE_THRESHOLD = 0.5; // 50% threshold
  const MIN_STABLE_COUNT = 4; // Need 4/8 same emotions to change
  const EMOTION_LOCK_TIMEOUT = 2000; // Lock emotion for 2 seconds

  //  Lock system - ek baar emotion set ho toh 2 second tak change na ho
  const lockedEmotionRef = useRef<string | null>(null);
  const lockTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopCamera = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (lockTimerRef.current) {
      clearTimeout(lockTimerRef.current);
      lockTimerRef.current = null;
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
    emotionHistoryRef.current = [];
    lockedEmotionRef.current = null;
  }, []);

  // 🔥 Get stable emotion with lock
  const getStableEmotion = useCallback((newEmotion: string, confidence: number): string => {
    // Agar face nahi mila toh previous emotion rakho
    if (!newEmotion || newEmotion === "Unknown") {
      if (emotionHistoryRef.current.length > 0) {
        return emotionHistoryRef.current[emotionHistoryRef.current.length - 1].emotion;
      }
      return "Neutral";
    }

    //  LOCK CHECK: Agar emotion lock hai toh wahi return karo
    if (lockedEmotionRef.current) {
      return lockedEmotionRef.current;
    }

    // History mein add karo
    emotionHistoryRef.current.push({ emotion: newEmotion, confidence });
    
    if (emotionHistoryRef.current.length > MAX_HISTORY) {
      emotionHistoryRef.current.shift();
    }

    // Count emotions in history
    const emotionCount: Record<string, number> = {};
    let totalConfidence: Record<string, number> = {};
    
    emotionHistoryRef.current.forEach((item) => {
      emotionCount[item.emotion] = (emotionCount[item.emotion] || 0) + 1;
      totalConfidence[item.emotion] = (totalConfidence[item.emotion] || 0) + item.confidence;
    });

    // Find most frequent emotion
    let mostFrequentEmotion = newEmotion;
    let maxCount = 0;
    let maxAvgConfidence = 0;
    
    Object.entries(emotionCount).forEach(([emotion, count]) => {
      const avgConf = (totalConfidence[emotion] || 0) / count;
      // Prefer emotions with higher confidence AND frequency
      if (count > maxCount || (count === maxCount && avgConf > maxAvgConfidence)) {
        maxCount = count;
        mostFrequentEmotion = emotion;
        maxAvgConfidence = avgConf;
      }
    });

    //  CRITICAL: Sirf tabhi emotion change karo jab:
    // 1. 4+ times same emotion ho
    // 2. Average confidence > 50%
    if (maxCount >= MIN_STABLE_COUNT && maxAvgConfidence >= CONFIDENCE_THRESHOLD) {
      // Previous emotion se compare karo
      const previousEmotion = emotionHistoryRef.current.length > 1 
        ? emotionHistoryRef.current[emotionHistoryRef.current.length - 2].emotion 
        : mostFrequentEmotion;
      
      // Agar naya emotion previous se different hai aur stable hai toh lock karo
      if (mostFrequentEmotion !== previousEmotion) {
        //  LOCK THE EMOTION
        lockedEmotionRef.current = mostFrequentEmotion;
        
        // Clear previous lock timer
        if (lockTimerRef.current) {
          clearTimeout(lockTimerRef.current);
        }
        
        // Auto unlock after 2 seconds
        lockTimerRef.current = setTimeout(() => {
          lockedEmotionRef.current = null;
          lockTimerRef.current = null;
        }, EMOTION_LOCK_TIMEOUT);
        
        console.log(`Emotion locked: ${mostFrequentEmotion} for ${EMOTION_LOCK_TIMEOUT}ms`);
      }
      
      return mostFrequentEmotion;
    }

    // Agar stable nahi hai toh last stable emotion return karo
    if (emotionHistoryRef.current.length > 0) {
      // Last emotion jo 3+ times aaya ho
      for (let i = emotionHistoryRef.current.length - 1; i >= 0; i--) {
        const em = emotionHistoryRef.current[i].emotion;
        const count = emotionHistoryRef.current.filter(e => e.emotion === em).length;
        if (count >= 3) {
          return em;
        }
      }
      // Warna last wali emotion
      return emotionHistoryRef.current[emotionHistoryRef.current.length - 1].emotion;
    }

    return newEmotion;
  }, []);

  const drawLandmarks = useCallback((
    ctx: CanvasRenderingContext2D,
    landmarks: [number, number][] | undefined,
    displayWidth: number,
    displayHeight: number,
    color: string
  ) => {
    if (!landmarks || !Array.isArray(landmarks) || landmarks.length === 0) return;

    ctx.fillStyle = color;
    ctx.globalAlpha = 0.6;
    
    landmarks.forEach((point) => {
      if (Array.isArray(point) && point.length >= 2) {
        const x = point[0] * displayWidth;
        const y = point[1] * displayHeight;
        
        ctx.beginPath();
        ctx.arc(x, y, 2, 0, Math.PI * 2);
        ctx.fill();
      }
    });
    
    ctx.globalAlpha = 1;

    if (landmarks.length >= 68) {
      const faceOutline = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      const leftEye = [36, 37, 38, 39, 40, 41];
      const rightEye = [42, 43, 44, 45, 46, 47];
      const mouth = [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59];
      
      const drawContour = (indices: number[]) => {
        ctx.beginPath();
        indices.forEach((idx, i) => {
          const point = landmarks[idx];
          if (!point || !Array.isArray(point) || point.length < 2) return;
          
          const x = point[0] * displayWidth;
          const y = point[1] * displayHeight;
          
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        });
        ctx.closePath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.4;
        ctx.stroke();
        ctx.globalAlpha = 1;
      };
      
      drawContour(faceOutline);
      drawContour(leftEye);
      drawContour(rightEye);
      drawContour(mouth);
    }
  }, []);

  const drawDetections = useCallback(() => {
    if (!canvasRef.current || !videoRef.current || !streaming) return;

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const ctx = canvas.getContext("2d");
    
    if (!ctx) return;

    const displayWidth = video.clientWidth;
    const displayHeight = video.clientHeight;
    
    canvas.width = displayWidth;
    canvas.height = displayHeight;
    
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(video, 0, 0, displayWidth, displayHeight);
    
    predictions.forEach((face, index) => {
      let x = 0, y = 0, boxWidth = displayWidth, boxHeight = displayHeight;
      
      if (face.bbox && face.bbox.length === 4) {
        const [normX, normY, normW, normH] = face.bbox;
        x = normX * displayWidth;
        y = normY * displayHeight;
        boxWidth = normW * displayWidth;
        boxHeight = normH * displayHeight;
      } else {
        const totalFaces = predictions.length;
        const cols = Math.ceil(Math.sqrt(totalFaces));
        const rows = Math.ceil(totalFaces / cols);
        const col = index % cols;
        const row = Math.floor(index / cols);
        const cellWidth = displayWidth / cols;
        const cellHeight = displayHeight / rows;
        x = cellWidth * col + cellWidth * 0.1;
        y = cellHeight * row + cellHeight * 0.1;
        boxWidth = cellWidth * 0.8;
        boxHeight = cellHeight * 0.8;
      }
      
      const emotion = face.emotion || "Neutral";
      const color = emotionColors[emotion] || "#6b7280";
      const confidencePercent = Math.min(100, Math.max(0, (face.confidence * 100))).toFixed(1);
      
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, boxWidth, boxHeight);
      
      const label = `${emotion} ${confidencePercent}%`;
      ctx.font = "bold 11px system-ui";
      const textMetrics = ctx.measureText(label);
      const textWidth = textMetrics.width;
      const textHeight = 20;
      const padding = 6;
      
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.8;
      ctx.fillRect(
        x,
        y - textHeight - padding / 2,
        textWidth + padding * 2,
        textHeight + padding
      );
      
      ctx.globalAlpha = 1;
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 10px system-ui";
      ctx.fillText(
        label,
        x + padding,
        y - padding + 1
      );
      
      const barWidth = boxWidth;
      const barHeight = 3;
      ctx.fillStyle = "rgba(0,0,0,0.3)";
      ctx.fillRect(x, y + boxHeight, barWidth, barHeight);
      
      ctx.fillStyle = color;
      const confidenceValue = Math.min(1, Math.max(0, face.confidence));
      ctx.fillRect(
        x,
        y + boxHeight,
        barWidth * confidenceValue,
        barHeight
      );
      
      if (face.landmarks && face.landmarks.length > 0) {
        drawLandmarks(ctx, face.landmarks, displayWidth, displayHeight, color);
      }
    });
  }, [predictions, streaming, drawLandmarks]);

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

      if (!blob) {
        busyRef.current = false;
        return;
      }

      const formData = new FormData();
      formData.append("image", blob, "mobile-frame.jpg");

      const data = await fetchJson<LiveResponse>("/liveDetection", {
        method: "POST",
        body: formData,
      });

      let processedFaces: Face[] = [];
      
      if (data.faces && Array.isArray(data.faces)) {
        processedFaces = data.faces.map((face: any) => {
          let emotion = face.emotion || "Neutral";
          let confidence = face.confidence || 0;
          
          // Try to get better emotion from probabilities
          if (face.probabilities && typeof face.probabilities === 'object') {
            const entries = Object.entries(face.probabilities);
            if (entries.length > 0) {
              const sorted = entries.sort(([, a], [, b]) => b - a);
              const top = sorted[0];
              emotion = top[0];
              confidence = top[1];
            }
          }
          
          // 🔥 Apply strong stabilization
          const stableEmotion = getStableEmotion(emotion, confidence);
          
          const processedFace: Face = {
            emotion: stableEmotion,
            confidence: confidence,
            bbox: face.bbox,
            landmarks: face.landmarks || face.landmarks_2d,
          };
          
          if (face.probabilities) {
            processedFace.probabilities = face.probabilities;
          }
          
          return processedFace;
        });
      }

      // Ensure at least one face prediction exists
      if (processedFaces.length === 0 && emotionHistoryRef.current.length > 0) {
        // Use last known emotion
        const lastEmotion = emotionHistoryRef.current[emotionHistoryRef.current.length - 1].emotion;
        processedFaces = [{
          emotion: lastEmotion,
          confidence: 0.5,
          bbox: undefined,
          landmarks: undefined
        }];
      }

      setPredictions(processedFaces);
      setProcessedImage(data.processed_image || "");
      setFps(Number(data.fps) || 0);
      setInferenceMs(Number(data.inference_time_ms) || 0);
      
      if (processedFaces.length > 0) {
        const topFace = processedFaces[0];
        const topEmotion = topFace.emotion || "Unknown";
        const topConfidence = Math.min(100, Math.max(0, ((topFace.confidence || 0) * 100))).toFixed(1);
        const lockStatus = lockedEmotionRef.current ? "" : "";
        setStatus(`${processedFaces.length} face(s) detected ${lockStatus} - Top: ${topEmotion} (${topConfidence}%)`);
      } else {
        setStatus("No face detected");
      }
      
      drawDetections();
    } catch (err) {
      console.error("Prediction Error:", err);
      const message = err instanceof Error ? err.message : "Backend not responding";
      setStatus(message);
      setPredictions([]);
      setProcessedImage("");
    } finally {
      busyRef.current = false;
    }
  }, [drawDetections, getStableEmotion]);

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

      emotionHistoryRef.current = [];
      lockedEmotionRef.current = null;

      await captureAndPredict();
      intervalRef.current = setInterval(captureAndPredict, 200);
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

  useEffect(() => {
    if (!streaming || !videoRef.current) return;
    
    const video = videoRef.current;
    const updateCanvas = () => {
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        drawDetections();
      }
      requestAnimationFrame(updateCanvas);
    };
    
    const animationId = requestAnimationFrame(updateCanvas);
    return () => cancelAnimationFrame(animationId);
  }, [streaming, drawDetections]);

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  const liveEmotionMap: Record<string, number> = {};
  predictions.forEach((prediction) => {
    const confidenceValue = Math.min(100, Math.max(0, Number(prediction.confidence) * 100));
    if (!liveEmotionMap[prediction.emotion] || confidenceValue > liveEmotionMap[prediction.emotion]) {
      liveEmotionMap[prediction.emotion] = confidenceValue;
    }
  });

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Emotion Detection</h1>
          {status && (
            <p className="text-sm text-muted-foreground mt-1">{status}</p>
          )}
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
              className="absolute top-0 left-0 w-full h-full object-contain"
              style={{ opacity: 0 }}
            />
            <canvas
              ref={canvasRef}
              className="absolute top-0 left-0 w-full h-full object-contain"
            />
          </div>
          
          {streaming && (
            <div className="flex gap-4 text-xs text-muted-foreground">
              <span>FPS: {fps.toFixed(1)}</span>
              <span>Inference: {inferenceMs.toFixed(0)}ms</span>
              <span>Faces: {predictions.length}</span>
              {lockedEmotionRef.current && (
                <span className="text-green-500 font-bold">
                   {lockedEmotionRef.current}
                </span>
              )}
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <h2 className="font-semibold text-sm text-muted-foreground">
              Emotion Confidence
            </h2>
            {emotions.map((emotion) => {
              const value = liveEmotionMap[emotion] || 0;
              const isLocked = lockedEmotionRef.current === emotion;
              return (
                <div key={emotion} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="font-medium" style={{ color: emotionColors[emotion] }}>
                      {emotion}
                      {isLocked && (
                        <span className="ml-1 text-[9px] bg-green-500/20 text-green-500 px-1.5 py-0.5 rounded">
                          LOCKED
                        </span>
                      )}
                    </span>
                    <span className="font-mono">{value.toFixed(1)}%</span>
                  </div>
                  <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(value, 100)}%` }}
                      transition={{ duration: 0.35 }}
                      className="h-full rounded-full"
                      style={{ 
                        background: emotionColors[emotion],
                        opacity: isLocked ? 1 : 0.7
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {predictions.length > 1 && (
            <div className="border-t pt-3">
              <h2 className="font-semibold text-sm text-muted-foreground mb-2">
                Detected Faces ({predictions.length})
              </h2>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {predictions.map((face, index) => {
                  const conf = Math.min(100, Math.max(0, (face.confidence || 0) * 100));
                  return (
                    <div key={index} className="flex justify-between text-xs bg-muted/20 p-1.5 rounded">
                      <span style={{ color: emotionColors[face.emotion] }}>
                        Face {index + 1}
                      </span>
                      <span className="font-medium">{face.emotion}</span>
                      <span className="font-mono">{conf.toFixed(1)}%</span>
                      {face.landmarks && face.landmarks.length > 0 && (
                        <span className="text-muted-foreground">{face.landmarks.length}pts</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default LiveDetection;