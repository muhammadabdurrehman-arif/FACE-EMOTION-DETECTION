import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { X, FolderOpen, FileArchive } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { fetchJson } from "@/lib/api";

type UploadResult = {
  emotion: string;
  confidence: number;
  processedImage: string;
  probabilities?: Record<string, number>;
} | null;

type PredictResponse = {
  success: boolean;
  face_count: number;
  faces: {
    emotion: string;
    confidence: number;
    probabilities?: Record<string, number>;
  }[];
  processed_image: string;
};

const UploadPicture = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<UploadResult>(null);

  const handleFiles = useCallback((fileList: FileList) => {
    const validFiles = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/")
    );

    if (validFiles.length === 0) {
      toast.error("Only image files allowed");
      return;
    }

    setFiles(validFiles.slice(0, 1));
    setResult(null);
  }, []);

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setResult(null);
  };

  const uploadToBackend = async () => {
    if (files.length === 0) {
      toast.error("Upload picture first");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("image", files[0]);

    try {
      const data = await fetchJson<PredictResponse>("/predict", {
        method: "POST",
        body: formData,
      });

      if (!data.faces || data.faces.length === 0) {
        throw new Error("No face detected in image");
      }

      const face = data.faces[0];
      setResult({
        emotion: face.emotion || "Unknown",
        confidence: Number(face.confidence) || 0,
        processedImage: data.processed_image,
        probabilities: face.probabilities,
      });
      toast.success("Emotion detected successfully");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Prediction failed";
      console.error("Upload error:", err);
      toast.error(message);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div className="space-y-6" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <h1 className="text-2xl font-bold">Upload Picture</h1>

      <div
        className={`glass-card p-8 md:p-12 border-2 border-dashed text-center transition-colors ${
          dragging ? "border-primary bg-primary/5" : "border-border"
        }`}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
      >
        <FileArchive size={48} className="mx-auto mb-4 text-muted-foreground" />
        <p className="text-muted-foreground">Drag and drop image here</p>
        <p className="text-xs text-muted-foreground mt-1">or</p>

        <input
          type="file"
          accept="image/*"
          className="hidden"
          id="file-upload"
          onChange={(event) => {
            if (event.target.files) {
              handleFiles(event.target.files);
            }
          }}
        />

        <label htmlFor="file-upload">
          <Button 
            type="button"
            className="mt-4 gradient-primary" 
            asChild
          >
            <span>
              <FolderOpen size={16} className="mr-2" />
              Browse Files
            </span>
          </Button>
        </label>
      </div>

      {files.length > 0 && (
        <div className="glass-card p-4 flex items-center justify-between gap-4">
          <p className="min-w-0 truncate text-sm font-medium">{files[0].name}</p>
          <button
            type="button"
            aria-label="Remove file"
            onClick={() => removeFile(0)}
            className="rounded-md p-1 hover:bg-muted transition-colors"
          >
            <X size={18} />
          </button>
        </div>
      )}

      {files.length > 0 && (
        <Button
          onClick={uploadToBackend}
          disabled={loading}
          className="w-full gradient-accent"
        >
          {loading ? "Processing..." : "Detect Emotion"}
        </Button>
      )}

      {result && (
        <div className="glass-card p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">Detected Emotion</p>
            <p className="text-2xl font-bold">{result.emotion}</p>
            <p className="text-sm">
              Confidence: <span className="font-mono font-bold">{result.confidence.toFixed(1)}%</span>
            </p>
          </div>

          {result.processedImage && (
            <img
              src={result.processedImage}
              alt="Processed face emotion detection"
              className="w-full max-h-[520px] rounded-lg border object-contain bg-black/5"
            />
          )}

          {result.probabilities && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-muted-foreground">All Probabilities</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {Object.entries(result.probabilities).map(([emotion, confidence]) => (
                  <div
                    key={emotion}
                    className="flex justify-between rounded-md bg-muted/50 px-3 py-2 text-sm"
                  >
                    <span>{emotion}</span>
                    <span className="font-mono">{Number(confidence).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default UploadPicture;