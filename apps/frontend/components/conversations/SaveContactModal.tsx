'use client';

import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../lib/api';

interface SaveContactModalProps {
  isOpen: boolean;
  onClose: () => void;
  phone: string;
  name?: string | null;
  onSuccess?: () => void;
}

export default function SaveContactModal({ isOpen, onClose, phone, name, onSuccess }: SaveContactModalProps) {
  const [contactName, setContactName] = useState(name || '');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);

    try {
      await api.post('/api/contacts', {
        phone,
        name: contactName,
      });
      setContactName('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save contact');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#111B21] shadow-lg">
        <div className="flex items-center justify-between border-b border-gray-200 dark:border-white/10 px-6 py-4">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Save Contact</h2>
          <button
            onClick={onClose}
            className="text-gray-500 dark:text-[#8696A0] hover:text-gray-700 dark:hover:text-white"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white">Phone Number</label>
            <input
              type="text"
              value={phone}
              disabled
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] px-3 py-2 text-gray-900 dark:text-white opacity-60 cursor-not-allowed"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-white">Contact Name</label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="Enter contact name"
              className="mt-1 block w-full rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#25D366]"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2 text-sm text-red-700 dark:text-red-200">
              {error}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-lg border border-gray-300 dark:border-white/10 bg-white dark:bg-transparent px-4 py-2 text-sm font-medium text-gray-700 dark:text-white transition hover:bg-gray-50 dark:hover:bg-white/5"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex-1 rounded-lg bg-[#25D366] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#25D366]/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSaving ? 'Saving...' : 'Save Contact'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
