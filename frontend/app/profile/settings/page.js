"use client";

import { useMe } from "../../../lib/useMe";
import PrivacyCard from "../../../components/PrivacyCard";
import PostPrivacyManager from "../../../components/PostPrivacyManager";
import Header from "../../../components/Header";

export default function ProfileSettings() {
  const { me, loading } = useMe();

  if (loading) return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="card">Loading…</div>
      </div>
    </div>
  );
  
  if (!me) return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <div className="max-w-4xl mx-auto p-6">
        <div className="card">Please login to manage your profile.</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <h1 className="text-3xl font-bold text-foreground">Profile Settings</h1>
        <PrivacyCard me={me} />
        <PostPrivacyManager />
      </div>
    </div>
  );
}
