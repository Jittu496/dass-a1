import { useState } from "react";
import { api } from "../api/client";
import { Link, useNavigate } from "react-router-dom";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const res = await api.post("/auth/login", { email, password });
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("role", res.data.user.role);
      localStorage.setItem("userEmail", res.data.user.email);
      localStorage.setItem("userId", res.data.user._id || res.data.user.id || "");
      // navigate to role-specific landing
      const role = res.data.user.role;
      if (role === 'admin') navigate('/admin/organizers');
      else if (role === 'organizer') navigate('/org/events');
      else navigate('/dashboard');
    } catch (e2) {
      setErr(e2?.response?.data?.msg || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="center">
      <div className="card">
        <h1>Felicity Event Management</h1>
        <p className="muted">Login using your account.</p>

        {err && <div className="alert">{err}</div>}

        <form onSubmit={submit} className="form">
          <input
            className="input"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          <button className="btn" disabled={loading}>
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>

        <div className="row">
          <span className="muted">No account?</span>
          <Link to="/register">Create participant account</Link>
        </div>

        <div className="muted tiny">
          Admin login: admin@example.com / initial_password
        </div>
      </div>
    </div>
  );
}
