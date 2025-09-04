"use client";
import { useState } from "react";

const emojiCategories = {
  "😀": ["😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣", "😊", "😇"],
  "❤️": ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍", "🤎", "💔"],
  "👍": ["👍", "👎", "👏", "🙌", "👌", "✌️", "🤞", "🤟", "🤘", "👋"],
  "🎉": ["🎉", "🎊", "🎈", "🎁", "🎀", "🎂", "🎄", "✨", "🌟", "⭐"],
  "🐶": ["🐶", "🐱", "🐭", "🐹", "🐰", "🦊", "🐻", "🐼", "🐨", "🐯"],
  "🍎": ["🍎", "🍊", "🍌", "🍇", "🍓", "🍒", "🍑", "🥝", "🍍", "🥭"],
  "⚽": ["⚽", "🏀", "🏈", "⚾", "🎾", "🏐", "🏉", "🎱", "🏓", "🏸"],
  "🚗": ["🚗", "🚕", "🚙", "🚌", "🚎", "🏎️", "🚓", "🚑", "🚒", "🚐"],
  "🌍": ["🌍", "🌎", "🌏", "🌕", "🌖", "🌗", "🌘", "🌑", "🌒", "🌓"],
  "💯": ["💯", "💥", "💫", "💦", "💨", "🕳️", "💣", "💤", "💢", "💬"]
};

const categoryNames = {
  "😀": "Smileys",
  "❤️": "Hearts", 
  "👍": "Gestures",
  "🎉": "Celebration",
  "🐶": "Animals",
  "🍎": "Food",
  "⚽": "Sports",
  "🚗": "Transport",
  "🌍": "Nature",
  "💯": "Symbols"
};

export default function EmojiPicker({ onEmojiSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState("😀");

  const handleEmojiClick = (emoji) => {
    onEmojiSelect(emoji);
    onClose();
  };

  return (
    <div className="absolute bottom-full right-0 mb-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl w-80 z-50">
      {/* Header */}
      <div className="p-3 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <h3 className="font-medium text-gray-900 dark:text-white">Choose Emoji</h3>
          <button
            onClick={onClose}
            className="w-6 h-6 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1 p-2 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {Object.keys(emojiCategories).map((category) => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`p-2 rounded-lg text-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
              activeCategory === category 
                ? "bg-sky-100 dark:bg-sky-900" 
                : ""
            }`}
            title={categoryNames[category]}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Emoji Grid */}
      <div className="p-3 max-h-48 overflow-y-auto">
        <div className="grid grid-cols-8 gap-2">
          {emojiCategories[activeCategory].map((emoji, index) => (
            <button
              key={`${emoji}-${index}`}
              onClick={() => handleEmojiClick(emoji)}
              className="w-8 h-8 text-lg hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex items-center justify-center"
              title={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      </div>

      {/* Footer with recently used */}
      <div className="p-2 border-t border-gray-200 dark:border-gray-700 text-center">
        <span className="text-xs text-gray-500 dark:text-gray-400">
          Click an emoji to add it to your message
        </span>
      </div>
    </div>
  );
}