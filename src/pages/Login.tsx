import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2 } from "lucide-react";
// Smile import remove kar diya
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import AuthBackground from "@/components/AuthBackground";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const { login } = useAuth();
  const navigate = useNavigate();

  const validate = () => {
    const e: Record<string, string> = {};

    if (!email.trim()) e.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = "Invalid email format";

    if (!password.trim()) e.password = "Password is required";

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault();
    if (!validate()) return;

    setLoading(true);

    try {
      await login(email, password);
      toast.success("Welcome back!");
      navigate("/dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Login failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthBackground>
      <div className="glass-card p-8 space-y-6">
        <div className="text-center space-y-2">
          {/* Smile icon ki jagah logo image */}
          <motion.div
            className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center mx-auto overflow-hidden"
            whileHover={{ rotate: 10 }}
          >
            <img 
              src="/logo.png" 
              alt="Face Emotion Detection"
              className="w-full h-full object-cover"
            />
          </motion.div>

          <h1 className="text-2xl font-bold font-display text-foreground">
            Welcome Back
          </h1>

          <p className="text-muted-foreground text-sm">
            Sign in to your Face Emotion Detection Dashboard
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={errors.email ? "border-destructive" : ""}
            />
            {errors.email && (
              <p className="text-destructive text-xs">{errors.email}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>

            <div className="relative">
              <Input
                id="password"
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={errors.password ? "border-destructive pr-10" : "pr-10"}
              />

              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2"
              >
                {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>

            {errors.password && (
              <p className="text-destructive text-xs">{errors.password}</p>
            )}
          </div>

          <Button type="submit" className="w-full gradient-primary" disabled={loading}>
            {loading ? <Loader2 className="animate-spin mr-2" size={16} /> : null}
            {loading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <p className="text-center text-sm">
          Don't have an account?{" "}
          <Link to="/signup" className="text-primary">
            Sign up
          </Link>
        </p>
      </div>
    </AuthBackground>
  );
};

export default Login;