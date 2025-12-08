import { Home, MapPin, User, LogOut, LayoutDashboard, Bell, Briefcase, MessageSquare, Users, UserCog, Calendar } from "lucide-react";
import { NavLink } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  userRole: "traveler" | "agent" | "admin";
}

const travelerItems = [
  { title: "Home", url: "/", icon: Home },
  { title: "My Trips", url: "/my-trips", icon: MapPin },
  { title: "My Bookings", url: "/my-bookings", icon: Calendar },
  { title: "Profile", url: "/profile", icon: User },
];

const agentItems = [
  { title: "Dashboard", url: "/agent", icon: LayoutDashboard },
  { title: "Notifications", url: "/agent/notifications", icon: Bell },
  { title: "Manage Trips", url: "/agent/manage-trips", icon: Briefcase },
  { title: "Resource Inventory", url: "/agent/resource-inventory", icon: Briefcase },
  { title: "Collaboration Hub", url: "/agent/collaboration", icon: MessageSquare },
  { title: "Profile", url: "/agent/profile", icon: User },
];

const adminItems = [
  { title: "Dashboard", url: "/admin", icon: LayoutDashboard },
  { title: "Trip Approvals", url: "/admin/trip-approvals", icon: Briefcase },
  { title: "Manage Users", url: "/admin/manage-users", icon: Users },
  { title: "Reports & Moderation", url: "/admin/moderation", icon: MessageSquare },
  { title: "Settings", url: "/admin/settings", icon: UserCog },
];

export function AppSidebar({ userRole }: AppSidebarProps) {
  const { state } = useSidebar();
  const items = userRole === "traveler" ? travelerItems : userRole === "agent" ? agentItems : adminItems;
  const collapsed = state === "collapsed";

  const getNavClass = ({ isActive }: { isActive: boolean }) =>
    isActive
      ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
      : "text-sidebar-foreground hover:bg-sidebar-accent/50";

  return (
    <Sidebar className={collapsed ? "w-16" : "w-64"} collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground font-heading text-lg font-bold px-4 py-6">
            {!collapsed && "TourWise"}
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink to={item.url} end className={getNavClass}>
                      <item.icon className="h-5 w-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => window.location.href = "/login"}
                  className="text-sidebar-foreground hover:bg-sidebar-accent/50"
                >
                  <LogOut className="h-5 w-5" />
                  {!collapsed && <span>Logout</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
