import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { FileText, Download, Clock, CheckCircle2, AlertCircle, Trash2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { apiUrl, fetchJson } from "@/lib/api";

type LogEntry = {
  id: number;
  timestamp: string;
  emotion: string;
  confidence: number;
  status: string;
};

const Reports = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLog, setNewLog] = useState({
    emotion: "Happy",
    confidence: 85,
    status: "success"
  });

  const emotions = ["Angry", "Disgust", "Fear", "Happy", "Sad", "Surprise", "Neutral"];

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const data = await fetchJson<LogEntry[]>("/logs");
      setLogs(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      toast.error("Could not fetch logs");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await fetch(apiUrl(`/logs/delete/${id}`), { method: "DELETE" });
      if (!response.ok) throw new Error("Delete failed");
      setLogs((prev) => prev.filter((log) => log.id !== id));
      toast.success("Report deleted");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Delete error";
      toast.error(message);
    }
  };

  const handleAddLog = async () => {
    try {
      const newId = logs.length > 0 ? Math.max(...logs.map(l => l.id)) + 1 : 1;
      const timestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
      
      const logEntry: LogEntry = {
        id: newId,
        timestamp: timestamp,
        emotion: newLog.emotion,
        confidence: newLog.confidence,
        status: newLog.status
      };
      
      // For frontend only - since backend doesn't have POST /logs
      setLogs(prev => [logEntry, ...prev]);
      toast.success("Report added successfully");
      setShowAddModal(false);
      setNewLog({ emotion: "Happy", confidence: 85, status: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Add error";
      toast.error(message);
    }
  };

  const handleDownload = () => {
    if (logs.length === 0) {
      toast.error("No logs to download");
      return;
    }

    const csvRows = [
      ["ID", "Timestamp", "Emotion", "Confidence", "Status"],
      ...logs.map((log) => [log.id, log.timestamp, log.emotion, log.confidence, log.status]),
    ];
    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `emotion_report_${new Date().toISOString().slice(0, 19)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Report downloaded");
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Emotion Detection Reports</h1>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setShowAddModal(true)} className="gradient-primary">
            <Plus size={16} className="mr-2" />
            Add Report
          </Button>
          <Button onClick={handleDownload} variant="outline">
            <Download size={16} className="mr-2" />
            Download CSV
          </Button>
        </div>
      </div>

      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-4 text-muted-foreground font-medium">ID</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Timestamp</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Emotion</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Confidence</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-4 text-muted-foreground font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    {loading ? "Loading reports..." : "No reports available. Click 'Add Report' to create one."}
                  </td>
                </tr>
              ) : (
                logs.map((log, index) => (
                  <motion.tr
                    key={log.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-4 font-mono">#{log.id}</td>
                    <td className="p-4 text-muted-foreground">
                      <span className="inline-flex items-center gap-2">
                        <Clock size={14} />
                        {log.timestamp}
                      </span>
                    </td>
                    <td className="p-4 font-medium">{log.emotion}</td>
                    <td className="p-4">
                      <span className={log.confidence >= 70 ? "text-green-500 font-mono" : "text-red-500 font-mono"}>
                        {Number(log.confidence).toFixed(1)}%
                      </span>
                    </td>
                    <td className="p-4">
                      {log.status === "success" ? (
                        <span className="flex items-center gap-1 text-green-500 text-xs">
                          <CheckCircle2 size={14} />
                          Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-500 text-xs">
                          <AlertCircle size={14} />
                          Low confidence
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <Button variant="destructive" size="sm" onClick={() => handleDelete(log.id)}>
                        <Trash2 size={14} />
                      </Button>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-900 rounded-lg p-6 w-full max-w-md mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="text-xl font-bold mb-4">Add New Report</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Emotion</label>
                <select
                  value={newLog.emotion}
                  onChange={(e) => setNewLog({ ...newLog, emotion: e.target.value })}
                  className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  {emotions.map((emotion) => (
                    <option key={emotion} value={emotion}>{emotion}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Confidence (%)</label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={newLog.confidence}
                  onChange={(e) => setNewLog({ ...newLog, confidence: Number(e.target.value) })}
                  className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select
                  value={newLog.status}
                  onChange={(e) => setNewLog({ ...newLog, status: e.target.value })}
                  className="w-full p-2 border rounded-lg dark:bg-gray-800 dark:border-gray-700"
                >
                  <option value="success">Success</option>
                  <option value="low_confidence">Low Confidence</option>
                </select>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <Button onClick={handleAddLog} className="flex-1 gradient-primary">
                Add Report
              </Button>
              <Button onClick={() => setShowAddModal(false)} variant="outline" className="flex-1">
                Cancel
              </Button>
            </div>
          </motion.div>
        </div>
      )}
    </motion.div>
  );
};

export default Reports;