import React, { createContext, useContext, useState, useCallback } from "react";

interface User {
  email: string;
  name: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const DEMO_USERS: Record<string, { password: string; name: string }> = {
  "demo@emotion.ai": { password: "Demo1234!", name: "Alex Johnson" },
};

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(() => {
    const stored = localStorage.getItem("emotion_user");
    return stored ? JSON.parse(stored) : null;
  });

  const login = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    const stored = localStorage.getItem("emotion_users");
    const users = stored ? JSON.parse(stored) : DEMO_USERS;
    const found = users[email];
    if (!found || found.password !== password) throw new Error("Invalid email or password");
    const u = { email, name: found.name };
    setUser(u);
    localStorage.setItem("emotion_user", JSON.stringify(u));
  }, []);

  const signup = useCallback(async (name: string, email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 1200));
    const stored = localStorage.getItem("emotion_users");
    const users = stored ? JSON.parse(stored) : { ...DEMO_USERS };
    if (users[email]) throw new Error("User already exists with this email");
    users[email] = { password, name };
    localStorage.setItem("emotion_users", JSON.stringify(users));
    const u = { email, name };
    setUser(u);
    localStorage.setItem("emotion_user", JSON.stringify(u));
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem("emotion_user");
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
