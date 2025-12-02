import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Login from "./pages/Login";
import TravelerHome from "./pages/TravelerHome";
import MyTrips from "./pages/MyTrips";
import Profile from "./pages/Profile";
import AgentDashboard from "./pages/AgentDashboard";
import TripDetails from "./pages/TripDetails";
import Booking from "./pages/Booking";
import RoleSelection from "./pages/RoleSelection";
import TravelerQuestionnaire from "./pages/TravelerQuestionnaire";
import AgentVerification from "./pages/AgentVerification";
import UpdatePreferences from "./pages/UpdatePreferences";
import AgentNotifications from "./pages/AgentNotifications";
import ManageTrips from "./pages/ManageTrips";
import AddTrip from "./pages/AddTrip";
import ManageDetails from "./pages/ManageDetails";
import AdminDashboard from "./pages/AdminDashboard";
import ManageAgents from "./pages/ManageAgents";
import ManageTravelers from "./pages/ManageTravelers";
import ManageUsers from "./pages/ManageUsers";
import TripApprovals from "./pages/TripApprovals";
import AdminTripView from "./pages/AdminTripView";
import TravelerProfileDetail from "./pages/TravelerProfileDetail";
import AgentProfileDetail from "./pages/AgentProfileDetail";
import ModerationQueue from "./pages/ModerationQueue";
import AdminSettings from "./pages/AdminSettings";
import ResourceInventory from "./pages/ResourceInventory";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/role-selection" element={<RoleSelection />} />
          <Route path="/questionnaire" element={<TravelerQuestionnaire />} />
          <Route path="/agent-verification" element={<AgentVerification />} />
          <Route path="/" element={<AppLayout userRole="traveler"><TravelerHome /></AppLayout>} />
          <Route path="/my-trips" element={<AppLayout userRole="traveler"><MyTrips /></AppLayout>} />
          <Route path="/profile" element={<AppLayout userRole="traveler"><Profile /></AppLayout>} />
          <Route path="/update-preferences" element={<AppLayout userRole="traveler"><UpdatePreferences /></AppLayout>} />
          <Route path="/trip/:tripId" element={<AppLayout userRole="traveler"><TripDetails /></AppLayout>} />
          <Route path="/booking/:tripId" element={<AppLayout userRole="traveler"><Booking /></AppLayout>} />
          <Route path="/search" element={<AppLayout userRole="traveler"><div className="p-8">Search Results (Coming Soon)</div></AppLayout>} />
          <Route path="/agent" element={<AppLayout userRole="agent"><AgentDashboard /></AppLayout>} />
          <Route path="/agent/notifications" element={<AppLayout userRole="agent"><AgentNotifications /></AppLayout>} />
          <Route path="/agent/manage-trips" element={<AppLayout userRole="agent"><ManageTrips /></AppLayout>} />
          <Route path="/agent/add-trip" element={<AppLayout userRole="agent"><AddTrip /></AppLayout>} />
          <Route path="/agent/manage-details/:id" element={<AppLayout userRole="agent"><ManageDetails /></AppLayout>} />
          <Route path="/agent/resource-inventory" element={<AppLayout userRole="agent"><ResourceInventory /></AppLayout>} />
          <Route path="/agent/collaboration" element={<AppLayout userRole="agent"><div className="p-8">Collaboration Hub (Coming Soon)</div></AppLayout>} />
          <Route path="/agent/profile" element={<AppLayout userRole="agent"><div className="p-8">Profile (Coming Soon)</div></AppLayout>} />
          <Route path="/admin" element={<AppLayout userRole="admin"><AdminDashboard /></AppLayout>} />
          <Route path="/admin/trip-approvals" element={<AppLayout userRole="admin"><TripApprovals /></AppLayout>} />
          <Route path="/admin/trip-review/:tripId" element={<AppLayout userRole="admin"><AdminTripView /></AppLayout>} />
          <Route path="/admin/manage-users" element={<AppLayout userRole="admin"><ManageUsers /></AppLayout>} />
          <Route path="/admin/manage-agents" element={<AppLayout userRole="admin"><ManageAgents /></AppLayout>} />
          <Route path="/admin/manage-travelers" element={<AppLayout userRole="admin"><ManageTravelers /></AppLayout>} />
          <Route path="/admin/traveler-profile/:id" element={<AppLayout userRole="admin"><TravelerProfileDetail /></AppLayout>} />
          <Route path="/admin/agent-profile/:id" element={<AppLayout userRole="admin"><AgentProfileDetail /></AppLayout>} />
          <Route path="/admin/moderation" element={<AppLayout userRole="admin"><ModerationQueue /></AppLayout>} />
          <Route path="/admin/settings" element={<AppLayout userRole="admin"><AdminSettings /></AppLayout>} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
