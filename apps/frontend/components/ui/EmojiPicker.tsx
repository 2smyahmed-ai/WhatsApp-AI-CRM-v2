'use client';

import { useEffect, useRef, useState } from 'react';

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
  {
    label: '😊 Smileys',
    emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐','😑','😶','😏','😒','🙄','😬','😔','😪','🤤','😴','😷','🤒','🤕','🤢','🤮','🤧','🥵','🥶','🥴','😵','🤯','😲','😳','🥺','😢','😭','😤','😠','😡','🤬','😈','💀','☠️','💩','🤡','👹','👺','👻','👽','🤖','😺','😸','😹','😻','😼','😽','🙀','😿','😾'],
  },
  {
    label: '👍 Gestures',
    emojis: ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🫀','🫁','🧠','🦷','🦴','👀','👁','👅','👄','💋','🩸'],
  },
  {
    label: '❤️ Hearts',
    emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','☮️','✝️','☪️','🔯','☸️','✡️','🕉','☯️','♾','♻️','🔱','⚜️','🔰','💠'],
  },
  {
    label: '🎉 Fun',
    emojis: ['🎉','🎊','🎈','🎁','🎀','🎗','🎟','🎫','🎖','🏆','🥇','🥈','🥉','⚽','🏀','🏈','⚾','🎾','🏐','🏉','🎱','🏓','🏸','🥊','🥋','🎽','🎿','🛷','🥌','🎯','🎲','🎮','🕹','🃏','🀄','🎴','🎭','🎨','🖼','🎰','🚂','🚃','🚄','🚅','🚆','🚇','🚈','🚉','🚊','🚝','🚞'],
  },
  {
    label: '🌍 Nature',
    emojis: ['🌸','🌹','🌺','🌻','🌼','🌷','🌱','🌿','☘️','🍀','🎍','🎋','🍃','🍂','🍁','🍄','🌾','💐','🌊','🌬','🌀','🌈','☀️','🌤','⛅','🌥','☁️','🌦','🌧','⛈','🌩','🌨','❄️','☃️','⛄','🌬','💨','💧','💦','🌊','🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐨','🐯','🦁','🐮','🐷','🐸','🐵','🐔','🐧','🐦','🦆','🦅','🦉','🦇','🐺','🐗','🐴','🦄','🐝','🐛','🦋','🐌','🐞','🐜'],
  },
  {
    label: '🍕 Food',
    emojis: ['🍎','🍊','🍋','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥','🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶','🫑','🧄','🧅','🥔','🍠','🥐','🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🦴','🌭','🍔','🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🫕','🥫','🍝','🍜','🍲','🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥮','🍢','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🧃','🥤','🧋','☕','🍵','🧉','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🧊'],
  },
];

interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose: () => void;
}

export default function EmojiPicker({ onSelect, onClose }: EmojiPickerProps) {
  const [activeCategory, setActiveCategory] = useState(0);
  const [search, setSearch] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const filtered = search.trim()
    ? EMOJI_CATEGORIES.flatMap((c) => c.emojis).filter((e) => e.includes(search))
    : EMOJI_CATEGORIES[activeCategory].emojis;

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full mb-2 left-0 z-50 w-72 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] shadow-xl overflow-hidden"
    >
      {/* Search */}
      <div className="p-2 border-b border-gray-100 dark:border-white/10">
        <input
          autoFocus
          type="text"
          placeholder="Search emoji…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-3 py-1.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8696A0] outline-none focus:border-[#25D366]"
        />
      </div>

      {/* Category tabs */}
      {!search && (
        <div className="flex overflow-x-auto border-b border-gray-100 dark:border-white/10">
          {EMOJI_CATEGORIES.map((cat, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveCategory(i)}
              className={`shrink-0 px-3 py-2 text-base transition-colors ${
                activeCategory === i ? 'bg-[#25D366]/10' : 'hover:bg-gray-50 dark:hover:bg-white/5'
              }`}
              title={cat.label}
            >
              {cat.emojis[0]}
            </button>
          ))}
        </div>
      )}

      {/* Emoji grid */}
      <div className="grid grid-cols-8 gap-0 p-2 max-h-48 overflow-y-auto">
        {filtered.map((emoji, i) => (
          <button
            key={i}
            type="button"
            onClick={() => { onSelect(emoji); }}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-gray-100 dark:hover:bg-white/10 transition-colors"
          >
            {emoji}
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="col-span-8 py-4 text-center text-xs text-gray-400 dark:text-[#8696A0]">No results</p>
        )}
      </div>
    </div>
  );
}
