import { useEffect, useRef, useState, useCallback } from "react";
import { io } from "socket.io-client";
import { api } from "../api/client";

const SOCKET_URL = process.env.REACT_APP_API_URL?.replace("/api", "") || "http://localhost:5000";
const EMOJIS = ["👍", "❤️", "😂", "🙌"];

// ─── tiny helpers ────────────────────────────────────────────────
function timeAgo(date) {
    const diff = (Date.now() - new Date(date)) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return new Date(date).toLocaleDateString();
}

function Avatar({ name, role }) {
    const initials = (name || "?")[0].toUpperCase();
    const bg = role === "organizer" ? "#c9a227" : "#667eea";
    return (
        <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: bg, color: "#fff", fontWeight: 800, fontSize: 14,
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
        }}>{initials}</div>
    );
}

// ─── single post card ─────────────────────────────────────────────
function PostCard({ post, isOrganizer, currentUserId, onReply, onDelete, onPin, onReact, depth = 0 }) {
    const fullName = `${post.author?.firstName || ""} ${post.author?.lastName || ""}`.trim() || "User";
    const isAnnouncement = post.type === "announcement";
    const isPinned = post.pinned;
    const authorRole = post.author?.role;

    return (
        <div style={{
            marginLeft: depth > 0 ? 38 : 0,
            marginTop: 2,
            borderLeft: depth > 0 ? "2px solid rgba(201,162,39,0.25)" : "none",
            paddingLeft: depth > 0 ? 12 : 0,
        }}>
            <div style={{
                background: isAnnouncement
                    ? "linear-gradient(90deg,rgba(201,162,39,0.08),rgba(232,208,122,0.05))"
                    : "#fff",
                border: isAnnouncement
                    ? "1px solid rgba(201,162,39,0.30)"
                    : isPinned ? "1px solid rgba(201,162,39,0.20)" : "1px solid rgba(18,18,18,0.07)",
                borderRadius: 14,
                padding: "12px 14px",
                marginBottom: 6,
                position: "relative",
            }}>

                {/* Pinned ribbon */}
                {isPinned && (
                    <div style={{
                        position: "absolute", top: 0, right: 0,
                        background: "linear-gradient(135deg,#e8d07a,#c9a227)",
                        color: "#3b2700", fontSize: 10, fontWeight: 800,
                        padding: "2px 10px", borderRadius: "0 14px 0 10px",
                    }}>📌 PINNED</div>
                )}

                {/* Announcement label */}
                {isAnnouncement && (
                    <div style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        background: "rgba(201,162,39,0.15)", border: "1px solid rgba(201,162,39,0.30)",
                        borderRadius: 20, padding: "2px 10px", fontSize: 11, fontWeight: 800,
                        color: "#6b5400", marginBottom: 8,
                    }}>📢 Announcement</div>
                )}

                {/* Author row */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                    <Avatar name={fullName} role={authorRole} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{fullName}</span>
                            {authorRole === "organizer" && (
                                <span style={{
                                    background: "rgba(201,162,39,0.15)", color: "#6b5400",
                                    borderRadius: 20, padding: "1px 8px", fontSize: 10, fontWeight: 800,
                                }}>Organizer</span>
                            )}
                            <span className="muted" style={{ fontSize: 11 }}>{timeAgo(post.createdAt)}</span>
                        </div>
                        <div style={{ fontSize: 14, marginTop: 5, lineHeight: 1.5, wordBreak: "break-word" }}>
                            {post.message}
                        </div>

                        {/* Reactions */}
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                            {EMOJIS.map((emoji) => {
                                const users = post.reactions?.[emoji] || [];
                                const reacted = users.includes(String(currentUserId));
                                return (
                                    <button key={emoji} onClick={() => onReact(post._id, emoji)}
                                        style={{
                                            border: reacted ? "1.5px solid rgba(201,162,39,0.50)" : "1px solid rgba(18,18,18,0.10)",
                                            background: reacted ? "rgba(201,162,39,0.12)" : "rgba(18,18,18,0.02)",
                                            borderRadius: 20, padding: "3px 10px", cursor: "pointer",
                                            fontSize: 13, display: "flex", alignItems: "center", gap: 4, fontFamily: "inherit",
                                            transition: "all 0.12s",
                                        }}>
                                        <span>{emoji}</span>
                                        {users.length > 0 && (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: reacted ? "var(--gold)" : "var(--muted)" }}>
                                                {users.length}
                                            </span>
                                        )}
                                    </button>
                                );
                            })}

                            {/* Actions */}
                            <div style={{ marginLeft: "auto", display: "flex", gap: 6 }}>
                                <button onClick={() => onReply(post)}
                                    style={{
                                        border: "none", background: "transparent", cursor: "pointer",
                                        fontSize: 11, fontWeight: 700, color: "var(--muted)", padding: "3px 6px",
                                        fontFamily: "inherit",
                                    }}>↩ Reply</button>
                                {isOrganizer && (
                                    <>
                                        <button onClick={() => onPin(post._id)}
                                            style={{
                                                border: "none", background: "transparent", cursor: "pointer",
                                                fontSize: 11, fontWeight: 700,
                                                color: isPinned ? "var(--gold)" : "var(--muted)",
                                                padding: "3px 6px", fontFamily: "inherit",
                                            }}>{isPinned ? "📌 Unpin" : "📌 Pin"}</button>
                                        <button onClick={() => onDelete(post._id)}
                                            style={{
                                                border: "none", background: "transparent", cursor: "pointer",
                                                fontSize: 11, fontWeight: 700, color: "#ef4444",
                                                padding: "3px 6px", fontFamily: "inherit",
                                            }}>🗑 Delete</button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── main forum component ─────────────────────────────────────────
export default function EventForum({ eventId, eventOrganizerId }) {
    const [posts, setPosts] = useState([]);
    const [input, setInput] = useState("");
    const [replyingTo, setReplyingTo] = useState(null);   // post object
    const [isAnnounce, setIsAnnounce] = useState(false);
    const [access, setAccess] = useState(null);   // null=loading, false=denied, true=ok
    const [unread, setUnread] = useState(0);
    const [sending, setSending] = useState(false);
    const [err, setErr] = useState("");

    const bottomRef = useRef(null);
    const listRef = useRef(null);
    const socketRef = useRef(null);

    const role = localStorage.getItem("role");
    const isOrganizer = role === "organizer";
    const currentUserId = localStorage.getItem("userId") || "";

    // ── load posts ──────────────────────────────────────────────────
    const loadPosts = useCallback(async () => {
        try {
            const res = await api.get(`/forum/${eventId}`);
            setPosts(res.data);
            setAccess(true);
        } catch (e) {
            if (e?.response?.status === 403) setAccess(false);
            else setErr("Failed to load forum");
        }
    }, [eventId]);

    // ── socket setup ────────────────────────────────────────────────
    useEffect(() => {
        const socket = io(SOCKET_URL, { transports: ["websocket", "polling"] });
        socketRef.current = socket;

        socket.on("connect", () => socket.emit("join", eventId));

        socket.on("newPost", (post) => {
            setPosts((prev) => {
                // avoid duplicates
                if (prev.some((p) => p._id === post._id)) return prev;
                return [...prev, post];
            });
            // notification badge if not scrolled to bottom
            const el = listRef.current;
            if (el && el.scrollHeight - el.scrollTop - el.clientHeight > 80) {
                setUnread((u) => u + 1);
            } else {
                setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
            }
        });

        socket.on("deletedPost", ({ postId }) => {
            setPosts((prev) => prev.filter((p) => p._id !== postId));
        });

        socket.on("pinnedPost", ({ postId, pinned }) => {
            setPosts((prev) => prev.map((p) =>
                p._id === postId ? { ...p, pinned } : p
            ).sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || new Date(a.createdAt) - new Date(b.createdAt)));
        });

        socket.on("reactedPost", ({ postId, reactions }) => {
            setPosts((prev) => prev.map((p) =>
                p._id === postId ? { ...p, reactions } : p
            ));
        });

        return () => {
            socket.emit("leave", eventId);
            socket.disconnect();
        };
    }, [eventId]);

    // ── initial load, then poll every 10s as fallback ───────────────
    useEffect(() => {
        if (access === null) loadPosts();
        if (access !== true) return;
        const t = setInterval(loadPosts, 10000);
        return () => clearInterval(t);
    }, [access, loadPosts]);

    useEffect(() => { if (access === null) loadPosts(); }, [access, loadPosts]);

    // ── scroll to bottom & clear unread on manual scroll ────────────
    useEffect(() => {
        if (posts.length > 0)
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, []);

    const handleScroll = () => {
        const el = listRef.current;
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 40) {
            setUnread(0);
        }
    };

    // ── send message ────────────────────────────────────────────────
    const send = async () => {
        if (!input.trim() || sending) return;
        setSending(true); setErr("");
        try {
            await api.post(`/forum/${eventId}`, {
                message: input.trim(),
                type: isAnnounce ? "announcement" : "message",
                parentId: replyingTo?._id || undefined,
            });
            setInput("");
            setReplyingTo(null);
            setIsAnnounce(false);
        } catch (e) {
            setErr(e?.response?.data?.msg || "Send failed");
        } finally {
            setSending(false);
        }
    };

    const handleDelete = async (postId) => {
        try { await api.delete(`/forum/${eventId}/${postId}`); }
        catch (e) { setErr(e?.response?.data?.msg || "Delete failed"); }
    };

    const handlePin = async (postId) => {
        try { await api.patch(`/forum/${eventId}/${postId}/pin`); }
        catch (e) { setErr(e?.response?.data?.msg || "Pin failed"); }
    };

    const handleReact = async (postId, emoji) => {
        try { await api.post(`/forum/${eventId}/${postId}/react`, { emoji }); }
        catch (e) { setErr(e?.response?.data?.msg || "React failed"); }
    };

    // ── build thread tree ───────────────────────────────────────────
    const rootPosts = posts.filter((p) => !p.parentId);
    const getReplies = (parentId) => posts.filter((p) => String(p.parentId) === String(parentId));

    // ── render ──────────────────────────────────────────────────────
    return (
        <div style={{ marginTop: 36 }}>
            {/* Section header */}
            <div style={{
                display: "flex", alignItems: "center", gap: 12,
                marginBottom: 16, paddingBottom: 14,
                borderBottom: "2px solid rgba(18,18,18,0.07)",
            }}>
                <div style={{
                    background: "linear-gradient(135deg,var(--gold2),var(--gold))",
                    borderRadius: 10, padding: "8px 10px", fontSize: 18,
                }}>💬</div>
                <div>
                    <h3 style={{ margin: 0, fontSize: 18, letterSpacing: "-0.4px" }}>Event Discussion</h3>
                    <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
                        {access === true ? `${posts.length} message${posts.length !== 1 ? "s" : ""}` : ""}
                    </div>
                </div>
                {unread > 0 && (
                    <button onClick={() => {
                        setUnread(0);
                        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
                    }} style={{
                        marginLeft: "auto",
                        background: "linear-gradient(135deg,#667eea,#764ba2)",
                        color: "#fff", border: "none", borderRadius: 20,
                        padding: "5px 14px", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "inherit",
                    }}>
                        ↓ {unread} new message{unread !== 1 ? "s" : ""}
                    </button>
                )}
            </div>

            {/* Access denied */}
            {access === false && (
                <div style={{
                    textAlign: "center", padding: "32px 20px",
                    background: "rgba(255,255,255,0.7)",
                    border: "1.5px dashed rgba(18,18,18,0.12)",
                    borderRadius: 16,
                }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>🔒</div>
                    <div style={{ fontWeight: 700, marginBottom: 6 }}>Members Only</div>
                    <div className="muted" style={{ fontSize: 13 }}>
                        Register for this event (or get an approved merch order) to join the discussion.
                    </div>
                </div>
            )}

            {/* Loading */}
            {access === null && (
                <div className="muted" style={{ textAlign: "center", padding: "24px 0", fontSize: 13 }}>
                    Loading forum…
                </div>
            )}

            {/* Forum content */}
            {access === true && (
                <>
                    {/* Pinned posts banner */}
                    {posts.filter((p) => p.pinned).length > 0 && (
                        <div style={{
                            background: "rgba(201,162,39,0.06)",
                            border: "1px solid rgba(201,162,39,0.20)",
                            borderRadius: 14, padding: "10px 14px", marginBottom: 14,
                        }}>
                            <div style={{ fontSize: 11, fontWeight: 800, color: "var(--gold)", marginBottom: 8, letterSpacing: "0.5px" }}>
                                📌 PINNED
                            </div>
                            {posts.filter((p) => p.pinned).map((p) => (
                                <div key={p._id} style={{ fontSize: 13, color: "var(--muted)", marginBottom: 4 }}>
                                    <b style={{ color: "var(--text)" }}>{p.author?.firstName}:</b> {p.message.slice(0, 120)}{p.message.length > 120 ? "…" : ""}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Announcement compose toggle for organizer */}
                    {isOrganizer && (
                        <div style={{ marginBottom: 10, display: "flex", gap: 8, alignItems: "center" }}>
                            <button onClick={() => setIsAnnounce((a) => !a)}
                                style={{
                                    border: isAnnounce ? "1.5px solid rgba(201,162,39,0.50)" : "1px solid rgba(18,18,18,0.10)",
                                    background: isAnnounce ? "rgba(201,162,39,0.10)" : "transparent",
                                    borderRadius: 20, padding: "4px 14px", fontSize: 12, fontWeight: 700,
                                    cursor: "pointer", fontFamily: "inherit", color: isAnnounce ? "#6b5400" : "var(--muted)",
                                }}>
                                📢 {isAnnounce ? "Announcement mode ON" : "Post as Announcement"}
                            </button>
                        </div>
                    )}

                    {/* Message list */}
                    <div
                        ref={listRef}
                        onScroll={handleScroll}
                        style={{
                            maxHeight: 480, overflowY: "auto", paddingRight: 4,
                            display: "flex", flexDirection: "column", gap: 2,
                        }}
                    >
                        {rootPosts.length === 0 && (
                            <div style={{
                                textAlign: "center", padding: "32px 0",
                                color: "var(--muted)", fontSize: 13,
                            }}>
                                No messages yet. Be the first to start the discussion!
                            </div>
                        )}

                        {rootPosts.map((post) => (
                            <div key={post._id}>
                                <PostCard
                                    post={post}
                                    isOrganizer={isOrganizer}
                                    currentUserId={currentUserId}
                                    onReply={setReplyingTo}
                                    onDelete={handleDelete}
                                    onPin={handlePin}
                                    onReact={handleReact}
                                />
                                {/* Replies */}
                                {getReplies(post._id).map((reply) => (
                                    <PostCard
                                        key={reply._id}
                                        post={reply}
                                        isOrganizer={isOrganizer}
                                        currentUserId={currentUserId}
                                        onReply={setReplyingTo}
                                        onDelete={handleDelete}
                                        onPin={handlePin}
                                        onReact={handleReact}
                                        depth={1}
                                    />
                                ))}
                            </div>
                        ))}
                        <div ref={bottomRef} />
                    </div>

                    {err && (
                        <div className="alert" style={{ fontSize: 12, marginTop: 8 }}>{err}</div>
                    )}

                    {/* Reply‑to banner */}
                    {replyingTo && (
                        <div style={{
                            display: "flex", alignItems: "center", gap: 8,
                            background: "rgba(201,162,39,0.08)", border: "1px solid rgba(201,162,39,0.20)",
                            borderRadius: 10, padding: "6px 12px", marginTop: 10, fontSize: 12,
                        }}>
                            <span>↩ Replying to <b>{replyingTo.author?.firstName}</b>: "{replyingTo.message.slice(0, 60)}…"</span>
                            <button onClick={() => setReplyingTo(null)}
                                style={{
                                    marginLeft: "auto", border: "none", background: "transparent",
                                    cursor: "pointer", fontWeight: 700, color: "var(--muted)", fontFamily: "inherit"
                                }}>✕</button>
                        </div>
                    )}

                    {/* Input area */}
                    <div style={{
                        display: "flex", gap: 8, marginTop: 10, alignItems: "flex-end",
                    }}>
                        <textarea
                            className="input"
                            placeholder={replyingTo ? `Reply to ${replyingTo.author?.firstName}…` : "Write something…"}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
                            }}
                            rows={2}
                            style={{ resize: "none", flex: 1 }}
                        />
                        <button className="btn" onClick={send} disabled={sending || !input.trim()}
                            style={{ padding: "10px 20px", alignSelf: "flex-end", whiteSpace: "nowrap" }}>
                            {sending ? "…" : "Send"}
                        </button>
                    </div>
                    <div className="muted" style={{ fontSize: 11, marginTop: 4 }}>
                        Press Enter to send · Shift+Enter for new line
                    </div>
                </>
            )}
        </div>
    );
}
