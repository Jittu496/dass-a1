import Navbar from "../components/Navbar";
import { Link } from "react-router-dom";

export default function Dashboard() {
  const role = localStorage.getItem("role");

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="hero">
          <h2>Run events. Sell merch. Manage teams. ✅</h2>
          <p className="muted">
            A modern event platform with QR tickets, approvals, hackathon teams, and feedback.
          </p>

          <div className="row gap" style={{ marginTop: 14 }}>
            <Link className="btn" to="/events">Explore Events</Link>
            {role === "organizer" && <Link className="btn btn-outline" to="/org/create">Create Event</Link>}
            {role === "admin" && <Link className="btn btn-outline" to="/admin/organizers">Manage Organizers</Link>}
            {role === "participant" && <Link className="btn btn-outline" to="/my-tickets">My Tickets</Link>}
          </div>
        </div>

        <div className="grid3" style={{ marginTop: 14 }}>
          <div className="tile">
            <h3>QR Tickets</h3>
            <div className="tiny">Register → QR generated → Organizer scans for attendance.</div>
          </div>
          <div className="tile">
            <h3>Merch Approvals</h3>
            <div className="tiny">Upload payment proof → Organizer approves/rejects → QR pickup.</div>
          </div>
          <div className="tile">
            <h3>Hackathon Teams</h3>
            <div className="tiny">Create team → invite code → join → finalize.</div>
          </div>
        </div>
      </div>
    </>
  );
}
