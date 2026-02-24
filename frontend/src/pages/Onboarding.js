import { useEffect, useState } from "react";
import { api } from "../api/client";
import { useNavigate } from "react-router-dom";

const DEFAULT_INTERESTS = ["AI", "Web", "Mobile", "Security", "Design", "ML", "Robotics", "IoT", "Blockchain", "CP"];

export default function Onboarding() {
  const [loading, setLoading] = useState(true);
  const [interests, setInterests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [newInterest, setNewInterest] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/me/preferences');
      setInterests(res.data.preferences.interests || []);
      setFollowing(res.data.preferences.followingOrganizers || []);
      setOrganizers(res.data.organizers || []);
    } catch (e) {
      setErr('Failed to load preferences');
    } finally { setLoading(false); }
  };

  useEffect(()=>{ load(); }, []);

  const toggleInterest = (item) => {
    if (interests.includes(item)) setInterests(interests.filter(i=>i!==item));
    else setInterests([...interests, item]);
  };

  const toggleFollow = (id) => {
    if (following.includes(id)) setFollowing(following.filter(f=>f!==id));
    else setFollowing([...following, id]);
  };

  const addInterest = (e) => {
    e.preventDefault();
    const v = (newInterest || '').trim();
    if (!v) return;
    if (!interests.includes(v)) setInterests([...interests, v]);
    setNewInterest('');
  };

  const save = async () => {
    setErr(''); setMsg('');
    try {
      await api.put('/users/me/preferences', { interests, followingOrganizers: following });
      setMsg('Preferences saved');
      setTimeout(()=> navigate('/dashboard'), 800);
    } catch (e) {
      setErr(e?.response?.data?.msg || 'Save failed');
    }
  };

  return (
    <div className="center">
      <div className="card" style={{ maxWidth: 720 }}>
        <h2>Welcome — choose preferences (optional)</h2>
        {msg && <div className="success">{msg}</div>}
        {err && <div className="alert">{err}</div>}

        <div style={{ marginTop: 8 }}>
          <h3>Areas of Interest</h3>
          <div className="grid3">
            {DEFAULT_INTERESTS.map(it => (
              <label key={it} style={{ display: 'block' }}>
                <input type="checkbox" checked={interests.includes(it)} onChange={()=>toggleInterest(it)} /> {it}
              </label>
            ))}
          </div>

          <form onSubmit={addInterest} style={{ marginTop: 8 }}>
            <input className="input" placeholder="Add custom interest" value={newInterest} onChange={e=>setNewInterest(e.target.value)} />
            <button className="btn" style={{ marginTop: 6 }}>Add</button>
          </form>
        </div>

        <div style={{ marginTop: 12 }}>
          <h3>Follow Clubs / Organizers</h3>
          {loading ? <div className="muted">Loading organizers…</div> : (
            <div>
              {organizers.map(o => (
                <div key={o._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: 6 }}>
                  <div>
                    <strong>{o.firstName} {o.lastName}</strong>
                    <div className="tiny muted">{o.email} {o.category ? `· ${o.category}` : ''}</div>
                    {o.description && <div className="muted tiny">{o.description}</div>}
                  </div>
                  <div>
                    <label>
                      <input type="checkbox" checked={following.includes(o._id)} onChange={()=>toggleFollow(o._id)} /> Follow
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
          <button className="btn" onClick={save}>Save & Continue</button>
          <button className="btn btn-ghost" onClick={() => navigate('/dashboard')}>Skip</button>
        </div>
      </div>
    </div>
  );
}
