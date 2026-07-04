'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslation } from 'react-i18next';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import BroadcastForm from '../../../../../components/broadcasts/BroadcastForm';
import { api } from '../../../../../lib/api';
import { useDirection } from '../../../../../hooks/useDirection';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  contactTags?: { tag: { id: string; name: string; color: string } }[];
}

interface Broadcast {
  id: string;
  name: string;
  message: string;
  scheduledAt: string | null;
  recipients: { phone: string }[];
  mediaUrl?: string | null;
  mediaType?: string | null;
  mediaFilename?: string | null;
}

export default function EditBroadcastPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const { t } = useTranslation('broadcasts');
  const { isRTL: isRtl } = useDirection();
  const BackIcon = isRtl ? ArrowRight : ArrowLeft;
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [broadcast, setBroadcast] = useState<Broadcast | null>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await api.get('/api/contacts');
      setContacts(Array.isArray(data) ? data : []);
    } catch {
      setContacts([]);
    }
  }, []);

  const fetchBroadcast = useCallback(async () => {
    if (!params?.id) return;
    const data = await api.get(`/api/broadcasts/${params.id}`);
    setBroadcast(data);
  }, [params]);

  useEffect(() => {
    fetchContacts();
    fetchBroadcast();
  }, [fetchContacts, fetchBroadcast]);

  const handleSave = async (values: {
    name: string;
    message: string;
    recipients: string[];
    scheduledAt?: Date;
    interactiveContent?: object;
    mediaUrl?: string;
    mediaType?: string;
    mediaFilename?: string;
  }) => {
    if (!params?.id) return;
    await api.put(`/api/broadcasts/${params.id}`, values);
    router.push('/broadcasts');
  };

  return (
    <div className="space-y-6">
      {/* Page header — hidden on mobile (wizard handles its own back navigation) */}
      <div className="hidden sm:flex items-center gap-4">
        <Link
          href="/broadcasts"
          className="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <BackIcon className="h-4 w-4" />
          {t('back')}
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">{t('form.editTitle')}</h1>
          <p className="text-[#8696A0]">{t('form.editSubtitle')}</p>
        </div>
      </div>

      {broadcast ? (
        <BroadcastForm
          contacts={contacts}
          initialValues={{
            name: broadcast.name,
            message: broadcast.message,
            recipients: broadcast.recipients.map(recipient => recipient.phone),
            scheduledAt: broadcast.scheduledAt ? new Date(broadcast.scheduledAt).toISOString().slice(0, 16) : '',
            mediaUrl: broadcast.mediaUrl ?? undefined,
            mediaType: broadcast.mediaType ?? undefined,
            mediaFilename: broadcast.mediaFilename ?? undefined,
          }}
          submitLabel={t('form.saveChanges')}
          onBack={() => router.push('/broadcasts')}
          onSave={handleSave}
        />
      ) : (
        <div className="rounded-lg bg-white dark:bg-[#111B21] p-6 shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)] text-gray-900 dark:text-white">{t('form.loading')}</div>
      )}
      {/* Mobile bottom-nav spacer */}
      <div aria-hidden="true" className="h-[var(--bottom-nav-space)] sm:hidden" />
    </div>
  );
}
