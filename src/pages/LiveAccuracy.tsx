import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type AccuracyResponse = {
  success: boolean;
  accuracy: number;
  per_emotion_accuracy?: Record<string, number>;
};

type ChartData = {
  emotion: string;
  accuracy: number;
};

const emotionOrder = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"];

const LiveAccuracy = () => {
  const [data, setData] = useState<ChartData[]>([]);
  const [overall, setOverall] = useState(0);
  const [loading, setLoading] = useState(false);

  const fetchAccuracy = async () => {
    setLoading(true);
    try {
      const json = await fetchJson<AccuracyResponse>("/liveAccuracy");
      const perEmotion = json.per_emotion_accuracy || {};
      setData(
        emotionOrder.map((emotion) => ({
          emotion,
          accuracy: Number(perEmotion[emotion]) || 0,
        }))
      );
      setOverall(Number(json.accuracy) || 0);
      toast.success("Live accuracy updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch accuracy";
      console.error("Accuracy error:", err);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAccuracy();
  }, []);

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold">Live Accuracy</h1>
      <div className="glass-card p-6 space-y-6">
        <div className="text-center">
          <p className="text-muted-foreground">Average Confidence</p>
          <h2 className="text-4xl font-bold text-primary">{overall.toFixed(1)}%</h2>
        </div>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="emotion" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="accuracy" fill="#6366f1" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <Button onClick={fetchAccuracy} disabled={loading} className="w-full gradient-accent">
          {loading ? "Refreshing..." : "Refresh Accuracy"}
        </Button>
      </div>
    </motion.div>
  );
};

export default LiveAccuracy;
