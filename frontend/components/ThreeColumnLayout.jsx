"use client";
import React from "react";

export default function ThreeColumnLayout({ left, right, children, className }) {
  return (
    <div className={`grid grid-cols-1 lg:grid-cols-4 gap-4 ${className || ""}`}>
      <div className="lg:col-span-1 space-y-4">{left}</div>
      <div className="lg:col-span-2 space-y-4">{children}</div>
      <div className="lg:col-span-1 space-y-4">{right}</div>
    </div>
  );
}