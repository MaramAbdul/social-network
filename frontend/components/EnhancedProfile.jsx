"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useProfile, useFollowList } from "../lib/useProfile";
import Avatar from "./Avatar";
import FollowButton from "./FollowButton";
import PostItem from "./PostItem";

function ProfileInfo({ user, canViewAll, isSelf }) {
  if (!canViewAll && !user.isPublic) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border text-center">
        <div className="text-4xl mb-2">🔒</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Private Profile</h3>
        <p className="text-muted">This user's profile is private. Follow to see their information.</p>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-xl p-6 border border-border space-y-4">
      <h3 className="text-lg font-semibold text-foreground">About</h3>
      
      <div className="grid gap-3">
        {user.firstName && (
          <div>
            <span className="text-sm text-muted">Name:</span>
            <p className="text-foreground">
              {user.firstName} {user.lastName}
            </p>
          </div>
        )}
        
        {user.nickname && (
          <div>
            <span className="text-sm text-muted">Nickname:</span>
            <p className="text-foreground">{user.nickname}</p>
          </div>
        )}
        
        {isSelf && user.email && (
          <div>
            <span className="text-sm text-muted">Email:</span>
            <p className="text-foreground">{user.email}</p>
          </div>
        )}
        
        {isSelf && user.dateOfBirth && (
          <div>
            <span className="text-sm text-muted">Date of Birth:</span>
            <p className="text-foreground">{new Date(user.dateOfBirth).toLocaleDateString()}</p>
          </div>
        )}
        
        {user.aboutMe && (
          <div>
            <span className="text-sm text-muted">About Me:</span>
            <p className="text-foreground whitespace-pre-wrap">{user.aboutMe}</p>
          </div>
        )}
        
        <div>
          <span className="text-sm text-muted">Joined:</span>
          <p className="text-foreground">{new Date(user.createdAt).toLocaleDateString()}</p>
        </div>
      </div>
    </div>
  );
}

function FollowersFollowingSection({ userId, stats, canViewAll }) {
  const router = useRouter();
  
  const handleViewFollowers = () => {
    router.push(`/profile/${userId}/followers`);
  };
  
  const handleViewFollowing = () => {
    router.push(`/profile/${userId}/following`);
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Connections</h3>
      
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={handleViewFollowers}
          className="p-4 bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors text-center"
          disabled={!canViewAll}
        >
          <div className="text-2xl font-bold text-foreground">{stats.followers}</div>
          <div className="text-sm text-muted">Followers</div>
        </button>
        
        <button
          onClick={handleViewFollowing}
          className="p-4 bg-accent/5 hover:bg-accent/10 rounded-lg transition-colors text-center"
          disabled={!canViewAll}
        >
          <div className="text-2xl font-bold text-foreground">{stats.following}</div>
          <div className="text-sm text-muted">Following</div>
        </button>
      </div>
      
      {!canViewAll && (
        <p className="text-xs text-muted mt-2 text-center">
          Follow to see connections
        </p>
      )}
    </div>
  );
}

function PostsSection({ posts, loading, canViewAll, isSelf }) {
  if (!canViewAll) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border text-center">
        <div className="text-4xl mb-2">📝</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">Posts</h3>
        <p className="text-muted">Follow to see posts from this user</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse bg-card rounded-xl p-6 border border-border">
            <div className="flex gap-3">
              <div className="w-12 h-12 bg-accent/10 rounded-full"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-accent/10 rounded w-1/4"></div>
                <div className="h-16 bg-accent/5 rounded"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (posts.length === 0) {
    return (
      <div className="bg-card rounded-xl p-6 border border-border text-center">
        <div className="text-4xl mb-2">📝</div>
        <h3 className="text-lg font-semibold text-foreground mb-2">No Posts Yet</h3>
        <p className="text-muted">
          {isSelf ? "You haven't posted anything yet" : "This user hasn't posted anything yet"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-foreground">Posts ({posts.length})</h3>
      {posts.map(post => (
        <PostItem
          key={post.id}
          post={{
            ...post,
            user: { id: post.userId }, // PostItem expects a user object
            userNickname: null,
            userFirstName: null,
            userLastName: null
          }}
        />
      ))}
    </div>
  );
}

function PrivacyControls({ profile, onUpdatePrivacy }) {
  const [converting, setConverting] = useState(false);
  
  const handlePrivacyChange = async (isPublic, convertPosts = false) => {
    setConverting(convertPosts);
    try {
      await onUpdatePrivacy(isPublic, convertPosts);
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="bg-card rounded-xl p-6 border border-border">
      <h3 className="text-lg font-semibold text-foreground mb-4">Privacy Settings</h3>
      
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium text-foreground">Profile Visibility</div>
            <div className="text-sm text-muted">
              {profile.user.isPublic ? "Anyone can see your profile" : "Only followers can see your profile"}
            </div>
          </div>
          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
            profile.user.isPublic 
              ? "bg-green-100 text-green-800" 
              : "bg-yellow-100 text-yellow-800"
          }`}>
            {profile.user.isPublic ? "Public" : "Private"}
          </span>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handlePrivacyChange(true)}
            disabled={profile.user.isPublic}
            className="px-4 py-2 bg-accent text-white rounded-lg hover:bg-accent-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Make Public
          </button>
          <button
            onClick={() => handlePrivacyChange(false)}
            disabled={!profile.user.isPublic}
            className="px-4 py-2 bg-muted/20 text-muted hover:bg-muted/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            Make Private
          </button>
        </div>
        
        {/* Bulk post conversion options */}
        <div className="pt-4 border-t border-border">
          <h4 className="font-medium text-foreground mb-2">Bulk Post Privacy</h4>
          
          {!profile.user.isPublic ? (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                When making your profile public, you can also make your old posts public
              </p>
              <button
                onClick={() => handlePrivacyChange(true, true)}
                disabled={converting}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
              >
                {converting ? "Converting..." : "Make Public + Convert Old Posts"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted">
                When making your profile private, you can also make your old posts private (followers-only)
              </p>
              <button
                onClick={() => handlePrivacyChange(false, true)}
                disabled={converting}
                className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors disabled:opacity-50 text-sm"
              >
                {converting ? "Converting..." : "Make Private + Convert Old Posts"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function EnhancedProfile({ userId, me }) {
  const { profile, loading, error, updatePrivacy, followUser, unfollowUser } = useProfile(userId);
  
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <div className="animate-pulse">
          <div className="bg-card rounded-xl p-6 border border-border">
            <div className="flex gap-4">
              <div className="w-20 h-20 bg-accent/10 rounded-full"></div>
              <div className="flex-1 space-y-3">
                <div className="h-6 bg-accent/10 rounded w-1/3"></div>
                <div className="h-4 bg-accent/5 rounded w-1/2"></div>
                <div className="h-4 bg-accent/5 rounded w-1/4"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-card rounded-xl p-6 border border-border text-center">
          <div className="text-4xl mb-2">😕</div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Profile Not Found</h2>
          <p className="text-muted">{error || "This user profile could not be loaded"}</p>
        </div>
      </div>
    );
  }

  const isSelf = me?.id === profile.user.id;
  const canViewAll = profile.canViewAll;

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Profile Header */}
      <div className="bg-card rounded-xl p-6 border border-border">
        <div className="flex flex-col sm:flex-row gap-6">
          <div className="flex-shrink-0 text-center sm:text-left">
            <Avatar
              src={profile.user.avatarUrl}
              label={profile.user.nickname || profile.user.firstName || profile.user.id}
              size={80}
            />
          </div>
          
          <div className="flex-1 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold text-foreground">
                  {profile.user.nickname || 
                   `${profile.user.firstName || ""} ${profile.user.lastName || ""}`.trim() || 
                   profile.user.id}
                </h1>
                <div className="text-muted flex items-center gap-2 mt-1">
                  <span>@{profile.user.id}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    profile.user.isPublic 
                      ? "bg-green-100 text-green-800" 
                      : "bg-yellow-100 text-yellow-800"
                  }`}>
                    {profile.user.isPublic ? "Public" : "Private"}
                  </span>
                </div>
              </div>
              
              <div className="flex-shrink-0">
                {!isSelf ? (
                  <FollowButton
                    targetId={profile.user.id}
                    initialRelation={profile.relation}
                    isPublic={profile.user.isPublic}
                    onFollow={followUser}
                    onUnfollow={unfollowUser}
                  />
                ) : null}
              </div>
            </div>
            
            {profile.user.aboutMe && canViewAll && (
              <p className="text-foreground whitespace-pre-wrap">{profile.user.aboutMe}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Profile Info */}
        <div className="space-y-6">
          <ProfileInfo 
            user={profile.user} 
            canViewAll={canViewAll}
            isSelf={isSelf}
          />
          
          <FollowersFollowingSection 
            userId={profile.user.id}
            stats={profile.stats}
            canViewAll={canViewAll}
          />
          
          {isSelf && (
            <PrivacyControls 
              profile={profile}
              onUpdatePrivacy={updatePrivacy}
            />
          )}
        </div>

        {/* Right Column - Posts */}
        <div className="lg:col-span-2">
          <PostsSection 
            posts={profile.posts}
            loading={false}
            canViewAll={canViewAll}
            isSelf={isSelf}
          />
        </div>
      </div>
    </div>
  );
}