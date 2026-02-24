import { useEffect, useRef, useState } from "react";
import Navbar from "../components/Navbar";
import { api } from "../api/client";
import { io } from "socket.io-client";

export default function Forum() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");
  const [err, setErr] = useState("");
  const timerRef = useRef(null);

  const loadEvents = async () => {
    const res = await api.get("/events");
    setEvents(res.data);
    if (!eventId && res.data?.[0]?._id) setEventId(res.data[0]._id);
  };

  const loadPosts = async (id) => {
    if (!id) return;
    try {
      const res = await api.get(`/forum/${id}`);
      setPosts(res.data);
    } catch {
      // ignore to keep polling stable
    }
  };

  // Socket.IO connection (real-time)
  useEffect(() => {
    const socket = io(process.env.REACT_APP_API_BASE || "/", { transports: ["websocket", "polling"] });
    let currentRoom = null;

    socket.on("connect", () => {
      console.log("forum socket connected", socket.id);
    });

    socket.on("newPost", (post) => {
      // If the post belongs to currently selected event, append it
      if (String(post.event) === String(eventId)) {
        setPosts((p) => [...p, post]);
      }
    });

    // when eventId changes join/leave room
    const joinRoom = (id) => {
      if (!id) return;
      if (currentRoom) socket.emit("leave", currentRoom);
      socket.emit("join", id);
      currentRoom = id;
    };

    if (eventId) joinRoom(eventId);

    return () => {
      if (currentRoom) socket.emit("leave", currentRoom);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  useEffect(() => {
    (async () => {
      setErr("");
      try {
        await loadEvents();
      } catch {
        setErr("Failed to load events");
      }
    })();
    return () => clearInterval(timerRef.current);
  }, []);

  useEffect(() => {
    clearInterval(timerRef.current);
    if (!eventId) return;
    loadPosts(eventId);
    timerRef.current = setInterval(() => loadPosts(eventId), 2500);
    return () => clearInterval(timerRef.current);
  }, [eventId]);

  const send = async () => {
    if (!eventId || !message.trim()) return;
    try {
      await api.post(`/forum/${eventId}`, { message });
      setMessage("");
      loadPosts(eventId);
    } catch (e) {
      alert(e?.response?.data?.msg || "Send failed");
    }
  };

  return (
    <>
      <Navbar />
      <div className="container">
        <h2>Discussion Forum</h2>
        <p className="muted">Tier B Feature: polling-based “real-time” forum (no sockets).</p>

        {err && <div className="alert">{err}</div>}

        <div className="card wide">
          <div className="grid2">
            <select className="input" value={eventId} onChange={(e)=>setEventId(e.target.value)}>
              {events.map(e => <option key={e._id} value={e._id}>{e.name}</option>)}
            </select>
            <button className="btn btn-outline" onClick={() => loadPosts(eventId)}>Refresh</button>
          </div>

          <div style={{ marginTop: 12, maxHeight: 420, overflowY: "auto" }}>
            {posts.map((p) => (
              <div key={p._id} className="tile" style={{ boxShadow: "none", border: "1px solid #eee" }}>
                <div className="tiny muted">
                  <b>{p.author?.firstName} {p.author?.lastName}</b> ({p.author?.role}) •{" "}
                  {new Date(p.createdAt).toLocaleString()}
                </div>
                <div style={{ marginTop: 6 }}>{p.message}</div>
              </div>
            ))}
          </div>

          <div className="grid2" style={{ marginTop: 12 }}>
            <input className="input" placeholder="Type message..." value={message} onChange={(e)=>setMessage(e.target.value)} />
            <button className="btn" onClick={send}>Send</button>
          </div>
        </div>
      </div>
    </>
  );
}
