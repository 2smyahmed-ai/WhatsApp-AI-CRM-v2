'use client';

import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal } from '../ui/modal';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  keyword: string | null;
  response: string;
  isActive: boolean;
  createdAt: string;
}

interface RuleFormProps {
  rule: AutomationRule | null;
  onSave: (rule: Partial<AutomationRule>) => void;
  onCancel: () => void;
}

export default function RuleForm({ rule, onSave, onCancel }: RuleFormProps) {
  const { t } = useTranslation('automations');
  const [formData, setFormData] = useState({
    name: rule?.name || '',
    trigger: rule?.trigger || 'KEYWORD',
    keyword: rule?.keyword || '',
    response: rule?.response || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <Modal
      open
      onClose={onCancel}
      aria-label={rule ? t('form.editTitle') : t('form.createTitle')}
      overlayClassName="items-start overflow-y-auto bg-black/70"
      className="relative top-20 mx-auto p-5 border border-gray-200 dark:border-white/10 w-96 shadow-lg rounded-2xl bg-white dark:bg-[#111B21]"
    >
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
            {rule ? t('form.editTitle') : t('form.createTitle')}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">{t('form.name')}</label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">{t('form.trigger')}</label>
              <select
                value={formData.trigger}
                onChange={(e) => setFormData({ ...formData, trigger: e.target.value })}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              >
                <option value="KEYWORD">{t('triggers.KEYWORD')}</option>
                <option value="FIRST_MESSAGE">{t('triggers.FIRST_MESSAGE')}</option>
                <option value="ANY_MESSAGE">{t('triggers.ANY_MESSAGE')}</option>
                <option value="OUTSIDE_HOURS">{t('triggers.OUTSIDE_HOURS')}</option>
              </select>
            </div>

            {formData.trigger === 'KEYWORD' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-white">{t('form.keyword')}</label>
                <input
                  type="text"
                  required
                  value={formData.keyword}
                  onChange={(e) => setFormData({ ...formData, keyword: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-white">{t('form.response')}</label>
              <textarea
                required
                rows={4}
                value={formData.response}
                onChange={(e) => setFormData({ ...formData, response: e.target.value })}
                className="mt-1 block w-full border border-gray-300 dark:border-white/10 bg-white dark:bg-[#202C33] rounded-md shadow-sm py-2 px-3 text-gray-900 dark:text-white focus:outline-none focus:ring-[#25D366] focus:border-[#25D366] dark:focus:ring-[#25D366] dark:focus:border-[#25D366]"
              />
            </div>

            <div className="flex justify-end space-x-2">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-white bg-gray-100 dark:bg-[#202C33] border border-gray-300 dark:border-white/10 rounded-md shadow-sm hover:bg-gray-200 dark:hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366] dark:focus:ring-[#25D366]"
              >
                {t('form.cancel')}
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-[#25D366] dark:bg-[#25D366] border border-transparent rounded-md shadow-sm hover:bg-[#25D366]/90 dark:hover:bg-[#25D366]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#25D366] dark:focus:ring-[#25D366]"
              >
                {t('form.save')}
              </button>
            </div>
          </form>
        </div>
    </Modal>
  );
}

