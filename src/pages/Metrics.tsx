import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from "recharts";
import { fetchJson } from "@/lib/api";

const EMOTION_LABELS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"] as const;

type BackendData = {
  accuracy: number;
  per_emotion_accuracy?: Record<string, number>;
};

type ConfusionMatrixResponse = {
  matrix: number[][];
  labels: string[];
  total_predictions: number;
};

const createEmptyMatrix = () => Array.from({ length: 7 }, () => Array.from({ length: 7 }, () => 0));

const Metrics = () => {
  const [accuracyData, setAccuracyData] = useState([{ model: "Live Model", accuracy: 0 }]);
  const [emotionData, setEmotionData] = useState(
    EMOTION_LABELS.map((emotion) => ({ emotion, precision: 0, recall: 0 }))
  );
  const [confusionMatrix, setConfusionMatrix] = useState<number[][]>(createEmptyMatrix());
  const [totalPredictions, setTotalPredictions] = useState<number>(0);

  const fetchMetrics = async (): Promise<void> => {
    try {
      const data = await fetchJson<BackendData>("/liveAccuracy");
      const currentAccuracy = Number(data.accuracy) || 0;
      const perEmotion = data.per_emotion_accuracy || {};

      setAccuracyData([{ model: "Live Model", accuracy: currentAccuracy }]);
      setEmotionData(
        EMOTION_LABELS.map((emotion) => {
          const percent = Number(perEmotion[emotion]) || 0;
          return {
            emotion,
            precision: Math.round(percent * 10) / 10,
            recall: Math.round(percent * 10) / 10,
          };
        })
      );
    } catch (err) {
      console.error("Failed to fetch metrics:", err);
      setEmotionData(EMOTION_LABELS.map((emotion) => ({ emotion, precision: 0, recall: 0 })));
    }
  };

  const fetchConfusionMatrix = async (): Promise<void> => {
    try {
      const data = await fetchJson<ConfusionMatrixResponse>("/confusionMatrix");
      if (data && Array.isArray(data.matrix)) {
        setConfusionMatrix(data.matrix);
        setTotalPredictions(data.total_predictions || 0);
      } else {
        setConfusionMatrix(createEmptyMatrix());
      }
    } catch (err) {
      console.error("Failed to fetch confusion matrix:", err);
      setConfusionMatrix(createEmptyMatrix());
    }
  };

  useEffect(() => {
    fetchMetrics();
    fetchConfusionMatrix();
    const metricInterval = setInterval(fetchMetrics, 3000);
    const matrixInterval = setInterval(fetchConfusionMatrix, 5000);
    return () => {
      clearInterval(metricInterval);
      clearInterval(matrixInterval);
    };
  }, []);

  const getHeatColor = (value: number, maxValue: number): string => {
    if (maxValue === 0) return "hsl(0, 0%, 20%)";
    const intensity = Math.min(value / Math.max(maxValue, 1), 1);
    if (intensity >= 0.7) return "hsl(142, 70%, 45%)";
    if (intensity >= 0.4) return "hsl(45, 80%, 50%)";
    if (intensity >= 0.2) return "hsl(30, 80%, 50%)";
    return "hsl(0, 70%, 55%)";
  };

  const getMaxValue = (): number => {
    let max = 0;
    for (const row of confusionMatrix) {
      for (const val of row) {
        if (val > max) max = val;
      }
    }
    return max;
  };

  const hasMatrixData = confusionMatrix.some((row) => row.some((value) => value > 0));
  const maxValue = getMaxValue();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <h1 className="text-2xl font-bold">Accuracy & Metrics</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Live Model Accuracy</h2>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={accuracyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="model" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-6">
          <h2 className="font-semibold mb-4">Emotion Confidence</h2>
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={emotionData} outerRadius={90}>
              <PolarGrid />
              <PolarAngleAxis dataKey="emotion" />
              <PolarRadiusAxis domain={[0, 100]} />
              <Radar
                name="Detection %"
                dataKey="precision"
                stroke="#8b5cf6"
                fill="#8b5cf6"
                fillOpacity={0.2}
              />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="glass-card p-6">
        <h2 className="font-semibold mb-4">
          Confusion Matrix
          <span className={`text-xs ml-2 ${hasMatrixData ? "text-green-500" : "text-muted-foreground"}`}>
            {hasMatrixData 
              ? `(Live data - ${totalPredictions} predictions)` 
              : "(No predictions yet - upload an image or start live detection)"}
          </span>
        </h2>
        {hasMatrixData ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="bg-muted/50">
                  <th className="p-2 border">Actual / Predicted</th>
                  {EMOTION_LABELS.map((label) => (
                    <th key={label} className="p-2 border">{label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {confusionMatrix.map((row, rowIndex) => (
                  <tr key={EMOTION_LABELS[rowIndex]} className="hover:bg-muted/30">
                    <td className="p-2 font-medium border bg-muted/20">{EMOTION_LABELS[rowIndex]}</td>
                    {row.map((value, columnIndex) => (
                      <td key={`${rowIndex}-${columnIndex}`} className="p-1 border text-center">
                        <div
                          className="w-10 h-10 rounded-md flex items-center justify-center mx-auto font-bold transition-all"
                          style={{
                            backgroundColor: getHeatColor(value, maxValue),
                            color: value > maxValue * 0.5 ? "white" : "black",
                            opacity: value > 0 ? 0.9 : 0.3,
                          }}
                        >
                          {value}
                        </div>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12 text-muted-foreground">
            <p>No confusion matrix data available yet.</p>
            <p className="text-sm mt-2">Upload an image or start live detection to see data.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default Metrics;