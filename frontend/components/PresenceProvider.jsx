"use client";
import { usePresence } from "../lib/usePresence";

export default function PresenceProvider({ children }) {
  // This hook initializes the global presence connection
  usePresence();
  
  // Just render children, the hook handles everything globally
  return children;
}