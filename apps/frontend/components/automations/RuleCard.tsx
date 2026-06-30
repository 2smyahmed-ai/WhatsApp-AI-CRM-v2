import { Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';

interface AutomationRule {
  id: string;
  name: string;
  trigger: string;
  keyword: string | null;
  response: string;
  isActive: boolean;
  createdAt: string;
}

interface RuleCardProps {
  rule: AutomationRule;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggle?: () => void;
}

export default function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
  const { t } = useTranslation('automations');

  const getTriggerLabel = (trigger: string) => {
    return (t as any)(`triggers.${trigger}`, { defaultValue: trigger });
  };

  return (
    <div className="rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] p-6 shadow-soft dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)] transition hover:-translate-y-0.5 hover:bg-gray-50 dark:hover:bg-[#202C33]">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white">{rule.name}</h3>
        <div className="flex items-center space-x-2">
          {onToggle && (
            <button
              type="button"
              onClick={onToggle}
              className={`rounded-full p-1 transition ${rule.isActive ? 'text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]'}`}
            >
              {rule.isActive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </button>
          )}
          {!onToggle && (
            <span className={`${rule.isActive ? 'text-[#25D366]' : 'text-gray-400 dark:text-[#8696A0]'}`}>
              {rule.isActive ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </span>
          )}
          {onEdit && (
            <button type="button" onClick={onEdit} className="p-1 text-gray-500 dark:text-[#8696A0] transition hover:text-[#25D366] dark:hover:text-[#25D366]">
              <Edit className="h-4 w-4" />
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} className="p-1 text-red-500 dark:text-rose-400 transition hover:text-red-600 dark:hover:text-rose-300">
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-600 dark:text-[#8696A0]">{t('card.trigger')}:</span>
          <span className="ml-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-2 py-1 text-xs text-[#25D366]">
            {getTriggerLabel(rule.trigger)}
          </span>
        </div>

        {rule.keyword && (
          <div className="flex items-center">
            <span className="text-sm font-medium text-gray-600 dark:text-[#8696A0]">{t('card.keyword')}:</span>
            <span className="ml-2 text-sm text-gray-900 dark:text-white">&quot;{rule.keyword}&quot;</span>
          </div>
        )}

        <div>
          <span className="text-sm font-medium text-gray-600 dark:text-[#8696A0]">{t('card.response')}:</span>
          <p className="mt-1 line-clamp-2 text-sm text-gray-900 dark:text-white">{rule.response}</p>
        </div>
      </div>
    </div>
  );
}

