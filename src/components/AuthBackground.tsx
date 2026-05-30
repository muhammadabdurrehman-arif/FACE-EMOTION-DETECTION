import { motion } from "framer-motion";

const AuthBackground = ({ children }: { children: React.ReactNode }) => (
  <div className="min-h-screen gradient-auth-bg flex items-center justify-center p-4 relative overflow-hidden">
    {/* Animated orbs */}
    <motion.div
      className="absolute w-72 h-72 rounded-full opacity-20"
      style={{ background: "hsl(250, 80%, 60%)", filter: "blur(80px)", top: "10%", left: "10%" }}
      animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
      transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute w-96 h-96 rounded-full opacity-15"
      style={{ background: "hsl(280, 80%, 60%)", filter: "blur(100px)", bottom: "10%", right: "10%" }}
      animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
      transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      className="absolute w-48 h-48 rounded-full opacity-10"
      style={{ background: "hsl(170, 70%, 50%)", filter: "blur(60px)", top: "50%", right: "30%" }}
      animate={{ x: [0, 20, 0], y: [0, -30, 0] }}
      transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }}
    />
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="relative z-10 w-full max-w-md"
    >
      {children}
    </motion.div>
  </div>
);

export default AuthBackground;
