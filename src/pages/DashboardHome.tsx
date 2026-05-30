import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { BarChart3, Heart, Cpu, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { fetchJson } from "@/lib/api";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  CartesianGrid,
  Legend,
} from "recharts";

const EMOTIONS = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"];
const COLORS = ["#ef4444", "#22c55e", "#a855f7", "#eab308", "#3b82f6", "#06b6d4", "#6b7280"];

type StatCard = {
  label: string;
  value: string | number;
  icon: typeof BarChart3;
  color: string;
};

type EmotionDatum = {
  name: string;
  value: number;
};

type HealthResponse = {
  status: string;
};

type StatsResponse = {
  success: boolean;
  total_predictions: number;
  emotion_counts: Record<string, number>;
};

const DashboardHome = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState<StatCard[]>([]);
  const [emotionData, setEmotionData] = useState<EmotionDatum[]>([]);
  const [backendStatus, setBackendStatus] = useState("Checking...");

  const fetchDashboard = async () => {
    try {
      const healthData = await fetchJson<HealthResponse>("/health");
      setBackendStatus(healthData.status === "healthy" ? "Online" : "Offline");

      const statsData = await fetchJson<StatsResponse>("/stats");
      if (!statsData.success) return;

      setStats([
        { label: "Total Predictions", value: statsData.total_predictions || 0, icon: BarChart3, color: "text-pink-500" },
        { label: "Model", value: "MobileNetV2", icon: Cpu, color: "text-purple-500" },
        { label: "Active Emotions", value: EMOTIONS.length, icon: Heart, color: "text-green-500" },
        { label: "Landmarks", value: "18 points", icon: MapPin, color: "text-blue-500" },
      ]);

      const counts = statsData.emotion_counts || {};
      setEmotionData(EMOTIONS.map((emotion) => ({ name: emotion, value: counts[emotion] || 0 })));
    } catch (err) {
      console.error("Dashboard fetch error:", err);
      setBackendStatus("Offline");
    }
  };

  useEffect(() => {
    fetchDashboard();
    const interval = setInterval(fetchDashboard, 5000);
    return () => clearInterval(interval);
  }, []);

  const totalPredictions =
    Number(stats.find((stat) => stat.label === "Total Predictions")?.value) || 0;
  const nonZeroEmotionData = emotionData.filter((item) => item.value > 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 text-white px-4 md:px-6 py-8 rounded-lg">
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent">
            Emotion Detection Dashboard
          </h1>
          <p className="text-gray-400 mt-1">
            Welcome back, {user?.name?.split(" ")[0] || "User"}!
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {stats.map((stat, index) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="p-5 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
            >
              <div className="flex items-center justify-between mb-3 gap-3">
                <Icon className={`${stat.color} w-6 h-6 shrink-0`} />
                <span className="text-2xl font-bold text-white truncate">{stat.value}</span>
              </div>
              <p className="text-gray-400 text-sm">{stat.label}</p>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
        >
          <h2 className="text-xl font-semibold mb-4">Emotion Distribution</h2>
          {totalPredictions === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={350}>
              <PieChart>
                <Pie data={nonZeroEmotionData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={80}>
                  {nonZeroEmotionData.map((entry) => (
                    <Cell key={entry.name} fill={COLORS[EMOTIONS.indexOf(entry.name) % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string) => [
                    `${value} predictions (${((value / totalPredictions) * 100).toFixed(1)}%)`,
                    name,
                  ]}
                  contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="p-6 rounded-lg bg-white/5 backdrop-blur-sm border border-white/10"
        >
          <h2 className="text-xl font-semibold mb-4">Emotion Detection Count</h2>
          {totalPredictions === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-gray-500">
              
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={emotionData} layout="vertical" margin={{ left: 40 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                <XAxis type="number" stroke="#888" domain={[0, "dataMax"]} />
                <YAxis type="category" dataKey="name" stroke="#888" width={70} />
                <Tooltip
                  formatter={(value: number) => [`${value} predictions`, "Count"]}
                  contentStyle={{ backgroundColor: "#1f2937", border: "none", borderRadius: "8px" }}
                />
                <Bar dataKey="value" radius={[0, 8, 8, 0]} label={{ position: "right", fill: "white", fontSize: 12 }}>
                  {emotionData.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default DashboardHome;
