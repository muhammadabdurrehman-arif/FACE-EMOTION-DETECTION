import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Brain, Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import AuthBackground from "@/components/AuthBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error("Please enter a valid email");
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setSent(true);
    toast.success("Reset link sent!");
    setLoading(false);
  };

  return (
    <AuthBackground>
      <div className="glass-card p-8 space-y-6">
        <div className="text-center space-y-2">
          <motion.div
            className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mx-auto"
            whileHover={{ rotate: 10 }}
          >
            <Brain className="text-primary-foreground" size={28} />
          </motion.div>
          <h1 className="text-2xl font-bold font-display text-foreground">Reset Password</h1>
          <p className="text-muted-foreground text-sm">We'll send you a reset link</p>
        </div>

        {sent ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-4">
            <div className="w-16 h-16 gradient-accent rounded-full flex items-center justify-center mx-auto">
              <Mail className="text-accent-foreground" size={28} />
            </div>
            <p className="text-foreground font-medium">Check your email</p>
            <p className="text-muted-foreground text-sm">We sent a password reset link to <strong>{email}</strong></p>
          </motion.div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <Button type="submit" className="w-full gradient-primary text-primary-foreground" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
        )}

        <Link to="/login" className="flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={14} /> Back to login
        </Link>
      </div>
    </AuthBackground>
  );
};

export default ForgotPassword;
