"use client";

import { useParams } from "next/navigation";
import { useMe } from "../../../lib/useMe";
import EnhancedProfile from "../../../components/EnhancedProfile";
import Header from "../../../components/Header";

export default function ProfilePage() {
  const { me } = useMe();
  const { id } = useParams();

  return (
    <div className="min-h-screen bg-background">
      {/* <Header /> */}
      <EnhancedProfile userId={id} me={me} />
    </div>
  );
}
