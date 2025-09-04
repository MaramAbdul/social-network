"use client";
import { usePresence } from "../lib/usePresence";

export default function OnlineUsersCard() {
  const { onlineUsers: users, connectionStatus } = usePresence();

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/25">
          <span className="text-white text-sm font-bold">👥</span>
        </div>
        <h3 className="text-lg font-semibold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
          Online Users
        </h3>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm font-medium text-muted">Currently online</span>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${
              connectionStatus === 'connected' ? 'bg-green-500 animate-pulse' :
              connectionStatus === 'connecting' ? 'bg-yellow-500 animate-spin' :
              connectionStatus === 'error' ? 'bg-red-500' :
              'bg-gray-400'
            }`}></div>
            <span className="text-xs text-muted">{users.length}</span>
            <span className="text-[10px] text-muted capitalize">({connectionStatus})</span>
          </div>
        </div>

        {users.length === 0 ? (
          <div className="text-center py-8 space-y-2">
            <div className="text-3xl opacity-50">😴</div>
            <div className="text-sm text-muted">No one's online right now</div>
          </div>
        ) : (
          <div className="space-y-3 max-h-64 overflow-y-auto">
            {users.map((u) => {
              const initials = ((u?.displayName ?? u?.id ?? "").toString()).slice(0, 2).toUpperCase();
              const label = (u?.displayName ?? u?.id ?? "").toString();
              return (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/5 transition-colors">
                  <div className="relative">
                    {u?.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-gradient-to-br from-accent/20 to-accent-light/30 border border-accent/20 flex items-center justify-center text-xs font-bold text-accent">
                        {initials}
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white"></div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-foreground truncate">{label.slice(0, 20)}</div>
                    <div className="text-xs text-green-500 font-medium">Online</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}