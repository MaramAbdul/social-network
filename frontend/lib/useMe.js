"use client";
import { useEffect, useState } from "react";

export function useMe() {
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(
          (process.env.NEXT_PUBLIC_API || "http://localhost:8080") + "/api/me",
          {
            credentials: "include",
          }
        );
        if (res.ok) setMe(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);
  return { me, loading, refresh: () => setLoading(true) };
}
