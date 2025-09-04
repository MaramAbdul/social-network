"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function MyProfileRedirect() {
  const router = useRouter();

  useEffect(() => {
    (async () => {
      try {
        const API = process.env.NEXT_PUBLIC_API || "http://localhost:8080";
        const res = await fetch(`${API}/api/me`, { credentials: "include" });
        if (!res.ok) {
          router.replace("/login");
          return;
        }
        const me = await res.json();
        router.replace(`/profile/${me.id}`);
      } catch {
        router.replace("/login");
      }
    })();
  }, [router]);

  return <div className="card">Loading…</div>;
}
