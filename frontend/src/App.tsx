import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import Login from "./pages/Login";
import TravelerHome from "./pages/TravelerHome";
import MyTrips from "./pages/MyTrips";
import MyBookings from "./pages/MyBookings";
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
import SearchResults from "./pages/SearchResults";
import NotFound from "./pages/NotFound";
import CollaborationHub from "./pages/CollaborationHub";
import TravelerNotifications from "./pages/TravelerNotifications";
import EditProfile from "./pages/EditProfile";
import ExploreTrips from "./pages/ExploreTrips";
import AgentReviews from "./pages/AgentReviews";
import AgentProfile from "./pages/AgentProfile";
import AgentPassengers from "./pages/AgentPassengers";
import { AuthProvider } from "./contexts/AuthContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/role-selection" element={<RoleSelection />} />
            <Route path="/questionnaire" element={<TravelerQuestionnaire />} />
            <Route path="/agent-verification" element={<AgentVerification />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <TravelerHome />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-trips"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <MyTrips />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/my-bookings"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <MyBookings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <TravelerNotifications />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <Profile />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile/edit"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <EditProfile />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/explore"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <ExploreTrips />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent-reviews"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <AgentReviews />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/update-preferences"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <UpdatePreferences />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/trip/:tripId"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <TripDetails />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/booking/:id"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <Booking />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/search"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="traveler">
                    <SearchResults />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <AgentDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/notifications"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <AgentNotifications />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/manage-trips"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <ManageTrips />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/add-trip"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <AddTrip />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/manage-details/:id"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <ManageDetails />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/resource-inventory"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <ResourceInventory />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/collaboration"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <CollaborationHub />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/profile"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <AgentProfile />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/agent/passengers"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="agent">
                    <AgentPassengers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <AdminDashboard />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/trip-approvals"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <TripApprovals />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/trip-review/:tripId"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <AdminTripView />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-users"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <ManageUsers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-agents"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <ManageAgents />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/manage-travelers"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <ManageTravelers />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/traveler-profile/:id"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <TravelerProfileDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/agent-profile/:id"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <AgentProfileDetail />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/moderation"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <ModerationQueue />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/settings"
              element={
                <ProtectedRoute>
                  <AppLayout userRole="admin">
                    <AdminSettings />
                  </AppLayout>
                </ProtectedRoute>
              }
            />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
