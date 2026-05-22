'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tag: string | null;
}

interface BroadcastFormProps {
  contacts: Contact[];
  initialValues?: {
    name: string;
    message: string;
    recipients: string[];
    tag?: string;
    scheduledAt?: string;
  };
  submitLabel?: string;
  onSave: (broadcast: {
    name: string;
    message: string;
    recipients: string[];
    tag?: string;
    scheduledAt?: Date;
  }) => void;
}

export default function BroadcastForm({ contacts, initialValues, submitLabel = 'Create Broadcast', onSave }: BroadcastFormProps) {
  const initialRecipientSet = Array.from(new Set(initialValues?.recipients ?? []));
  const [formData, setFormData] = useState({
    name: initialValues?.name ?? '',
    message: initialValues?.message ?? '',
    tag: initialValues?.tag ?? '',
    scheduledAt: initialValues?.scheduledAt ?? '',
    sendNow: !initialValues?.scheduledAt,
  });

  const [selectedContacts, setSelectedContacts] = useState<string[]>(initialRecipientSet);
  const [manualPhones, setManualPhones] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; content: string }>>([]);

  useEffect(() => {
    api.get('/api/templates').then((data: any) => setTemplates(Array.isArray(data) ? data : [])).catch(() => {});
  }, []);

  const normalizePhoneList = (value: string) =>
    value
      .split('\n')
      .map((phone) => phone.trim())
      .filter(Boolean);

  const normalizeTag = (value: string) => value.trim().toLowerCase();

  const resolvedAudience = useMemo(() => {
    const selectedRecipientList = selectedContacts;
    const manualRecipientList = normalizePhoneList(manualPhones);
    const tagValue = formData.tag.trim();
    const tagMatches = tagValue
      ? contacts.filter((contact) =>
          (contact.tag ?? '')
            .split(',')
            .map((value) => normalizeTag(value))
            .includes(normalizeTag(tagValue)),
        )
      : [];

    const audienceMap = new Map<string, { phone: string; name: string | null; source: 'selected' | 'manual' | 'tag' }>();

    selectedRecipientList.forEach((phone) => {
      const contact = contacts.find((entry) => entry.phone === phone);
      audienceMap.set(phone, {
        phone,
        name: contact?.name ?? null,
        source: 'selected',
      });
    });

    manualRecipientList.forEach((phone) => {
      if (!audienceMap.has(phone)) {
        audienceMap.set(phone, {
          phone,
          name: null,
          source: 'manual',
        });
      }
    });

    tagMatches.forEach((contact) => {
      if (!audienceMap.has(contact.phone)) {
        audienceMap.set(contact.phone, {
          phone: contact.phone,
          name: contact.name,
          source: 'tag',
        });
      }
    });

    return {
      count: audienceMap.size,
      selectedCount: selectedRecipientList.length,
      manualCount: manualRecipientList.length,
      tagCount: tagMatches.length,
      preview: Array.from(audienceMap.values()).slice(0, 8),
    };
  }, [contacts, formData.tag, manualPhones, selectedContacts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const recipients = Array.from(new Set([...selectedContacts, ...normalizePhoneList(manualPhones)]));

    if (!recipients.length && !formData.tag.trim()) {
      setError('Please select at least one recipient.');
      return;
    }

    if (!formData.sendNow && !formData.scheduledAt) {
      setError('Please choose a schedule time or send immediately.');
      return;
    }

    onSave({
      name: formData.name,
      message: formData.message,
      recipients,
      tag: formData.tag.trim() || undefined,
      scheduledAt: formData.sendNow ? undefined : new Date(formData.scheduledAt),
    });
  };

  const toggleContact = (phone: string) => {
    setSelectedContacts(prev =>
      prev.includes(phone)
        ? prev.filter(p => p !== phone)
        : [...prev, phone]
    );
  };

  const selectByTag = (tag: string) => {
    const taggedContacts = contacts
      .filter((c) => (c.tag ?? '').split(',').map((value) => value.trim()).includes(tag))
      .map((c) => c.phone);
    setSelectedContacts(prev => Array.from(new Set([...prev, ...taggedContacts])));
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-[#111B21] rounded-2xl border border-gray-200 dark:border-white/10 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)] p-6 space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white">Broadcast Name</label>
        <input
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
          placeholder="e.g., Product Launch Announcement"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-700 dark:text-white">Message</label>
          {templates.length > 0 && (
            <select
              className="text-xs rounded-lg border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-2 py-1 text-gray-700 dark:text-white focus:outline-none focus:border-[#25D366]"
              defaultValue=""
              onChange={(e) => {
                const t = templates.find((tmpl) => tmpl.id === e.target.value);
                if (t) setFormData((prev) => ({ ...prev, message: t.content }));
                e.target.value = '';
              }}
            >
              <option value="">Use a template…</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          )}
        </div>
        <textarea
          required
          rows={4}
          value={formData.message}
          onChange={(e) => setFormData({ ...formData, message: e.target.value })}
          className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
          placeholder="Enter your broadcast message… or pick a template above"
        />
        <p className="mt-1 text-xs text-gray-500 dark:text-[#8696A0]">
          {formData.message.length} characters · variables like {'{{name}}'} are replaced per recipient
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Recipients</label>

        <div className="space-y-4">
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Quick tag select</h4>
            <div className="flex flex-wrap gap-2">
              {Array.from(
                new Set(
                  contacts.flatMap((contact) =>
                    (contact.tag ?? '')
                      .split(',')
                      .map((value) => value.trim())
                      .filter(Boolean),
                  ),
                ),
              ).map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => selectByTag(tag)}
                  className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Select from contacts</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded p-2">
              {contacts.map((contact) => (
                <label key={contact.id} className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedContacts.includes(contact.phone)}
                    onChange={() => toggleContact(contact.phone)}
                    className="mr-2"
                  />
                  <span className="text-sm text-gray-900 dark:text-white">
                    {contact.name || contact.phone}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-2">Or add phone numbers manually</h4>
            <textarea
              rows={3}
              value={manualPhones}
              onChange={(e) => setManualPhones(e.target.value)}
              className="block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              placeholder="One phone number per line&#10;+1234567890&#10;+0987654321"
            />
          </div>
        </div>

        <div className="mt-3 rounded-2xl border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">Resolved audience</p>
              <p className="mt-1 text-xs text-gray-600 dark:text-[#8696A0]">
                Selected contacts, manual numbers, and tag matches are deduped before sending.
              </p>
            </div>
            <div className="rounded-full border border-emerald-300 dark:border-emerald-400/20 bg-emerald-100 dark:bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-100">
              {resolvedAudience.count} unique recipient{resolvedAudience.count === 1 ? '' : 's'}
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-[#8696A0]">Selected</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{resolvedAudience.selectedCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-[#8696A0]">Manual</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{resolvedAudience.manualCount}</p>
            </div>
            <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-[#8696A0]">Tag matches</p>
              <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">{resolvedAudience.tagCount}</p>
            </div>
          </div>

          {resolvedAudience.preview.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {resolvedAudience.preview.map((recipient) => (
                <span
                  key={recipient.phone}
                  className="inline-flex items-center gap-2 rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-gray-700 dark:text-white"
                >
                  <span className="font-medium text-gray-900 dark:text-white">{recipient.name ?? recipient.phone}</span>
                  <span className="text-gray-500 dark:text-[#8696A0]">
                    {recipient.source === 'tag' ? 'tag' : recipient.source === 'manual' ? 'manual' : 'selected'}
                  </span>
                </span>
              ))}
              {resolvedAudience.count > resolvedAudience.preview.length && (
                <span className="inline-flex items-center rounded-full border border-gray-200 dark:border-white/10 bg-white dark:bg-white/5 px-3 py-1.5 text-xs text-gray-600 dark:text-[#8696A0]">
                  +{resolvedAudience.count - resolvedAudience.preview.length} more
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Schedule</label>
        <div className="space-y-2">
          <label className="flex items-center">
            <input
              type="radio"
              name="schedule"
              checked={formData.sendNow}
              onChange={() => setFormData({ ...formData, sendNow: true })}
              className="mr-2"
            />
            Send immediately
          </label>
          <label className="flex items-center">
            <input
              type="radio"
              name="schedule"
              checked={!formData.sendNow}
              onChange={() => setFormData({ ...formData, sendNow: false })}
              className="mr-2"
            />
            Schedule for later
          </label>
          {!formData.sendNow && (
            <input
              type="datetime-local"
              value={formData.scheduledAt}
              onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
              className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
            />
          )}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-white">Tag filter</label>
        <input
          type="text"
          value={formData.tag}
          onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
          className="mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2 shadow-sm text-gray-900 dark:text-white focus:border-[#25D366] focus:outline-none focus:ring-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
          placeholder="Optional: send to all contacts with this tag"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-[#8696A0]">
          If you enter a tag, the backend will resolve matching contacts automatically.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={!selectedContacts.length && !normalizePhoneList(manualPhones).length && !formData.tag.trim()}
          className="px-6 py-2 bg-[#25D366] dark:bg-[#25D366] text-white dark:text-white rounded-md hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90 focus:outline-none focus:ring-2 focus:ring-[#25D366] focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitLabel}
        </button>
      </div>
    </form>
  );
}
