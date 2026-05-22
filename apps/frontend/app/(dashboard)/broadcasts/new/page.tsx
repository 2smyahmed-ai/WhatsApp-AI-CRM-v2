'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import BroadcastForm from '../../../../components/broadcasts/BroadcastForm';
import { api } from '../../../../lib/api';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tag: string | null;
}

export default function NewBroadcastPage() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);

  const fetchContacts = useCallback(async () => {
    try {
      const data = await api.get('/api/contacts');
      setContacts(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Failed to fetch contacts:', error);
      setContacts([]);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  const handleSave = async (broadcast: {
    name: string;
    message: string;
    recipients: string[];
    scheduledAt?: Date;
  }) => {
    const createdBroadcast = await api.post('/api/broadcasts', broadcast);

    if (!broadcast.scheduledAt && createdBroadcast?.id) {
      await api.post(`/api/broadcasts/${createdBroadcast.id}/send`, {});
    }

    router.push('/broadcasts');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-4">
        <Link
          href="/broadcasts"
          className="flex items-center rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-medium text-white transition hover:bg-white/10"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">New Broadcast</h1>
          <p className="text-[#8696A0]">Create and send a broadcast message</p>
        </div>
      </div>

      <BroadcastForm contacts={contacts} onSave={handleSave} />
    </div>
  );
}
