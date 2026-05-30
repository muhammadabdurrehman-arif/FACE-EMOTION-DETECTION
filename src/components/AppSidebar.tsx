import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Camera, Upload, Cpu, BarChart3, FileText, Settings, LogOut } from "lucide-react";
// Smile import remove kar diya

import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";

const navItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Live Detection", url: "/dashboard/live", icon: Camera },
  { title: "Upload Picture", url: "/dashboard/upload", icon: Upload },
  { title: "Live Accuracy", url: "/dashboard/accuracy", icon: Cpu },
  { title: "Metrics", url: "/dashboard/metrics", icon: BarChart3 },
  { title: "Reports", url: "/dashboard/reports", icon: FileText },
  { title: "Settings", url: "/dashboard/settings", icon: Settings },
];

const AppSidebar = () => {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { logout } = useAuth();

  const isActive = (path: string) => location.pathname === path;

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          {/* Yeh div missing tha - add karo */}
          <div className="flex items-center gap-3 px-3 py-4">
            {/* 30x30 Logo Container */}
            <div className="w-[30px] h-[30px] gradient-primary rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
              <img 
                src="/logo.png" 
                alt="Face Emotion Detection"
                className="w-[30px] h-[30px] object-cover"
              />
            </div>
            {!collapsed && <span className="font-display font-bold text-lg text-foreground">Face Emotion Detection</span>}
          </div>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    onClick={() => navigate(item.url)}
                    isActive={isActive(item.url)}
                    tooltip={item.title}
                  >
                    <item.icon size={18} />
                    {!collapsed && <span>{item.title}</span>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => { logout(); navigate("/login"); }} tooltip="Logout">
              <LogOut size={18} />
              {!collapsed && <span>Logout</span>}
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
};

export default AppSidebar;