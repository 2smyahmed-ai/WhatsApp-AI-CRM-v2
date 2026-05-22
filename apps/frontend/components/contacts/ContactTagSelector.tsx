'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';

interface Tag {
  id: string;
  name: string;
  color: string;
}

interface Props {
  contactId: string;
  initialTags?: Tag[];
  onChanged?: () => void;
}

export default function ContactTagSelector({ contactId, initialTags = [], onChanged }: Props) {
  const [contactTags, setContactTags] = useState<Tag[]>(initialTags);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get('/api/tags').then((data: any) => setAllTags(Array.isArray(data) ? data : [])).catch(() => {});
    api.get(`/api/tags/contacts/${contactId}`).then((data: any) => setContactTags(Array.isArray(data) ? data : [])).catch(() => {});
  }, [contactId]);

  // Sync tag list changes from other agents
  useSocket('tag:created', useCallback((tag: Tag) => {
    setAllTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
  }, []));

  useSocket('tag:updated', useCallback((tag: Tag) => {
    setAllTags((prev) => prev.map((t) => t.id === tag.id ? tag : t));
    setContactTags((prev) => prev.map((t) => t.id === tag.id ? tag : t));
  }, []));

  useSocket('tag:deleted', useCallback(({ tagId }: { tagId: string }) => {
    setAllTags((prev) => prev.filter((t) => t.id !== tagId));
    setContactTags((prev) => prev.filter((t) => t.id !== tagId));
  }, []));

  // Sync contact tag add/remove from other agents
  useSocket('contact:tag_added', useCallback((data: { contactId: string; tagId: string }) => {
    if (data.contactId !== contactId) return;
    const tag = allTags.find((t) => t.id === data.tagId);
    if (tag) setContactTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
  }, [contactId, allTags]));

  useSocket('contact:tag_removed', useCallback((data: { contactId: string; tagId: string }) => {
    if (data.contactId !== contactId) return;
    setContactTags((prev) => prev.filter((t) => t.id !== data.tagId));
  }, [contactId]));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const addTag = async (tag: Tag) => {
    try {
      await api.post(`/api/tags/contacts/${contactId}/tags/${tag.id}`, {});
      setContactTags((prev) => (prev.find((t) => t.id === tag.id) ? prev : [...prev, tag]));
      onChanged?.();
    } catch {}
  };

  const removeTag = async (tagId: string) => {
    try {
      await api.delete(`/api/tags/contacts/${contactId}/tags/${tagId}`);
      setContactTags((prev) => prev.filter((t) => t.id !== tagId));
      onChanged?.();
    } catch {}
  };

  const createAndAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const tag = await api.post('/api/tags', { name }) as Tag;
      setAllTags((prev) => [...prev, tag]);
      await addTag(tag);
      setNewName('');
    } catch {}
  };

  const unselected = allTags.filter((t) => !contactTags.find((ct) => ct.id === t.id));

  return (
    <div ref={ref} className="relative">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {contactTags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium text-white"
            style={{ backgroundColor: tag.color }}
          >
            {tag.name}
            <button
              type="button"
              onClick={() => removeTag(tag.id)}
              className="opacity-70 hover:opacity-100 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 dark:border-white/20 px-2 py-0.5 text-xs text-gray-500 dark:text-[#8696A0] hover:border-[#25D366] hover:text-[#25D366] transition-colors"
        >
          <Plus className="h-3 w-3" />
          Add tag
        </button>
      </div>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#1C2B33] shadow-lg">
          <div className="p-2 border-b border-gray-100 dark:border-white/5">
            <div className="flex gap-1">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && createAndAdd()}
                placeholder="New tag name..."
                className="flex-1 rounded-lg border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#111B21] px-2 py-1 text-xs text-gray-900 dark:text-white focus:outline-none"
              />
              <button
                type="button"
                onClick={createAndAdd}
                className="rounded-lg bg-[#25D366] px-2 py-1 text-xs text-white hover:bg-[#25D366]/90"
              >
                Create
              </button>
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto p-1">
            {unselected.length === 0 && (
              <p className="px-2 py-2 text-xs text-gray-400 dark:text-[#8696A0]">All tags assigned</p>
            )}
            {unselected.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => addTag(tag)}
                className="w-full flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors"
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: tag.color }}
                />
                {tag.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
