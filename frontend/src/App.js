import { BrowserRouter, Routes, Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import BrowseEvents from "./pages/BrowseEvents";
import EventDetails from "./pages/EventDetails";
import MyTickets from "./pages/MyTickets";
import MyOrders from "./pages/MyOrders";
import ParticipantDashboard from "./pages/ParticipantDashboard";
import ClubsPage from "./pages/ClubsPage";
import OrganizerDetailPage from "./pages/OrganizerDetailPage";

import TeamHackathon from "./pages/TeamHackathon";
import TeamInvites from "./pages/TeamInvites";
import Forum from "./pages/Forum";
import FeedbackParticipant from "./pages/FeedbackParticipant";
import FeedbackOrganizer from "./pages/FeedbackOrganizer";
import OrganizerResetRequest from "./pages/OrganizerResetRequest";

import OrganizerMyEvents from "./pages/OrganizerMyEvents";
import OrganizerCreateEvent from "./pages/OrganizerCreateEvent";
import OrganizerEditEvent from "./pages/OrganizerEditEvent";
import OrganizerOrders from "./pages/OrganizerOrders";
import OrganizerScan from "./pages/OrganizerScan";
import OrganizerAnalytics from "./pages/OrganizerAnalytics";
import OrganizerProfile from "./pages/OrganizerProfile";

import AdminOrganizers from "./pages/AdminOrganizers";
import AdminPasswordResets from "./pages/AdminPasswordResets";
import Profile from "./pages/Profile";
import Onboarding from "./pages/Onboarding";

import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";

import "./styles.css";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/register" element={<Register />} />

        <Route path="/dashboard" element={
          <ProtectedRoute><Dashboard /></ProtectedRoute>
        } />

        <Route path="/events" element={
          <ProtectedRoute><BrowseEvents /></ProtectedRoute>
        } />

        <Route path="/events/:id" element={
          <ProtectedRoute><EventDetails /></ProtectedRoute>
        } />

        {/* Participant */}
        <Route path="/my-events" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><ParticipantDashboard /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/clubs" element={
          <ProtectedRoute><ClubsPage /></ProtectedRoute>
        } />

        <Route path="/clubs/:id" element={
          <ProtectedRoute><OrganizerDetailPage /></ProtectedRoute>
        } />

        <Route path="/my-tickets" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><MyTickets /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/my-orders" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><MyOrders /></RoleRoute></ProtectedRoute>
        } />

        {/* Organizer */}
        <Route path="/org/events" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerMyEvents /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/create" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerCreateEvent /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/edit/:id" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerEditEvent /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/orders/:eventId" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerOrders /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/scan" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerScan /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/analytics/:eventId" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerAnalytics /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/profile" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerProfile /></RoleRoute></ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin/organizers" element={
          <ProtectedRoute><RoleRoute allow={["admin"]}><AdminOrganizers /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/admin/password-resets" element={
          <ProtectedRoute><RoleRoute allow={["admin"]}><AdminPasswordResets /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/profile" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><Profile /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/onboarding" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><Onboarding /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/team" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><TeamHackathon /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/team/invites" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><TeamInvites /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/team/join/:token" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><TeamHackathon /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/feedback" element={
          <ProtectedRoute><RoleRoute allow={["participant"]}><FeedbackParticipant /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/feedback" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><FeedbackOrganizer /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/org/reset" element={
          <ProtectedRoute><RoleRoute allow={["organizer"]}><OrganizerResetRequest /></RoleRoute></ProtectedRoute>
        } />

        <Route path="/forum" element={
          <ProtectedRoute><RoleRoute allow={["participant", "organizer", "admin"]}><Forum /></RoleRoute></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
