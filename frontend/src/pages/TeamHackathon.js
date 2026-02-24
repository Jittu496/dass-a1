import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import { api } from "../api/client";

const FRONTEND_URL = window.location.origin;

export default function TeamHackathon() {
  const [myTeams, setMyTeams] = useState([]);
  const [pendingInvites, setPendingInvites] = useState([]);
  const [hackathons, setHackathons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  // Create team form
  const [tab, setTab] = useState("create"); // "create" | "join"
  const [teamName, setTeamName] = useState("");
  const [maxSize, setMaxSize] = useState(3);
  const [selectedEvent, setSelectedEvent] = useState("");

  // Join form
  const [joinCode, setJoinCode] = useState("");

  // Invite member form (per-team)
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteUserId, setInviteUserId] = useState("");
  const [userSearch, setUserSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);

  // Copied state
  const [copied, setCopied] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [teamsRes, invitesRes, eventsRes] = await Promise.all([
        api.get("/teams/mine"),
        api.get("/teams/invites/pending"),
        api.get("/events", { params: { type: "hackathon" } }),
      ]);
      setMyTeams(teamsRes.data || []);
      setPendingInvites(invitesRes.data || []);
      const teamEvents = (eventsRes.data || []).filter(
        (e) => e.participationMode === "team"
      );
      setHackathons(teamEvents);
      if (!selectedEvent && teamEvents.length > 0)
        setSelectedEvent(teamEvents[0]._id);
    } catch (e) {
      setErr(e?.response?.data?.msg || "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, [selectedEvent]);

  useEffect(() => { load(); }, [load]);

  const flash = (ok, txt) => {
    if (ok) { setMsg(txt); setErr(""); }
    else { setErr(txt); setMsg(""); }
    setTimeout(() => { setMsg(""); setErr(""); }, 4000);
  };

  // ── Create Team ──────────────────────────────────────────────────────────
  const createTeam = async () => {
    if (!selectedEvent) return flash(false, "Select a hackathon event first");
    if (!teamName.trim()) return flash(false, "Team name is required");
    try {
      await api.post(`/teams/create/${selectedEvent}`, {
        teamName: teamName.trim(),
        maxSize: Number(maxSize),
      });
      setTeamName(""); setMaxSize(3);
      flash(true, "Team created! Now invite your members.");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to create team");
    }
  };

  // ── Join via Code ────────────────────────────────────────────────────────
  const joinTeam = async () => {
    if (!joinCode.trim()) return flash(false, "Enter an invite code");
    try {
      await api.post("/teams/join", { inviteCode: joinCode.trim() });
      setJoinCode("");
      flash(true, "Joined team!");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to join team");
    }
  };

  // ── Search users to invite ────────────────────────────────────────────────
  const searchUsers = async (q) => {
    setUserSearch(q);
    if (q.length < 2) { setSearchResults([]); return; }
    setSearching(true);
    try {
      const res = await api.get("/users/search", { params: { q } });
      setSearchResults(res.data || []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  // ── Send Invite ──────────────────────────────────────────────────────────
  const sendInvite = async (teamId, userId) => {
    try {
      await api.post(`/teams/${teamId}/invite`, { userId });
      flash(true, "Invite sent!");
      setUserSearch(""); setSearchResults([]); setInviteUserId("");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to send invite");
    }
  };

  // ── Remove Member (Leader) ───────────────────────────────────────────────
  const removeMember = async (teamId, userId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await api.delete(`/teams/${teamId}/members/${userId}`);
      flash(true, "Member removed");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to remove member");
    }
  };

  // ── Leave Team (Member) ──────────────────────────────────────────────────
  const leaveTeam = async (teamId) => {
    if (!window.confirm("Leave this team?")) return;
    try {
      await api.delete(`/teams/${teamId}/leave`);
      flash(true, "Left team");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to leave team");
    }
  };

  // ── Finalize Team ────────────────────────────────────────────────────────
  const finalizeTeam = async (teamId) => {
    if (!window.confirm("Finalize team? Tickets will be generated for all members.")) return;
    try {
      const res = await api.post(`/teams/${teamId}/finalize`);
      flash(true, res.data.msg || "Team finalized! Tickets generated.");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to finalize");
    }
  };

  // ── Copy to clipboard ─────────────────────────────────────────────────────
  const copyText = (text, label) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(""), 2000);
  };

  // ── Respond to invite ─────────────────────────────────────────────────────
  const respondInvite = async (teamId, accept) => {
    try {
      await api.post("/teams/invite/respond", { teamId, accept });
      flash(true, accept ? "Joined team!" : "Invite declined");
      load();
    } catch (e) {
      flash(false, e?.response?.data?.msg || "Failed to respond");
    }
  };

  const isLeader = (team) => {
    const me = localStorage.getItem("userId") || "";
    return String(team.leader?._id || team.leader) === me;
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="container"><p className="muted">Loading your teams…</p></div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="container">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <h2 style={{ margin: 0 }}>🏆 Team Hackathon Registration</h2>
          {pendingInvites.length > 0 && (
            <Link to="/team/invites" className="btn" style={{ fontSize: 13 }}>
              📬 Pending Invites&nbsp;
              <span style={{
                background: "#ff4444", color: "#fff", borderRadius: "50%",
                padding: "2px 7px", fontSize: 11, marginLeft: 4
              }}>{pendingInvites.length}</span>
            </Link>
          )}
        </div>
        <p className="muted" style={{ marginBottom: 24 }}>
          Create a team, invite members, and finalize to generate tickets for all members.
        </p>

        {msg && <div className="success" style={{ marginBottom: 12 }}>{msg}</div>}
        {err && <div className="alert" style={{ marginBottom: 12 }}>{err}</div>}

        {/* ── Pending invites banner ──────────────────────────────────────── */}
        {pendingInvites.length > 0 && (
          <div style={{
            background: "linear-gradient(135deg,#667eea20,#764ba220)",
            border: "1px solid #667eea40", borderRadius: 12,
            padding: "16px 20px", marginBottom: 24
          }}>
            <div style={{ fontWeight: 700, marginBottom: 8, color: "#5a52d5" }}>
              📬 You have {pendingInvites.length} pending team invite(s)
            </div>
            {pendingInvites.slice(0, 2).map((inv) => (
              <div key={inv._id} style={{
                display: "flex", alignItems: "center", gap: 12, marginBottom: 8,
                background: "#fff", borderRadius: 8, padding: "10px 14px"
              }}>
                <div style={{ flex: 1 }}>
                  <b>{inv.teamName}</b>
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                    {inv.event?.name} · Leader: {inv.leader?.firstName} {inv.leader?.lastName}
                  </span>
                  <span className="muted" style={{ fontSize: 12, marginLeft: 8 }}>
                    {inv.memberCount}/{inv.maxSize} members
                  </span>
                </div>
                <button className="btn" style={{ fontSize: 12, padding: "4px 12px" }}
                  onClick={() => respondInvite(inv.teamId, true)}>Accept</button>
                <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 12px" }}
                  onClick={() => respondInvite(inv.teamId, false)}>Decline</button>
              </div>
            ))}
            {pendingInvites.length > 2 && (
              <Link to="/team/invites" style={{ fontSize: 13, color: "#5a52d5" }}>
                +{pendingInvites.length - 2} more → View all invites
              </Link>
            )}
          </div>
        )}

        {/* ── My Teams ───────────────────────────────────────────────────── */}
        {myTeams.length > 0 && (
          <div style={{ marginBottom: 32 }}>
            <h3 style={{ marginBottom: 16 }}>My Teams</h3>
            {myTeams.map((team) => {
              const amLeader = isLeader(team);
              const filled = team.members.length;
              const pct = Math.round((filled / team.maxSize) * 100);
              const inviteLink = `${FRONTEND_URL}/team/join/${team.inviteToken}`;

              return (
                <div key={team._id} style={{
                  background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                  padding: 24, marginBottom: 20, boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
                }}>
                  {/* Header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 16 }}>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <h3 style={{ margin: 0 }}>{team.teamName}</h3>
                        <span className="pill" style={{
                          background: team.status === "finalized" ? "#10b981" : "#f59e0b",
                          color: "#fff", fontSize: 11, padding: "2px 10px"
                        }}>
                          {team.status === "finalized" ? "✓ Finalized" : "Forming"}
                        </span>
                        {amLeader && (
                          <span style={{
                            background: "#667eea", color: "#fff", fontSize: 11,
                            borderRadius: 20, padding: "2px 8px"
                          }}>Leader</span>
                        )}
                      </div>
                      <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>
                        🎯 {team.event?.name} · {team.event?.type}
                      </div>
                    </div>
                    {!amLeader && team.status !== "finalized" && (
                      <button className="btn btn-outline"
                        style={{ fontSize: 12, color: "#ef4444", borderColor: "#ef4444" }}
                        onClick={() => leaveTeam(team._id)}>Leave Team</button>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                      <span className="muted">Members</span>
                      <span style={{ fontWeight: 600 }}>{filled} / {team.maxSize}</span>
                    </div>
                    <div style={{ background: "#f3f4f6", borderRadius: 99, height: 8 }}>
                      <div style={{
                        height: 8, borderRadius: 99, width: `${pct}%`,
                        background: pct === 100 ? "#10b981" : "linear-gradient(90deg,#667eea,#764ba2)",
                        transition: "width 0.4s"
                      }} />
                    </div>
                    {filled === team.maxSize && team.status !== "finalized" && (
                      <div style={{ fontSize: 12, color: "#10b981", marginTop: 4 }}>
                        ✓ Team is full — ready to finalize!
                      </div>
                    )}
                  </div>

                  {/* Members list */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>Members</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {team.members.map((m) => {
                        const mId = m._id || m;
                        const mName = m.firstName ? `${m.firstName} ${m.lastName}` : String(mId).slice(-6);
                        const mIsLeader = String(mId) === String(team.leader?._id || team.leader);
                        return (
                          <div key={mId} style={{
                            display: "flex", alignItems: "center", gap: 6,
                            background: "#f9fafb", border: "1px solid #e5e7eb",
                            borderRadius: 99, padding: "4px 12px", fontSize: 13
                          }}>
                            <span style={{
                              width: 24, height: 24, borderRadius: "50%",
                              background: mIsLeader ? "#667eea" : "#d1d5db",
                              color: mIsLeader ? "#fff" : "#374151",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontSize: 11, fontWeight: 700
                            }}>
                              {mName.charAt(0).toUpperCase()}
                            </span>
                            {mName}
                            {mIsLeader && (
                              <span style={{ fontSize: 10, color: "#667eea" }}>★</span>
                            )}
                            {amLeader && !mIsLeader && team.status !== "finalized" && (
                              <button onClick={() => removeMember(team._id, mId)}
                                style={{
                                  border: "none", background: "none", cursor: "pointer",
                                  color: "#ef4444", padding: "0 2px", fontSize: 14, lineHeight: 1
                                }} title="Remove member">×</button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pending invites list */}
                  {team.pendingInvites.filter((i) => i.status === "pending").length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8, color: "#f59e0b" }}>
                        ⏳ Pending Invites ({team.pendingInvites.filter((i) => i.status === "pending").length})
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                        {team.pendingInvites
                          .filter((i) => i.status === "pending")
                          .map((inv) => {
                            const u = inv.user;
                            const name = u?.firstName ? `${u.firstName} ${u.lastName}` : String(u?._id || u).slice(-6);
                            return (
                              <div key={inv._id} style={{
                                display: "flex", alignItems: "center", gap: 6,
                                background: "#fef3c7", border: "1px solid #fcd34d",
                                borderRadius: 99, padding: "4px 12px", fontSize: 13
                              }}>
                                <span style={{ color: "#92400e" }}>✉ {name}</span>
                                <span className="muted" style={{ fontSize: 11 }}>pending</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}

                  {/* Declined invites */}
                  {team.pendingInvites.filter((i) => i.status === "declined").length > 0 && (
                    <div style={{ marginBottom: 16, fontSize: 12, color: "#6b7280" }}>
                      {team.pendingInvites.filter((i) => i.status === "declined").length} invite(s) declined
                    </div>
                  )}

                  {/* Leader actions */}
                  {amLeader && team.status !== "finalized" && (
                    <div style={{ borderTop: "1px solid #f3f4f6", paddingTop: 16 }}>

                      {/* Invite by user search */}
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 8 }}>
                          Invite Members
                        </div>
                        <div style={{ position: "relative", maxWidth: 380 }}>
                          <input
                            className="input"
                            placeholder="Search by name or email…"
                            value={userSearch}
                            onChange={(e) => searchUsers(e.target.value)}
                            style={{ width: "100%", boxSizing: "border-box" }}
                          />
                          {searching && (
                            <div style={{ position: "absolute", right: 12, top: 11, fontSize: 12, color: "#9ca3af" }}>
                              searching…
                            </div>
                          )}
                          {searchResults.length > 0 && (
                            <div style={{
                              position: "absolute", top: "100%", left: 0, right: 0,
                              background: "#fff", border: "1px solid #e5e7eb",
                              borderRadius: 8, boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
                              zIndex: 100, maxHeight: 200, overflowY: "auto"
                            }}>
                              {searchResults.map((u) => (
                                <div key={u._id}
                                  onClick={() => {
                                    sendInvite(team._id, u._id);
                                    setSearchResults([]);
                                    setUserSearch("");
                                  }}
                                  style={{
                                    padding: "10px 14px", cursor: "pointer",
                                    borderBottom: "1px solid #f3f4f6", fontSize: 13,
                                    display: "flex", justifyContent: "space-between"
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
                                  onMouseLeave={(e) => e.currentTarget.style.background = "#fff"}
                                >
                                  <span>{u.firstName} {u.lastName}</span>
                                  <span className="muted">{u.email}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Invite code & link */}
                      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                        <div style={{
                          background: "#f9fafb", border: "1px solid #e5e7eb",
                          borderRadius: 8, padding: "10px 16px", display: "flex",
                          alignItems: "center", gap: 12, flex: "1 1 200px"
                        }}>
                          <div>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>INVITE CODE</div>
                            <div style={{ fontFamily: "monospace", fontWeight: 700, fontSize: 16, letterSpacing: 2 }}>
                              {team.inviteCode}
                            </div>
                          </div>
                          <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 10px" }}
                            onClick={() => copyText(team.inviteCode, `code-${team._id}`)}>
                            {copied === `code-${team._id}` ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>

                        <div style={{
                          background: "#f9fafb", border: "1px solid #e5e7eb",
                          borderRadius: 8, padding: "10px 16px", display: "flex",
                          alignItems: "center", gap: 12, flex: "1 1 200px"
                        }}>
                          <div style={{ flex: 1, overflow: "hidden" }}>
                            <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 2 }}>INVITE LINK</div>
                            <div style={{ fontSize: 12, color: "#667eea", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {inviteLink}
                            </div>
                          </div>
                          <button className="btn btn-outline" style={{ fontSize: 12, padding: "4px 10px", flexShrink: 0 }}
                            onClick={() => copyText(inviteLink, `link-${team._id}`)}>
                            {copied === `link-${team._id}` ? "✓ Copied!" : "Copy"}
                          </button>
                        </div>
                      </div>

                      {/* Finalize button */}
                      <button
                        className="btn"
                        disabled={team.members.length < 2}
                        onClick={() => finalizeTeam(team._id)}
                        style={{
                          background: filled >= team.maxSize
                            ? "linear-gradient(135deg,#10b981,#059669)"
                            : "linear-gradient(135deg,#667eea,#764ba2)"
                        }}
                      >
                        {filled >= team.maxSize ? "✓ Finalize Team & Generate Tickets" : `Finalize Early (${filled}/${team.maxSize} members)`}
                      </button>
                    </div>
                  )}

                  {/* Finalized state */}
                  {team.status === "finalized" && (
                    <div style={{
                      background: "#d1fae5", border: "1px solid #6ee7b7",
                      borderRadius: 10, padding: "12px 16px", marginTop: 8,
                      display: "flex", alignItems: "center", gap: 10
                    }}>
                      <span style={{ fontSize: 20 }}>🎫</span>
                      <div>
                        <div style={{ fontWeight: 700, color: "#065f46" }}>Team Finalized!</div>
                        <div style={{ fontSize: 13, color: "#047857" }}>
                          Tickets have been generated for all {team.members.length} members.
                          <Link to="/my-tickets" style={{ color: "#059669", marginLeft: 8, fontWeight: 600 }}>
                            View Your Ticket →
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Create / Join (when not in any team for an event, or new) ───── */}
        {hackathons.length === 0 && myTeams.length === 0 ? (
          <div className="card wide" style={{ textAlign: "center", padding: 40 }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏗️</div>
            <h3>No Team Hackathon Events Available</h3>
            <p className="muted">There are no published hackathon events with team mode right now.</p>
            <Link to="/events" className="btn" style={{ marginTop: 8 }}>Browse Events</Link>
          </div>
        ) : (
          <div>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, borderBottom: "2px solid #f3f4f6", paddingBottom: 8 }}>
              <button className={tab === "create" ? "btn" : "btn btn-outline"}
                style={{ borderRadius: 20, fontSize: 13 }}
                onClick={() => setTab("create")}>
                ➕ Create Team
              </button>
              <button className={tab === "join" ? "btn" : "btn btn-outline"}
                style={{ borderRadius: 20, fontSize: 13 }}
                onClick={() => setTab("join")}>
                🔗 Join via Code
              </button>
            </div>

            {tab === "create" && (
              <div style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: 28, maxWidth: 520, boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
              }}>
                <h3 style={{ marginTop: 0 }}>Create a New Team</h3>
                <div style={{ marginBottom: 14 }}>
                  <label className="muted" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
                    Hackathon Event
                  </label>
                  <select className="input" value={selectedEvent}
                    onChange={(e) => setSelectedEvent(e.target.value)}>
                    {hackathons.map((h) => (
                      <option key={h._id} value={h._id}>{h.name}</option>
                    ))}
                  </select>
                </div>
                <div style={{ marginBottom: 14 }}>
                  <label className="muted" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
                    Team Name
                  </label>
                  <input className="input" placeholder="e.g. Team Rocket"
                    value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="muted" style={{ fontSize: 13, display: "block", marginBottom: 6 }}>
                    Max Team Size (2–20)
                  </label>
                  <input className="input" type="number" min={2} max={20}
                    value={maxSize} onChange={(e) => setMaxSize(e.target.value)} />
                </div>
                <button className="btn" onClick={createTeam} style={{ width: "100%" }}>
                  Create Team
                </button>
              </div>
            )}

            {tab === "join" && (
              <div style={{
                background: "#fff", borderRadius: 16, border: "1px solid #e5e7eb",
                padding: 28, maxWidth: 420, boxShadow: "0 2px 8px rgba(0,0,0,0.06)"
              }}>
                <h3 style={{ marginTop: 0 }}>Join a Team</h3>
                <p className="muted" style={{ fontSize: 13, marginBottom: 16 }}>
                  Enter the invite code shared by your team leader. Or check your
                  <Link to="/team/invites" style={{ color: "#667eea", marginLeft: 4 }}>
                    pending invites
                  </Link>.
                </p>
                <div style={{ marginBottom: 16 }}>
                  <input className="input" placeholder="TEAM-XXXXXX"
                    value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    style={{ letterSpacing: 2, fontFamily: "monospace" }} />
                </div>
                <button className="btn btn-outline" onClick={joinTeam} style={{ width: "100%" }}>
                  Join Team
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
