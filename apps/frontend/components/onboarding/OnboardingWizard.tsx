'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Circle, ChevronRight, X, Wifi, UserPlus, MessageSquare, Zap } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/api';

const STORAGE_KEY = 'crm_onboarding_dismissed';

export default function OnboardingWizard() {
  const { t } = useTranslation('common');
  const router = useRouter();

  const STEPS = [
    {
      id: 'connect_wa',
      icon: Wifi,
      title: t('onboarding.connectWa.title'),
      description: t('onboarding.connectWa.description'),
      action: t('onboarding.connectWa.action'),
      href: '/settings',
    },
    {
      id: 'add_contact',
      icon: UserPlus,
      title: t('onboarding.addContact.title'),
      description: t('onboarding.addContact.description'),
      action: t('onboarding.addContact.action'),
      href: '/contacts',
    },
    {
      id: 'send_message',
      icon: MessageSquare,
      title: t('onboarding.sendMessage.title'),
      description: t('onboarding.sendMessage.description'),
      action: t('onboarding.sendMessage.action'),
      href: '/conversations',
    },
    {
      id: 'create_automation',
      icon: Zap,
      title: t('onboarding.createAutomation.title'),
      description: t('onboarding.createAutomation.description'),
      action: t('onboarding.createAutomation.action'),
      href: '/automations',
    },
  ];
  const [visible, setVisible] = useState(false);
  const [completedSteps, setCompleted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (localStorage.getItem(STORAGE_KEY)) return;

    async function checkProgress() {
      try {
        const [statusData, contactData, convData, autoData] = await Promise.all([
          api.get('/api/whatsapp/status').catch(() => ({ status: 'disconnected' })),
          api.get('/api/contacts').catch(() => []),
          api.get('/api/conversations').catch(() => []),
          api.get('/api/automations').catch(() => []),
        ]);

        const done = new Set<string>();
        if (statusData?.status === 'connected') done.add('connect_wa');
        if (Array.isArray(contactData) && contactData.length > 0) done.add('add_contact');
        if (Array.isArray(convData) && convData.length > 0) done.add('send_message');
        if ((Array.isArray(autoData?.rules) && autoData.rules.length > 0) ||
            (Array.isArray(autoData?.flows) && autoData.flows.length > 0) ||
            (Array.isArray(autoData) && autoData.length > 0)) {
          done.add('create_automation');
        }

        setCompleted(done);

        // Show wizard only if not all steps complete
        if (done.size < STEPS.length) setVisible(true);
      } catch { /* ignore */ }
      finally { setLoading(false); }
    }

    void checkProgress();
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setVisible(false);
  }

  if (!visible || loading) return null;

  const allDone = completedSteps.size >= STEPS.length;

  return (
    <div className="fixed bottom-6 right-6 z-50 w-80 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-2xl overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between bg-gradient-to-r from-[#25D366] to-[#128C7E] px-4 py-3">
        <div>
          <p className="text-sm font-bold text-white">{t('onboarding.title')}</p>
          <p className="text-xs text-white/80">{t('onboarding.stepsProgress', { done: completedSteps.size, total: STEPS.length })}</p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg p-1 text-white/70 hover:bg-white/20 transition-colors"
          aria-label={t('onboarding.dismissLabel')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="h-1 bg-gray-100 dark:bg-white/10">
        <div
          className="h-1 bg-[#25D366] transition-all duration-500"
          style={{ width: `${(completedSteps.size / STEPS.length) * 100}%` }}
        />
      </div>

      {/* Steps */}
      <div className="divide-y divide-gray-100 dark:divide-white/5">
        {STEPS.map((step) => {
          const done = completedSteps.has(step.id);
          const Icon = step.icon;
          return (
            <div key={step.id} className={`flex items-start gap-3 px-4 py-3 ${done ? 'opacity-60' : ''}`}>
              <div className="mt-0.5 shrink-0">
                {done
                  ? <CheckCircle2 className="h-5 w-5 text-[#25D366]" />
                  : <Circle className="h-5 w-5 text-gray-300 dark:text-white/20" />
                }
              </div>
              <div className="min-w-0 flex-1">
                <p className={`text-sm font-medium ${done ? 'line-through text-gray-400 dark:text-[#8696A0]' : 'text-gray-900 dark:text-white'}`}>
                  {step.title}
                </p>
                {!done && (
                  <p className="text-xs text-gray-500 dark:text-[#8696A0] mt-0.5">{step.description}</p>
                )}
              </div>
              {!done && (
                <button
                  type="button"
                  onClick={() => router.push(step.href)}
                  className="shrink-0 mt-0.5 rounded-lg bg-[#25D366]/10 px-2 py-1 text-xs font-medium text-[#25D366] hover:bg-[#25D366]/20 transition-colors flex items-center gap-1"
                >
                  {t('onboarding.go')} <ChevronRight className="h-3 w-3" />
                </button>
              )}
            </div>
          );
        })}
      </div>

      {allDone && (
        <div className="px-4 py-3 bg-[#25D366]/10 text-center">
          <p className="text-sm font-semibold text-[#25D366]">{t('onboarding.allDone')}</p>
          <button
            type="button"
            onClick={dismiss}
            className="mt-2 text-xs text-gray-500 dark:text-[#8696A0] hover:underline"
          >
            {t('onboarding.dismiss')}
          </button>
        </div>
      )}
    </div>
  );
}
