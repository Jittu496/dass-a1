import { useEffect, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

export default function OrganizerProfile() {
    const [loading, setLoading] = useState(true);
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [email, setEmail] = useState("");
    const [category, setCategory] = useState("Club");
    const [description, setDescription] = useState("");
    const [contactNumber, setContactNumber] = useState("");
    const [discordWebhook, setDiscordWebhook] = useState("");
    const [msg, setMsg] = useState("");
    const [err, setErr] = useState("");

    useEffect(() => {
        (async () => {
            try {
                const res = await api.get("/auth/me");
                const me = res.data || {};
                setFirstName(me.firstName || "");
                setLastName(me.lastName || "");
                setEmail(me.email || "");
                setCategory(me.category || "Club");
                setDescription(me.description || "");
                setContactNumber(me.contactNumber || "");
                setDiscordWebhook(me.discordWebhook || "");
            } catch (e) {
                setErr("Failed to load profile");
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const save = async () => {
        setErr(""); setMsg("");
        try {
            await api.put("/users/me/organizer-profile", {
                firstName, lastName, category, description, contactNumber, discordWebhook,
            });
            setMsg("Profile saved successfully!");
        } catch (e) {
            setErr(e?.response?.data?.msg || "Save failed");
        }
    };

    if (loading) return <><Navbar /><div className="container">Loading…</div></>;

    return (
        <>
            <Navbar />
            <div className="container">
                <h2>Organizer Profile</h2>
                {msg && <div className="success">{msg}</div>}
                {err && <div className="alert">{err}</div>}

                <div className="card wide">
                    <h3>Basic Info</h3>
                    <div className="grid2">
                        <div>
                            <label className="tiny muted">First Name</label>
                            <input className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" />
                        </div>
                        <div>
                            <label className="tiny muted">Last Name</label>
                            <input className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" />
                        </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <label className="tiny muted">Category</label>
                        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
                            <option value="Club">Club</option>
                            <option value="Council">Council</option>
                            <option value="Fest Team">Fest Team</option>
                        </select>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <label className="tiny muted">Description</label>
                        <textarea
                            className="input"
                            rows={3}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Short description about your club/organizer"
                        />
                    </div>

                    <div className="grid2" style={{ marginTop: 10 }}>
                        <div>
                            <label className="tiny muted">Contact Number</label>
                            <input className="input" value={contactNumber} onChange={(e) => setContactNumber(e.target.value)} placeholder="Contact Number" />
                        </div>
                        <div>
                            <label className="tiny muted">Login Email (non-editable)</label>
                            <input className="input" value={email} disabled style={{ opacity: 0.6 }} />
                        </div>
                    </div>

                    <div style={{ marginTop: 10 }}>
                        <label className="tiny muted">Discord Webhook URL (auto-post new events)</label>
                        <input
                            className="input"
                            value={discordWebhook}
                            onChange={(e) => setDiscordWebhook(e.target.value)}
                            placeholder="https://discord.com/api/webhooks/..."
                        />
                    </div>

                    <div style={{ marginTop: 16 }}>
                        <button className="btn" onClick={save}>Save Profile</button>
                    </div>
                </div>
            </div>
        </>
    );
}
