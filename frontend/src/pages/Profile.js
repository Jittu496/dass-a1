import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const DEFAULT_INTERESTS = ["AI", "Web", "Mobile", "Security", "Design", "ML", "Robotics", "IoT", "Blockchain", "CP"];

export default function Profile() {
  const [loading, setLoading] = useState(true);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [participantType, setParticipantType] = useState("");
  const [interests, setInterests] = useState([]);
  const [organizers, setOrganizers] = useState([]);
  const [following, setFollowing] = useState([]);
  const [newInterest, setNewInterest] = useState("");
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [contactNumber, setContactNumber] = useState("");
  const [college, setCollege] = useState("");
  // Password change
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pwMsg, setPwMsg] = useState("");
  const [pwErr, setPwErr] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const [prefsRes, meRes] = await Promise.all([
        api.get('/users/me/preferences'),
        api.get('/auth/me')
      ]);

      setInterests(prefsRes.data.preferences.interests || []);
      setFollowing(prefsRes.data.preferences.followingOrganizers || []);
      setOrganizers(prefsRes.data.organizers || []);

      const me = meRes.data || {};
      setFirstName(me.firstName || '');
      setLastName(me.lastName || '');
      setEmail(me.email || '');
      setParticipantType(me.participantType || '');
      setContactNumber(me.contactNumber || '');
      setCollege(me.college || '');
    } catch (e) {
      setErr('Failed to load preferences');
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const toggleInterest = (item) => {
    if (interests.includes(item)) setInterests(interests.filter(i => i !== item));
    else setInterests([...interests, item]);
  };

  const toggleFollow = (id) => {
    if (following.includes(id)) setFollowing(following.filter(f => f !== id));
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
    } catch (e) {
      setErr(e?.response?.data?.msg || 'Save failed');
    }
  };

  const saveProfile = async () => {
    setErr(''); setMsg('');
    const digits = (contactNumber || '').replace(/[^0-9]/g, '');
    if (digits.length < 7 || digits.length > 15) return setErr('Contact number must have 7 to 15 digits');
    try {
      await api.put('/users/me', { firstName, lastName, contactNumber, college });
      setMsg('Profile saved');
    } catch (e) {
      setErr(e?.response?.data?.msg || 'Failed to save profile');
    }
  };

  const changePassword = async () => {
    setPwErr(''); setPwMsg('');
    if (!oldPassword || !newPassword || !confirmPassword) return setPwErr('All password fields are required');
    if (newPassword !== confirmPassword) return setPwErr('New passwords do not match');
    if (newPassword.length < 6) return setPwErr('New password must be at least 6 characters');
    try {
      await api.put('/auth/change-password', { oldPassword, newPassword });
      setPwMsg('Password changed! Please log in again.');
      setOldPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e) {
      setPwErr(e?.response?.data?.msg || 'Password change failed');
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Profile & Preferences</h2>
        {msg && <div className="success">{msg}</div>}
        {err && <div className="alert">{err}</div>}

        <div className="card">
          <h3>Profile</h3>
          <div className="grid2">
            <input className="input" placeholder="First name" value={firstName} onChange={e => setFirstName(e.target.value)} />
            <input className="input" placeholder="Last name" value={lastName} onChange={e => setLastName(e.target.value)} />
          </div>
          <div className="grid2">
            <input className="input" placeholder="Contact number" value={contactNumber} onChange={e => setContactNumber(e.target.value)} />
            <input className="input" placeholder="College / Organization" value={college} onChange={e => setCollege(e.target.value)} />
          </div>
          <div style={{ marginTop: 8 }} className="tiny muted">Email: {email} · Participant Type: {participantType}</div>
          <div style={{ marginTop: 8 }}>
            <button className="btn" onClick={saveProfile}>Save Profile</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
          <h3>Areas of Interest</h3>
          <div className="grid3">
            {DEFAULT_INTERESTS.map(it => (
              <label key={it} style={{ display: 'block' }}>
                <input type="checkbox" checked={interests.includes(it)} onChange={() => toggleInterest(it)} /> {it}
              </label>
            ))}
          </div>

          <form onSubmit={addInterest} style={{ marginTop: 8 }}>
            <input className="input" placeholder="Add custom interest" value={newInterest} onChange={e => setNewInterest(e.target.value)} />
            <button className="btn" style={{ marginTop: 6 }}>Add</button>
          </form>
        </div>

        <div className="card" style={{ marginTop: 12 }}>
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
                      <input type="checkbox" checked={following.includes(o._id)} onChange={() => toggleFollow(o._id)} /> Follow
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ marginTop: 12 }}>
          <button className="btn" onClick={save}>Save Preferences</button>
        </div>

        {/* Password Change Section */}
        <div className="card" style={{ marginTop: 12 }}>
          <h3>Change Password</h3>
          {pwMsg && <div className="success">{pwMsg}</div>}
          {pwErr && <div className="alert">{pwErr}</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <input className="input" type="password" placeholder="Current password" value={oldPassword} onChange={(e) => setOldPassword(e.target.value)} />
            <input className="input" type="password" placeholder="New password (min 6 chars)" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            <input className="input" type="password" placeholder="Confirm new password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="btn" onClick={changePassword}>Update Password</button>
          </div>
        </div>
      </div>
    </>
  );
}

