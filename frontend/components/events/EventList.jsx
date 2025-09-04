"use client";
import { useState } from "react";

export default function EventList({ events, loading, onRespondToEvent, onDeleteEvent, currentUserId, userRole }) {
  const [respondingTo, setRespondingTo] = useState(null);

  const formatEventDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const isTomorrow = date.toDateString() === tomorrow.toDateString();

    const timeStr = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    const dateStr = date.toLocaleDateString([], {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
    });

    if (isToday) {
      return `Today at ${timeStr}`;
    } else if (isTomorrow) {
      return `Tomorrow at ${timeStr}`;
    } else {
      return `${dateStr} at ${timeStr}`;
    }
  };

  const getEventStatus = (eventDate) => {
    const now = new Date();
    const eventDateTime = new Date(eventDate);
    
    if (eventDateTime < now) {
      return { status: 'past', color: 'text-gray-500', bg: 'bg-gray-100 dark:bg-gray-700' };
    }
    
    const hoursUntilEvent = (eventDateTime - now) / (1000 * 60 * 60);
    if (hoursUntilEvent <= 24) {
      return { status: 'soon', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/20' };
    }
    
    return { status: 'upcoming', color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/20' };
  };

  const handleRespond = async (eventId, response) => {
    setRespondingTo(eventId);
    try {
      await onRespondToEvent(eventId, response);
    } catch (error) {
      console.error("Failed to respond:", error);
    } finally {
      setRespondingTo(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse p-4 bg-gray-100 dark:bg-gray-700 rounded-xl">
            <div className="flex justify-between items-start mb-3">
              <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded w-1/3"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
            </div>
            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-2/3 mb-3"></div>
            <div className="flex gap-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-16"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-600 rounded w-20"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🎉</div>
        <div className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
          No events yet
        </div>
        <div className="text-gray-600 dark:text-gray-400">
          Create the first event to get started!
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {events.map((event) => {
        const eventStatus = getEventStatus(event.eventDate);
        const canDelete = currentUserId === event.creatorId || userRole === 'owner' || userRole === 'admin';
        
        return (
          <div
            key={event.id}
            className={`p-4 rounded-xl border border-gray-200 dark:border-gray-600 ${eventStatus.bg} transition-all hover:shadow-md`}
          >
            {/* Header */}
            <div className="flex justify-between items-start mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-gray-900 dark:text-white text-lg mb-1 truncate">
                  {event.title}
                </h3>
                <div className={`text-sm font-medium ${eventStatus.color} flex items-center gap-2`}>
                  <span>📅</span>
                  {formatEventDate(event.eventDate)}
                  {eventStatus.status === 'past' && <span>(Past)</span>}
                  {eventStatus.status === 'soon' && <span>(Soon!)</span>}
                </div>
              </div>
              
              {canDelete && (
                <button
                  onClick={() => onDeleteEvent(event.id)}
                  className="p-1 rounded-lg hover:bg-red-100 dark:hover:bg-red-900 text-gray-500 hover:text-red-600 transition-colors"
                  title="Delete event"
                >
                  🗑️
                </button>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="text-gray-700 dark:text-gray-300 text-sm mb-4 bg-white/50 dark:bg-black/20 rounded-lg p-3">
                {event.description}
              </div>
            )}

            {/* Creator */}
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-3">
              Created by {event.creatorId}
            </div>

            {/* RSVP Section */}
            <div className="flex items-center justify-between">
              {/* Response Counts */}
              <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1">
                  <span>✅</span>
                  <span className="font-medium text-green-600">{event.responses?.going || 0}</span>
                  <span className="text-gray-500">going</span>
                </div>
                <div className="flex items-center gap-1">
                  <span>❌</span>
                  <span className="font-medium text-red-600">{event.responses?.notGoing || 0}</span>
                  <span className="text-gray-500">not going</span>
                </div>
              </div>

              {/* RSVP Buttons */}
              {eventStatus.status !== 'past' && (
                <div className="flex gap-2">
                  <button
                    onClick={() => handleRespond(event.id, "going")}
                    disabled={respondingTo === event.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      event.userResponse === "going"
                        ? "bg-green-600 text-white"
                        : "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800"
                    } disabled:opacity-50`}
                  >
                    {respondingTo === event.id ? "..." : "Going"}
                  </button>
                  <button
                    onClick={() => handleRespond(event.id, "not_going")}
                    disabled={respondingTo === event.id}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                      event.userResponse === "not_going"
                        ? "bg-red-600 text-white"
                        : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800"
                    } disabled:opacity-50`}
                  >
                    {respondingTo === event.id ? "..." : "Not Going"}
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}