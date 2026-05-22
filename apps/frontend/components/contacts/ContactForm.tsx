import { useState } from 'react';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tag: string | null;
  notes: string | null;
  createdAt: string;
}

interface ContactFormProps {
  contact: Contact | null;
  onSave: (contact: Partial<Contact>) => void;
  onCancel: () => void;
}

export default function ContactForm({ contact, onSave, onCancel }: ContactFormProps) {
  const [formData, setFormData] = useState({
    phone: contact?.phone || '',
    name: contact?.name || '',
    tag: contact?.tag || '',
    notes: contact?.notes || '',
  });

  const normalizedTags = formData.tag
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/70 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-white/10 w-96 shadow-lg rounded-2xl bg-white dark:bg-[#111B21]">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {contact ? 'Edit Contact' : 'Add Contact'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">Phone</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">Name</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">Tags</label>
              <input
                type="text"
                value={formData.tag}
                onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                placeholder="VIP, Lead, Hot"
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
              {normalizedTags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {normalizedTags.map((tag) => (
                    <span key={tag} className="rounded-full bg-[#25D366]/10 dark:bg-[#25D366]/15 px-2.5 py-1 text-xs text-[#25D366]">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">Notes</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
            </div>
            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white bg-gray-100 dark:bg-[#202C33] border border-gray-300 dark:border-white/10 rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366] dark:focus:ring-[#25D366]"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#25D366] dark:bg-[#25D366] border border-transparent rounded-md shadow-sm hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366] dark:focus:ring-[#25D366]"
              >
                Save
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
