"use client";

import ThreeColumnLayout from "../components/ThreeColumnLayout";
import GreetingCard from "../components/GreetingCard";
import HeroCard from "../components/HeroCard";
import EnhancedPostComposer from "../components/EnhancedPostComposer";
import PostList from "../components/PostList";
import { useMe } from "../lib/useMe";
import OnlineUsersCard from "../components/OnlineUsersCard";

export default function HomePage() {
  const { me, loading } = useMe();

  if (loading) {
    return (
      <section className="space-y-6">
        <div className="relative overflow-hidden rounded-2xl h-40 bg-gradient-to-r from-white/60 to-blue-50/40 border border-white/20 animate-pulse" />
        <div className="relative overflow-hidden rounded-2xl h-64 bg-gradient-to-r from-white/60 to-blue-50/40 border border-white/20 animate-pulse" />
      </section>
    );
  }

  // Logged-out: hero + feed
  if (!me) {
    return (
      <section className="space-y-6">
        <HeroCard />
        <ThreeColumnLayout
          right={<div className="card">show online users</div>}
        >
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                <span className="text-white text-sm font-bold">📰</span>
              </div>
              <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
                Recent Posts
              </h2>
            </div>
            <PostList me={null} />
          </div>
        </ThreeColumnLayout>
      </section>
    );
  }

  // Logged-in: greeting + composer + feed
  return (
    <section className="space-y-6">
      <ThreeColumnLayout
        left={
          <>
            <GreetingCard />
            <EnhancedPostComposer
              onCreated={() => {
                /* feed WS auto-inserts */
              }}
            />
          </>
        }
        right={
          <div className="card">
            <OnlineUsersCard />
          </div>
        }
      >
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <span className="text-white text-sm font-bold">📰</span>
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
              Recent Posts
            </h2>
          </div>
          <PostList me={me} />
        </div>
      </ThreeColumnLayout>
    </section>
  );
}
