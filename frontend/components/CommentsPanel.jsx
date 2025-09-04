// "use client";

// import { useEffect, useRef, useState } from "react";
// import { api } from "../lib/api";
// import { joinRoom } from "../lib/ws";

// export default function CommentsPanel({ postId }) {
//   const [comments, setComments] = useState([]);
//   const [body, setBody] = useState("");
//   const wsRef = useRef(null);

//   useEffect(() => {
//     let alive = true;
//     (async () => {
//       try {
//         const list = await fetch((process.env.NEXT_PUBLIC_API || "http://localhost:8080") + `/api/comments?postId=${postId}`)
//           .then(r => r.json());
//         if (alive) setComments(list);
//       } catch {}
//     })();
//     wsRef.current = joinRoom(`post:${postId}`, (msg) => {
//       if (msg.type === "comment_created" && msg?.payload?.postId === postId) {
//         setComments(prev => [...prev, msg.payload]);
//       }
//       if (msg.type === "like_updated" && msg?.payload?.postId === postId) {
//         // handled in PostItem via feed WS; keeping here for completeness
//       }
//     });
//     return () => { alive = false; try { wsRef.current?.close(); } catch {} };
//   }, [postId]);

//   async function submit(e) {
//     e.preventDefault();
//     if (!body.trim()) return;
//     try {
//       const c = await api("/api/comments", { method: "POST", body: JSON.stringify({ postId, body: body.trim() }) });
//       // ws will also push it; we can optimistically add:
//       setComments(prev => [...prev, c]);
//       setBody("");
//     } catch (e) { alert("Failed to comment: " + (e?.message || "error")); }
//   }

//   return (
//     <div className="mt-3 space-y-3">
//       <form onSubmit={submit} className="grid gap-2">
//         <input className="input" placeholder="Write a comment…" value={body} onChange={e => setBody(e.target.value)} />
//       </form>
//       <ul className="space-y-2">
//         {comments.map(c => (
//           <li key={c.id} className="border border-slate-800 rounded-xl p-3">
//             <div className="text-sm text-slate-400 mb-1">by {c.userId.slice(0,6)} · {c.createdAt}</div>
//             <div>{c.body}</div>
//           </li>
//         ))}
//       </ul>
//     </div>
//   );
// }

"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "../lib/api";
import { joinRoom } from "../lib/ws";

function formatWhen(s) {
  if (!s) return "";
  // Expecting "YYYY-MM-DD HH:MM:SS"; graceful fallback
  const t = s.replace(" ", "T") + "Z";
  const d = new Date(t);
  if (isNaN(d)) return s;
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return d.toLocaleString();
}

export default function CommentsPanel({ postId }) {
  const [comments, setComments] = useState([]);
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const wsRef = useRef(null);
  const listEndRef = useRef(null);

  // Scroll to bottom when comments change
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [comments?.length]);

  useEffect(() => {
    let alive = true;

    (async () => {
      try {
        setErr("");
        const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
        const res = await fetch(`${API}/api/comments?postId=${postId}`, { credentials: "include" });
        if (!res.ok) throw new Error(await res.text());
        const list = await res.json();
        if (alive) setComments(Array.isArray(list) ? list : []);
      } catch (e) {
        if (alive) setErr("Failed to load comments.");
      } finally {
        if (alive) setLoading(false);
      }
    })();

    wsRef.current = joinRoom(`post:${postId}`, (msg) => {
      if (msg.type === "comment_created" && msg?.payload?.postId === postId) {
        setComments((prev) => {
          const existing = (prev || []).find(comment => comment.id === msg.payload.id);
          if (existing) return prev;
          return [...(prev || []), msg.payload];
        });
      }
      // like updates for this post are handled in the feed; no-op here
    });

    return () => {
      alive = false;
      try { wsRef.current?.close(); } catch {}
    };
  }, [postId]);

  async function submit(e) {
    e?.preventDefault();
    const text = body.trim();
    if (!text || submitting) return;
    setSubmitting(true);
    setErr("");
    try {
      const payload = { postId: parseInt(postId), body: text };
      console.log("Sending comment payload:", payload);
      const c = await api("/api/comments", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      // optimistic add (WS will also deliver it, so check for duplicates)
      setComments((prev) => {
        const existing = (prev || []).find(comment => comment.id === c.id);
        if (existing) return prev;
        return [...(prev || []), c];
      });
      setBody("");
    } catch (e) {
      setErr("Could not post your comment.");
    } finally {
      setSubmitting(false);
    }
  }

  function onKeyDown(e) {
    // Enter to submit, Shift+Enter for newline. Ctrl/Cmd+Enter also submits.
    if ((e.key === "Enter" && !e.shiftKey) || (e.key === "Enter" && (e.ctrlKey || e.metaKey))) {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="mt-4">
      {/* Composer */}
      <form onSubmit={submit} className="card mb-3 space-y-3">
        <textarea
          rows={2}
          className="input min-h-[72px]"
          placeholder="Write a comment…"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={onKeyDown}
        />
        <div className="flex items-center justify-between">
          <span className="chip">{body.trim().length} chars</span>
          <button
            type="submit"
            className="btn btn-primary disabled:opacity-60"
            disabled={!body.trim() || submitting}
          >
            {submitting ? "Posting…" : "Post comment"}
          </button>
        </div>
        {err && <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">{err}</div>}
      </form>

      {/* List */}
      <div className="space-y-2 max-h-[50vh] overflow-auto pr-1">
        {loading ? (
          <div className="card animate-pulse">
            
            {/* <div></div> */}
              <div className="h-4 w-1/4 bg-white/10 rounded mb-2" />
            <div className="h-4 w-3/4 bg-white/10 rounded" />
          </div>
        ) : (comments?.length || 0) === 0 ? (
          <div className="card text-text-muted">No comments yet you can Be the first!</div>
        ) : (
          <ul className="space-y-2">
            {comments?.map((c, index) => (
              <li key={`comment-${c.id}-${index}`} className="card p-4">
                <div className="mb-1 text-sm text-text-muted">
                  by <span className="font-mono">{c.userId.slice(0, 6)}</span> · {formatWhen(c.createdAt)}
                </div>
                <div className="whitespace-pre-wrap">{c.body}</div>
              </li>
            ))}
          </ul>
        )}
        <div ref={listEndRef} />
      </div>
    </div>
  );
}