'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession, signOut } from 'next-auth/react';
import { api } from '../../../lib/api';
import QRCodeDisplay from '../../../components/shared/QRCodeDisplay';
import ConnectionStatus from '../../../components/shared/ConnectionStatus';
import { useSocket } from '../../../hooks/useSocket';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Settings2 } from 'lucide-react';

export default function SettingsPage() {
  const { data: session, status: sessionStatus } = useSession();
  const [status, setStatus] = useState<'connected' | 'disconnected' | 'connecting'>('disconnected');
  const [connectedPhone, setConnectedPhone] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [whatsAppError, setWhatsAppError] = useState<string>('');
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [teamName, setTeamName] = useState('');
  const [newMemberEmail, setNewMemberEmail] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('AGENT');
  const [savedReplies, setSavedReplies] = useState<any[]>([]);
  const [shortcut, setShortcut] = useState('');
  const [savedReplyMessage, setSavedReplyMessage] = useState('');

  const fetchStatus = useCallback(async () => {
    try {
      const data = await api.get('/api/whatsapp/status');
      setStatus(data.status);
      setConnectedPhone(data.connectedPhone ?? null);
      if (data?.error?.statusCode || data?.error?.reason || data?.error?.message) {
        const parts = [
          data?.error?.statusCode ? `Status ${data.error.statusCode}` : null,
          data?.error?.reason ? `Reason ${data.error.reason}` : null,
          data?.error?.message ? data.error.message : null,
        ].filter(Boolean);
        setWhatsAppError(parts.join(' - '));
      } else {
        setWhatsAppError('');
      }
    } catch (error) {
      console.error('Failed to fetch status:', error);
      setWhatsAppError(error instanceof Error ? error.message : 'Failed to fetch WhatsApp status');
    }
  }, []);

  const fetchQR = useCallback(async () => {
    try {
      const data = await api.get('/api/whatsapp/qr');
      setQrCode(data.qr);
      setWhatsAppError('');
    } catch (error) {
      console.error('Failed to fetch QR:', error);
      setWhatsAppError(error instanceof Error ? error.message : 'Failed to fetch WhatsApp QR');
    }
  }, []);

  const fetchTeamMembers = useCallback(async () => {
    if (session?.user) {
      try {
        const data = await api.get('/api/teams');
        setTeamMembers(data?.team?.members || []);
        setTeamName(data?.team?.name || '');
      } catch {
        setTeamMembers([session.user]);
      }
    }
  }, [session]);

  const fetchSavedReplies = useCallback(async () => {
    try {
      const data = await api.get('/api/saved-replies');
      setSavedReplies(Array.isArray(data) ? data : []);
    } catch {
      setSavedReplies([]);
    }
  }, []);

  useEffect(() => {
    if (sessionStatus === 'loading') return;
    if (sessionStatus !== 'authenticated') return;

    fetchStatus();
    fetchQR();
    fetchTeamMembers();
    fetchSavedReplies();

    const interval = setInterval(() => {
      fetchStatus();
      if (status !== 'connected') {
        fetchQR();
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [sessionStatus, status, fetchStatus, fetchTeamMembers, fetchQR]);

  useSocket('wa:status', () => {
    fetchStatus();
  });

  useSocket('wa:qr', () => {
    fetchQR();
  });

  const handleDisconnect = async () => {
    try {
      await api.post('/api/whatsapp/disconnect', {});
      setStatus('disconnected');
      setConnectedPhone(null);
      setQrCode(null);
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  };

  const handleConnect = async () => {
    try {
      setWhatsAppError('');
      setStatus('connecting');
      await api.post('/api/whatsapp/connect', {});
      await fetchStatus();
      await fetchQR();
    } catch (error) {
      console.error('Failed to connect:', error);
      setWhatsAppError(error instanceof Error ? error.message : 'Failed to connect to WhatsApp');
    }
  };

  const handleResetSession = async () => {
    try {
      setWhatsAppError('');
      setStatus('disconnected');
      setConnectedPhone(null);
      setQrCode(null);

      await api.post('/api/whatsapp/reset-auth', {});
      await api.post('/api/whatsapp/connect', {});

      setStatus('connecting');
      await fetchStatus();
      await fetchQR();
    } catch (error) {
      console.error('Failed to reset WhatsApp session:', error);
      setWhatsAppError(error instanceof Error ? error.message : 'Failed to reset WhatsApp session');
    }
  };

  const handleAddTeamMember = async () => {
    try {
      if (sessionStatus !== 'authenticated') return;
      const teamData = await api.get('/api/teams');
      if (!teamData?.team?.id) return;
      await api.post(`/api/teams/${teamData.team.id}/members`, {
        email: newMemberEmail,
        role: newMemberRole,
      });
      setNewMemberEmail('');
      fetchTeamMembers();
    } catch (error) {
      console.error('Failed to add team member:', error);
    }
  };

  const handleSaveReply = async () => {
    await api.post('/api/saved-replies', {
      shortcut,
      message: savedReplyMessage,
    });
    setShortcut('');
    setSavedReplyMessage('');
    fetchSavedReplies();
  };

  const handleDeleteSavedReply = async (id: string) => {
    await api.delete(`/api/saved-replies/${id}`);
    fetchSavedReplies();
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-white/10 bg-[#111B21] p-6 shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#25D366]/30 dark:border-[#25D366]/30 bg-[#25D366]/10 dark:bg-[#25D366]/15 px-3 py-1.5 text-xs font-medium text-[#25D366]">
          <Settings2 className="h-3.5 w-3.5" />
          Workspace settings
        </div>
        <h1 className="mt-3 text-3xl font-semibold text-white">Settings</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[#8696A0]">Connect WhatsApp, manage your team, and handle account settings without exposing any backend features you do not already have.</p>
      </section>

      <Tabs defaultValue="whatsapp" className="space-y-4">
        <TabsList>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="saved-replies">Saved Replies</TabsTrigger>
          <TabsTrigger value="account">Account</TabsTrigger>
        </TabsList>

        <TabsContent value="whatsapp" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>WhatsApp Connection</CardTitle>
              <CardDescription>Manage your WhatsApp Web connection</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ConnectionStatus status={status} />
              {status === 'connected' && connectedPhone && (
                <div className="rounded-md bg-green-50 p-3 text-sm text-green-700">
                  Connected WhatsApp number: <span className="font-semibold">{connectedPhone}</span>
                </div>
              )}
              {whatsAppError && (
                <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
                  {whatsAppError}
                </div>
              )}
              {status !== 'connected' && qrCode && (
                <QRCodeDisplay qrCode={qrCode} />
              )}
              {status !== 'connected' && !qrCode && (
                <div className="text-sm text-gray-600">
                  Click connect to generate a QR code.
                </div>
              )}
              {status !== 'connected' && (
                <div className="flex gap-2">
                  <Button onClick={handleConnect}>
                    Connect WhatsApp
                  </Button>
                  <Button onClick={handleResetSession} variant="outline">
                    Reset Session
                  </Button>
                </div>
              )}
              {status === 'connected' && (
                <Button onClick={handleDisconnect} variant="destructive">
                  Disconnect WhatsApp
                </Button>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Team Members</CardTitle>
              <CardDescription>Manage team access to this system</CardDescription>
            </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter email address"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="rounded-md border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2 text-sm text-gray-900 dark:text-white"
                  >
                    <option value="ADMIN">Admin</option>
                    <option value="TEAM_LEAD">Team Lead</option>
                    <option value="AGENT">Agent</option>
                    <option value="ANALYST">Analyst</option>
                    <option value="VIEWER">Viewer</option>
                  </select>
                  <Button onClick={handleAddTeamMember}>Invite Member</Button>
                </div>
                {teamName && (
                  <div className="rounded-lg bg-gray-50 px-3 py-2 text-sm text-white">
                    Team: <span className="font-semibold">{teamName}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {teamMembers.map((member) => (
                    <div
                      key={member.id ?? member.email}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <span>{member.email}</span>
                      <span className="text-sm text-gray-500">{member.role || 'Member'}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="saved-replies" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Saved Replies</CardTitle>
              <CardDescription>Use shortcuts like /thanks in the message box</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <Input
                  placeholder="/thanks"
                  value={shortcut}
                  onChange={(e) => setShortcut(e.target.value)}
                />
                <Input
                  placeholder="Thanks for reaching out. We’ll get back to you shortly."
                  value={savedReplyMessage}
                  onChange={(e) => setSavedReplyMessage(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveReply}>Save Reply</Button>
              <div className="space-y-2">
                {savedReplies.map((reply) => (
                  <div key={reply.id} className="flex items-center justify-between rounded-lg border p-3">
                    <div>
                      <div className="font-medium text-gray-900">{reply.shortcut}</div>
                      <div className="text-sm text-gray-600">{reply.message}</div>
                    </div>
                    <Button variant="outline" onClick={() => handleDeleteSavedReply(reply.id)}>
                      Delete
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="account" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Manage your account settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-600">Email: {session?.user?.email}</p>
                <p className="text-sm text-gray-600">Name: {session?.user?.name}</p>
              </div>
              <Button onClick={() => signOut()} variant="outline">
                Sign Out
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
