"use client";
import { useState, useRef, useEffect } from "react";
import { useChat } from "../../lib/useChat";
import MessageItem from "./MessageItem";
import GroupSettings from "./GroupSettings";
import EmojiPicker from "../EmojiPicker";

export default function ChatWindow({ chatId, type, title, me }) {
  const { messages, sendMessage, isConnected, loadMoreMessages, hasMoreMessages, loadingMore } = useChat(chatId, type);
  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [showGroupSettings, setShowGroupSettings] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesTopRef = useRef(null);
  const inputRef = useRef(null);
  const emojiPickerRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const previousScrollHeight = useRef(0);

  // Track loading history state
  useEffect(() => {
    setIsLoadingHistory(loadingMore);
  }, [loadingMore]);

  // Auto-scroll to bottom when new messages arrive (but not during history loading)
  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      // Initial load - scroll immediately without smooth animation
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      // Wait a moment then allow intersection observer to work
      setTimeout(() => setIsInitialLoad(false), 1000);
    } else if (!isInitialLoad && !isLoadingHistory) {
      // Only auto-scroll for new messages, not when loading history
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isInitialLoad, isLoadingHistory]);

  // Maintain scroll position when loading history messages
  useEffect(() => {
    if (loadingMore && messagesContainerRef.current) {
      // Store scroll height before new messages are added
      previousScrollHeight.current = messagesContainerRef.current.scrollHeight;
    }
  }, [loadingMore]);

  // Restore scroll position after history messages are loaded
  useEffect(() => {
    if (!loadingMore && previousScrollHeight.current && messagesContainerRef.current) {
      // Calculate new scroll position to maintain view
      const container = messagesContainerRef.current;
      const newScrollHeight = container.scrollHeight;
      const heightDifference = newScrollHeight - previousScrollHeight.current;
      
      if (heightDifference > 0) {
        // Adjust scroll position to account for new messages at top
        // Use requestAnimationFrame to ensure DOM has updated
        requestAnimationFrame(() => {
          container.scrollTop = container.scrollTop + heightDifference;
        });
      }
      
      previousScrollHeight.current = 0;
    }
  }, [loadingMore, messages.length]);

  // Focus input on chat change and reset initial load state
  useEffect(() => {
    inputRef.current?.focus();
    setIsInitialLoad(true);
  }, [chatId]);

  // Close emoji picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiPicker]);

  // Intersection observer for loading more messages at top
  useEffect(() => {
    // Don't observe during initial load to prevent auto-loading all messages
    if (!messagesTopRef.current || !hasMoreMessages || loadingMore || isInitialLoad) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !isInitialLoad) {
          loadMoreMessages();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(messagesTopRef.current);

    return () => {
      observer.disconnect();
    };
  }, [hasMoreMessages, loadingMore, loadMoreMessages, isInitialLoad]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(newMessage);
      setNewMessage("");
    } catch (error) {
      console.error("Failed to send message:", error);
      // Could add toast notification here
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setNewMessage(prev => prev + emoji);
    inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-sky-400 to-sky-600 rounded-xl flex items-center justify-center shadow-md">
              <span className="text-white text-lg font-bold">
                {type === "group" ? "👥" : "💬"}
              </span>
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                <div className={`w-2 h-2 rounded-full ${
                  isConnected ? "bg-green-500 animate-pulse" : "bg-gray-400"
                }`}></div>
                <span>{isConnected ? "Connected" : "Connecting..."}</span>
                {type === "group" && <span>• Group Chat</span>}
                {type === "dm" && <span>• Direct Message</span>}
              </div>
            </div>
          </div>

          {/* Group Settings Button */}
          {type === "group" && (
            <button
              onClick={() => setShowGroupSettings(true)}
              className="p-2 rounded-xl hover:bg-sky-100 dark:hover:bg-sky-900 text-gray-600 dark:text-gray-400 hover:text-sky-600 dark:hover:text-sky-400 transition-colors"
              title="Group Settings"
            >
              <span className="text-lg">⚙️</span>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Loading more indicator at top */}
        {hasMoreMessages && (
          <div 
            ref={messagesTopRef}
            className="flex justify-center py-2 min-h-[20px]"
          >
            {loadingMore && (
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <div className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin"></div>
                Loading older messages...
              </div>
            )}
          </div>
        )}

        {messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted">
            <div className="text-center space-y-2">
              <div className="text-4xl opacity-50">
                {type === "group" ? "👥" : "💬"}
              </div>
              <div>
                <div className="font-medium">No messages yet</div>
                <div className="text-sm">
                  {type === "group" 
                    ? "Start the conversation in this group" 
                    : "Send the first message to start chatting"
                  }
                </div>
              </div>
            </div>
          </div>
        ) : (
          <>
            {messages.map((message, index) => {
              const isOwnMessage = message.senderId === me?.id;
              // Show sender for all group messages (except your own), and first in sequence
              const showSender = type === "group" && !isOwnMessage && 
                (index === 0 || messages[index - 1]?.senderId !== message.senderId);
              
              return (
                <MessageItem
                  key={`${message.id}-${index}`}
                  message={message}
                  isOwnMessage={isOwnMessage}
                  showSender={showSender}
                  type={type}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Message Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <form onSubmit={handleSend} className="flex gap-3 items-end">
          <div className="flex-1 relative" ref={emojiPickerRef}>
            <textarea
              ref={inputRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`Message ${type === "group" ? "group" : title}...`}
              className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-sky-500 resize-none"
              rows="1"
              disabled={sending}
            />
            {/* Emoji Picker Button */}
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2">
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2 text-gray-500 hover:text-sky-600 transition-colors"
                title="Add emoji"
              >
                😀
              </button>
            </div>
            
            {/* Emoji Picker */}
            {showEmojiPicker && (
              <EmojiPicker
                onEmojiSelect={handleEmojiSelect}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}
          </div>
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-6 py-3 bg-sky-600 text-white rounded-lg hover:bg-sky-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
          >
            {sending ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
            ) : (
              <span>Send</span>
            )}
          </button>
        </form>
      </div>

      {/* Group Settings Modal */}
      {showGroupSettings && type === "group" && (
        <GroupSettings
          groupId={chatId}
          groupTitle={title}
          me={me}
          onClose={() => setShowGroupSettings(false)}
        />
      )}
    </div>
  );
}