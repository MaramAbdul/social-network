"use client";

import { useParams, useRouter } from "next/navigation";
import { useMe } from "../../../../lib/useMe";
import { useFollowList } from "../../../../lib/useProfile";
import Header from "../../../../components/Header";
import Avatar from "../../../../components/Avatar";

export default function FollowingPage() {
  const { me } = useMe();
  const { id } = useParams();
  const router = useRouter();
  const { users, loading, error } = useFollowList(id, "following");

  const handleUserClick = (userId) => {
    router.push(`/profile/${userId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        {/* <Header /> */}
        <div className="max-w-2xl mx-auto p-6">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
            >
              ←
            </button>
            <h1 className="text-2xl font-bold text-foreground">Following</h1>
          </div>
          
          <div className="space-y-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="animate-pulse flex items-center gap-4 p-4 bg-card rounded-xl border border-border">
                <div className="w-12 h-12 bg-accent/10 rounded-full"></div>
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-accent/10 rounded w-1/3"></div>
                  <div className="h-3 bg-accent/5 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <div className="max-w-2xl mx-auto p-6">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-accent/10 rounded-lg transition-colors"
          >
            ←
          </button>
          <h1 className="text-2xl font-bold text-foreground">Following</h1>
        </div>

        {error ? (
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="text-4xl mb-2">😕</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Unable to Load Following</h2>
            <p className="text-muted">{error}</p>
          </div>
        ) : users.length === 0 ? (
          <div className="bg-card rounded-xl p-6 border border-border text-center">
            <div className="text-4xl mb-2">👥</div>
            <h2 className="text-lg font-semibold text-foreground mb-2">Not Following Anyone</h2>
            <p className="text-muted">This user isn't following anyone yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {users.map((user) => (
              <div
                key={user.id}
                onClick={() => handleUserClick(user.id)}
                className="flex items-center gap-4 p-4 bg-card rounded-xl border border-border hover:shadow-sm transition-all cursor-pointer"
              >
                <Avatar
                  src={user.avatarUrl}
                  label={user.nickname || user.firstName || user.id}
                  size={48}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-foreground truncate">
                      {user.nickname || 
                       `${user.firstName || ""} ${user.lastName || ""}`.trim() || 
                       user.id}
                    </h3>
                    {!user.isPublic && (
                      <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
                        Private
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted">@{user.id}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}