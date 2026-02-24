import { Link, useNavigate } from "react-router-dom";
import { api } from "../api/client";

export default function Navbar() {
  const navigate = useNavigate();
  const role = localStorage.getItem("role");

  const logout = () => {
    try { api.post('/auth/logout').catch(() => { }); } finally {
      localStorage.removeItem("token");
      localStorage.removeItem("role");
      localStorage.removeItem("userEmail");
      localStorage.removeItem("userId");
      navigate("/");
    }
  };

  return (
    <div className="nav">
      <div className="nav-left">
        <Link className="brand" to="/dashboard">
          <span className="brand-mark" />
          Felicity EMS
        </Link>
        <span className="badge">{role || "guest"}</span>
      </div>

      <div className="nav-right">
        {/* Participant */}
        {role === "participant" && (
          <>
            <Link className="nav-link" to="/dashboard">Dashboard</Link>
            <Link className="nav-link" to="/events">Browse Events</Link>
            <Link className="nav-link" to="/my-events">My Events</Link>
            <Link className="nav-link" to="/clubs">Clubs/Organizers</Link>
            <Link className="nav-link" to="/my-tickets">Tickets</Link>
            <Link className="nav-link" to="/my-orders">Orders</Link>
            <Link className="nav-link" to="/team">Team</Link>
            <Link className="nav-link" to="/feedback">Feedback</Link>
            <Link className="nav-link" to="/forum">Forum</Link>
            <Link className="nav-link" to="/profile">Profile</Link>
          </>
        )}


        {/* Organizer */}
        {role === "organizer" && (
          <>
            <Link className="nav-link" to="/org/events">Dashboard</Link>
            <Link className="nav-link" to="/org/create">Create Event</Link>
            <Link className="nav-link" to="/org/events?status=ongoing">Ongoing Events</Link>
            <Link className="nav-link" to="/org/scan">Scan</Link>
            <Link className="nav-link" to="/org/feedback">Feedback</Link>
            <Link className="nav-link" to="/org/reset">Reset Req</Link>
            <Link className="nav-link" to="/forum">Forum</Link>
            <Link className="nav-link" to="/org/profile">Profile</Link>
          </>
        )}


        {/* Admin */}
        {role === "admin" && (
          <>
            <Link className="nav-link" to="/dashboard">Dashboard</Link>
            <Link className="nav-link" to="/admin/organizers">Manage Clubs</Link>
            <Link className="nav-link" to="/admin/password-resets">Resets</Link>
          </>
        )}

        <button className="btn btn-outline" onClick={logout}>Logout</button>
      </div>
    </div>
  );
}
