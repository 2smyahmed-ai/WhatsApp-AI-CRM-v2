'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useTags, type Tag } from '../../hooks/useTags';
import ContactTagSelector from './ContactTagSelector';
import { Modal } from '../ui/modal';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  notes: string | null;
  createdAt: string;
}

interface ContactFormProps {
  contact: Contact | null;
  onSave: (contact: Partial<Contact> & { tagIds?: string[] }) => void;
  onCancel: () => void;
}

export default function ContactForm({ contact, onSave, onCancel }: ContactFormProps) {
  const { t } = useTranslation('contacts');
  const allTags = useTags();
  const [formData, setFormData] = useState({
    phone: contact?.phone || '',
    name: contact?.name || '',
    notes: contact?.notes || '',
  });
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);

  const toggleTag = (id: string) =>
    setSelectedTagIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({ ...formData, ...(contact ? {} : { tagIds: selectedTagIds }) });
  };

  const inputCls =
    'mt-1 block w-full rounded-md border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] py-2 px-3 text-sm text-gray-900 dark:text-white shadow-sm focus:border-[#25D366] focus:outline-none focus:ring-1 focus:ring-[#25D366]';
  const labelCls = 'block text-sm font-medium text-gray-700 dark:text-white';

  return (
    <Modal
      open
      onClose={onCancel}
      aria-label={contact ? t('form.editTitle') : t('form.createTitle')}
      overlayClassName="items-start overflow-y-auto bg-black/70"
      className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-white/10 w-96 shadow-lg rounded-2xl bg-white dark:bg-[#111B21]"
    >
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {contact ? t('form.editTitle') : t('form.createTitle')}
          </h3>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Phone */}
            <div>
              <label className={labelCls}>{t('form.phone')}</label>
              <input
                type="text"
                required
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Name */}
            <div>
              <label className={labelCls}>{t('form.name')}</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={inputCls}
              />
            </div>

            {/* Tags */}
            <div>
              <label className={labelCls}>{t('form.tags')}</label>

              {contact ? (
                /* Edit mode — ContactTagSelector handles its own API calls */
                <div className="mt-2">
                  <ContactTagSelector contactId={contact.id} />
                </div>
              ) : (
                /* Create mode — chip picker that collects IDs for after creation */
                <div className="mt-2">
                  {allTags.length === 0 ? (
                    <p className="text-xs text-gray-400 dark:text-[#8696A0]">
                      No tags yet — create them in the Tags page.
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((tag: Tag) => {
                        const selected = selectedTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-all border ${
                              selected
                                ? 'text-white border-transparent'
                                : 'text-gray-600 dark:text-gray-300 border-gray-200 dark:border-white/15 hover:border-gray-300 dark:hover:border-white/30'
                            }`}
                            style={selected ? { backgroundColor: tag.color } : {}}
                          >
                            <span
                              className="h-2 w-2 rounded-full shrink-0"
                              style={{ backgroundColor: tag.color }}
                            />
                            {tag.name}
                            {selected && <X className="h-2.5 w-2.5 opacity-80" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>{t('form.notes')}</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white bg-gray-100 dark:bg-[#202C33] border border-gray-300 dark:border-white/10 rounded-md hover:bg-gray-200 dark:hover:bg-white/10 focus:outline-none"
              >
                {t('form.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#25D366] rounded-md hover:bg-[#25D366]/90 focus:outline-none"
              >
                {t('form.save')}
              </button>
            </div>
          </form>
        </div>
    </Modal>
  );
}
