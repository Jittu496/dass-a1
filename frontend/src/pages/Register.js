import { useState } from "react";
import { api } from "../api/client";
import { Link, useNavigate } from "react-router-dom";

export default function Register() {
  const [firstName, setFirst] = useState("");
  const [lastName, setLast] = useState("");
  const [email, setEmail] = useState("");
  const [participantType, setParticipantType] = useState("Non-IIIT");
  const [college, setCollege] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [password, setPass] = useState("");
  const [err, setErr] = useState("");
  const [ok, setOk] = useState("");
  const navigate = useNavigate();

  const IIIT_DOMAINS = ["@iiit.ac.in", "@students.iiit.ac.in", "@research.iiit.ac.in"];
  const isIIITEmail = (em) => IIIT_DOMAINS.some(d => em.toLowerCase().endsWith(d));

  // Auto-detect participant type when email changes
  const handleEmailChange = (val) => {
    setEmail(val);
    setParticipantType(isIIITEmail(val) ? "IIIT" : "Non-IIIT");
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setOk("");
    try {
      // client-side domain enforcement: ensure email ends with allowed domain
      const em = (email || "").trim();
      const lower = em.toLowerCase();
      if (participantType === "IIIT") {
        if (!IIIT_DOMAINS.some(d => lower.endsWith(d)))
          return setErr("IIIT participants must use @iiit.ac.in, @students.iiit.ac.in, or @research.iiit.ac.in email");
      } else {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(lower)) return setErr("Please enter a valid email address");
      }
      if (contactNumber && (contactNumber.length !== 10 || !/^\d{10}$/.test(contactNumber)))
        return setErr("Contact number must be exactly 10 digits");

      await api.post("/auth/register", {

        firstName,
        lastName,
        email,
        password,
        role: "participant",
        participantType,
        college,
        contactNumber,
      });
      // auto-login the user so they can finish onboarding (choose interests / follow organizers)
      const loginRes = await api.post('/auth/login', { email, password });
      localStorage.setItem('token', loginRes.data.token);
      localStorage.setItem('role', loginRes.data.user.role);
      localStorage.setItem('userEmail', loginRes.data.user.email);
      localStorage.setItem('userId', loginRes.data.user._id || loginRes.data.user.id || "");
      // navigate to onboarding where participant can choose interests/followers
      navigate('/onboarding');
    } catch (e2) {
      setErr(e2?.response?.data?.msg || "Registration failed");
    }
  };

  return (
    <div className="center">
      <div className="card">
        <h1>Create Participant Account</h1>
        <p className="muted">Organizers are created by Admin.</p>

        {err && <div className="alert">{err}</div>}
        {ok && <div className="success">{ok}</div>}

        <form onSubmit={submit} className="form">
          <div className="grid2">
            <input className="input" placeholder="First name" value={firstName} onChange={(e) => setFirst(e.target.value)} />
            <input className="input" placeholder="Last name" value={lastName} onChange={(e) => setLast(e.target.value)} />
          </div>
          <div className="grid2">
            <select className="input" value={participantType} onChange={(e) => setParticipantType(e.target.value)}>
              <option value="IIIT">IIIT Participant</option>
              <option value="Non-IIIT">Non-IIIT Participant</option>
            </select>
            <input className="input" placeholder="Email" value={email} onChange={(e) => handleEmailChange(e.target.value)} />
          </div>
          <div className="grid2">
            <input className="input" placeholder="College / Organization" value={college} onChange={(e) => setCollege(e.target.value)} />
            <input className="input" placeholder="Contact number (10 digits)" value={contactNumber}
              inputMode="numeric"
              maxLength={10}
              onChange={(e) => setContactNumber(e.target.value.replace(/\D/g, "").slice(0, 10))} />
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {participantType === "IIIT"
              ? "Use your @students.iiit.ac.in or @research.iiit.ac.in email"
              : "Use your institutional or personal email"}
          </div>
          <input className="input" placeholder="Password" type="password" value={password} onChange={(e) => setPass(e.target.value)} />

          <button className="btn">Register</button>
        </form>

        <div className="row">
          <Link to="/">Back to login</Link>
        </div>
      </div>
    </div>
  );
}
