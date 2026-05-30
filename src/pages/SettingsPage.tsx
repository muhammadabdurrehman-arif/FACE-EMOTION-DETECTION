import { useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, Save, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const SettingsPage = () => {
  const { user } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email] = useState(user?.email || "");
  const [currentPass, setCurrentPass] = useState("");
  const [newPass, setNewPass] = useState("");
  const [confirmPass, setConfirmPass] = useState("");
  const [saving, setSaving] = useState(false);

  const handleProfileSave = async () => {
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success("Profile updated!");
    setSaving(false);
  };

  const handlePasswordChange = async () => {
    if (!currentPass || !newPass) { toast.error("Fill all password fields"); return; }
    if (newPass !== confirmPass) { toast.error("Passwords don't match"); return; }
    if (newPass.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setSaving(true);
    await new Promise((r) => setTimeout(r, 1000));
    toast.success("Password changed!");
    setCurrentPass(""); setNewPass(""); setConfirmPass("");
    setSaving(false);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Settings</h1>
        <p className="text-muted-foreground mt-1">Manage your profile and preferences</p>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <User size={20} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">Profile</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input value={email} disabled className="opacity-60" />
          </div>
          <Button onClick={handleProfileSave} disabled={saving} className="gradient-primary text-primary-foreground">
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Save size={16} className="mr-2" />}
            Save Changes
          </Button>
        </div>
      </div>

      <div className="glass-card p-6 space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <Lock size={20} className="text-primary" />
          <h2 className="font-display font-semibold text-foreground">Change Password</h2>
        </div>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Current Password</Label>
            <Input type="password" value={currentPass} onChange={(e) => setCurrentPass(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>New Password</Label>
            <Input type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Confirm New Password</Label>
            <Input type="password" value={confirmPass} onChange={(e) => setConfirmPass(e.target.value)} />
          </div>
          <Button onClick={handlePasswordChange} disabled={saving} variant="outline">
            {saving ? <Loader2 size={16} className="animate-spin mr-2" /> : <Lock size={16} className="mr-2" />}
            Change Password
          </Button>
        </div>
      </div>
    </motion.div>
  );
};

export default SettingsPage;
