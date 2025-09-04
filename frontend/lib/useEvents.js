"use client";
import { useState, useEffect } from "react";
import { api } from "./api";

export function useEvents(groupId) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!groupId) return;
    
    fetchEvents();
  }, [groupId]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const data = await api(`/api/events/group?groupId=${groupId}`);
      setEvents(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch events:", error);
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  const createEvent = async (title, description, eventDate) => {
    console.log("useEvents.createEvent called with:", { groupId, title, description, eventDate });
    try {
      const payload = {
        groupId: parseInt(groupId),
        title,
        description,
        eventDate
      };
      console.log("Sending API request with payload:", payload);
      
      const newEvent = await api("/api/events/create", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      console.log("Event created successfully:", newEvent);
      
      // Add new event to the list
      setEvents(prev => [...prev, newEvent]);
      return newEvent;
    } catch (error) {
      console.error("Failed to create event:", error);
      throw error;
    }
  };

  const respondToEvent = async (eventId, response) => {
    try {
      await api("/api/events/respond", {
        method: "POST",
        body: JSON.stringify({
          eventId: parseInt(eventId),
          response
        })
      });

      // Update event in local state
      setEvents(prev => prev.map(event => {
        if (event.id === eventId) {
          const updatedEvent = { ...event };
          
          // Remove previous response
          if (event.userResponse === "going") {
            updatedEvent.responses.going--;
          } else if (event.userResponse === "not_going") {
            updatedEvent.responses.notGoing--;
          }
          
          // Add new response
          if (response === "going") {
            updatedEvent.responses.going++;
          } else if (response === "not_going") {
            updatedEvent.responses.notGoing++;
          }
          
          updatedEvent.userResponse = response;
          return updatedEvent;
        }
        return event;
      }));
    } catch (error) {
      console.error("Failed to respond to event:", error);
      throw error;
    }
  };

  const deleteEvent = async (eventId) => {
    try {
      await api(`/api/events/delete?eventId=${eventId}`, {
        method: "DELETE"
      });

      // Remove event from local state
      setEvents(prev => prev.filter(event => event.id !== eventId));
    } catch (error) {
      console.error("Failed to delete event:", error);
      throw error;
    }
  };

  return {
    events,
    loading,
    createEvent,
    respondToEvent,
    deleteEvent,
    refetchEvents: fetchEvents
  };
}