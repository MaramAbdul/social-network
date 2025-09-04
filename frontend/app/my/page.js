// "use client";

// import { useEffect, useState } from "react";
// import { useMe } from "../../lib/useMe";
// import PostItem from "../../components/PostItem";

// export default function MyPosts() {
//   const { me, loading } = useMe();
//   const [posts, setPosts] = useState([]);
//   const [busy, setBusy] = useState(true);

//   useEffect(() => {
//     if (!me) {
//       setBusy(false);
//       return;
//     }
//     (async () => {
//       try {
//         const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
//         const res = await fetch(API + "/api/my/posts", {
//           credentials: "include",
//         });
//         if (res.ok) setPosts(await res.json());
//       } finally {
//         setBusy(false);
//       }
//     })();
//   }, [me]);

//   if (loading) return <div>Loading…</div>;
//   if (!me) return <div className="card">Please login to see your posts.</div>;

//   function onDeleted(id) {
//     setPosts((prev) => prev.filter((p) => p.id !== id));
//   }
//   function onLikeChanged(id, likes, liked) {
//     setPosts((prev) =>
//       prev.map((p) => (p.id === id ? { ...p, likeCount: likes, liked } : p))
//     );
//   }

//   return (
//     <section className="grid gap-4">
//       <h1 className="text-2xl font-semibold">My Posts</h1>
//       {busy ? (
//         <div className="text-slate-400">Loading…</div>
//       ) : posts.length === 0 ? (
//         <div className="card">You haven’t posted yet.</div>
//       ) : (
//         <div className="grid gap-3">
//           {posts.map((p) => (
//             <PostItem
//               key={p.id}
//               post={p}
//               me={me}
//               onDeleted={onDeleted}
//               onLikeChanged={onLikeChanged}
//             />
//           ))}
//         </div>
//       )}
//     </section>
//   );
// }

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useMe } from "../../lib/useMe";
import PostItem from "../../components/PostItem";

export default function MyPosts() {
  const { me, loading } = useMe();
  const [posts, setPosts] = useState([]);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState("");

  async function load() {
    if (!me) {
      setBusy(false);
      return;
    }
    setBusy(true);
    setErr("");
    try {
      const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
      const res = await fetch(`${API}/api/my/posts`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error(await res.text());
      const list = await res.json();
      // newest first (server already does this, but we ensure)
      list.sort((a, b) => `${b.createdAt}`.localeCompare(`${a.createdAt}`));
      setPosts(list);
    } catch (e) {
      setErr("Failed to load your posts.");
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    load(); /* eslint-disable-next-line */
  }, [me]);

  if (loading) return <div className="card">Loading…</div>;
  if (!me) return <div className="card">Please login to see your posts.</div>;

  function onDeleted(id) {
    setPosts((prev) => prev.filter((p) => p.id !== id));
  }
  function onLikeChanged(id, likes, liked) {
    setPosts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, likeCount: likes, liked } : p))
    );
  }

  return (
    <section className="grid gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Posts</h1>
        <div className="flex items-center gap-2">
          <span className="chip">{posts.length} total</span>
          <button className="btn-ghost" onClick={load} disabled={busy}>
            {busy ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* Errors */}
      {err && (
        <div className="rounded-xl border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-red-300">
          {err}
        </div>
      )}

      {/* Loading skeletons */}
      {busy && posts.length === 0 && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="card animate-pulse space-y-3">
              <div className="h-4 w-1/3 bg-white/10 rounded" />
              <div className="h-4 w-3/4 bg-white/10 rounded" />
              <div className="h-56 bg-white/5 rounded-xl" />
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!busy && posts.length === 0 && !err && (
        <div className="card text-center space-y-2">
          <div className="text-text-muted">You haven’t posted yet.</div>
          <div>
            <Link href="/" className="btn btn-primary">
              Create your first post
            </Link>
          </div>
        </div>
      )}

      {/* List */}
      {!busy && posts.length > 0 && (
        <div className="grid gap-3">
          {posts.map((p) => (
            <PostItem
              key={p.id}
              post={p}
              me={me}
              onDeleted={onDeleted}
              onLikeChanged={onLikeChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}
