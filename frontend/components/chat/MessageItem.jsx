"use client";

function formatDateTime(timestamp) {
  if (!timestamp) return "";
  const date = new Date(timestamp.replace(" ", "T") + "Z");
  if (isNaN(date.getTime())) return timestamp;
  
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const messageDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = (today - messageDate) / (1000 * 60 * 60 * 24);
  
  const timeStr = date.toLocaleTimeString([], { 
    hour: '2-digit', 
    minute: '2-digit',
    hour12: true 
  });
  
  if (diffDays === 0) {
    return `Today ${timeStr}`;
  } else if (diffDays === 1) {
    return `Yesterday ${timeStr}`;
  } else if (diffDays < 7) {
    return `${date.toLocaleDateString([], { weekday: 'short' })} ${timeStr}`;
  } else {
    return `${date.toLocaleDateString([], { 
      month: 'short', 
      day: 'numeric' 
    })} ${timeStr}`;
  }
}

export default function MessageItem({ message, isOwnMessage, showSender, type }) {
  const senderName = message.senderId?.slice(0, 12) || "Unknown";
  
  return (
    <div className={`flex gap-3 ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      {/* Avatar for non-own messages */}
      {!isOwnMessage && (
        <div className="flex-shrink-0 mt-1">
          <div className="w-8 h-8 bg-gradient-to-br from-accent/20 to-accent-light/30 rounded-full flex items-center justify-center">
            <span className="text-accent text-xs font-bold">
              {senderName.slice(0, 2).toUpperCase()}
            </span>
          </div>
        </div>
      )}

      <div className={`max-w-[70%] ${isOwnMessage ? "items-end" : "items-start"} flex flex-col`}>
        {/* Sender name and timestamp header */}
        {(showSender || type === "dm") && !isOwnMessage && (
          <div className={`text-xs mb-1 ${isOwnMessage ? "text-right" : "text-left"}`}>
            <span className="font-semibold text-foreground">{senderName}</span>
            <span className="text-muted ml-2">{formatDateTime(message.createdAt)}</span>
          </div>
        )}
        
        {/* Own message timestamp (shown above bubble) */}
        {isOwnMessage && (
          <div className="text-xs text-muted text-right mb-1">
            {formatDateTime(message.createdAt)}
          </div>
        )}
        
        {/* Message bubble */}
        <div
          className={`rounded-2xl px-4 py-3 break-words max-w-full ${
            isOwnMessage
              ? "bg-purple-200 rounded-br-md"
              : "bg-card-hover text-foreground rounded-bl-md border-border/50 bg-gray-200"
          } shadow-sm`}
        >
          <div className="whitespace-pre-wrap text-emoji">{message.body}</div>
        </div>
      </div>
    </div>
  );
}