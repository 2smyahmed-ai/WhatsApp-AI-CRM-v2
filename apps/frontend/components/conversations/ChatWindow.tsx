'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Send,
  Paperclip,
  Smile,
  X,
  Loader2,
  Mic,
  Square,
  Image as ImageIcon,
  FileText,
  Video,
  Music2,
  StickyNote,
  MessageSquare,
  ChevronRight,
  ChevronLeft,
  Users,
  User,
  GitBranch,
  Search,
  ChevronDown,
  Phone,
  VideoIcon,
  MoreVertical,
} from 'lucide-react';
import MessageBubble from '../messages/MessageRenderer';
import InteractiveComposer from '../chat/InteractiveComposer';
import SaveContactModal from './SaveContactModal';
import InternalNotes from './InternalNotes';
import AssignmentHistory from './AssignmentHistory';
import EmojiPicker from '../ui/EmojiPicker';
import ForwardModal from './ForwardModal';
import { api, apiForm } from '../../lib/api';
import { useSocket } from '../../hooks/useSocket';
import { getSocket } from '../../lib/socket';
import { formatPhone } from '../../lib/phone';
import { useSession } from 'next-auth/react';

interface Message {
  id: string;
  fromMe: boolean;
  senderType?: 'agent' | 'user' | string;
  direction?: 'INBOUND' | 'OUTBOUND';
  body: string;
  type?: 'TEXT' | 'IMAGE' | 'DOCUMENT' | 'AUDIO' | 'VIDEO';
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFileName?: string | null;
  mediaCaption?: string | null;
  mediaDuration?: number | null;
  timestamp: string;
  status?: 'SENT' | 'RECEIVED' | 'PROCESSED' | 'DELIVERED' | 'READ' | 'FAILED';
  replyToId?: string | null;
  replyToBody?: string | null;
  reactions?: Array<{ id: string; emoji: string; userId?: string | null; contactPhone?: string | null; user?: { id: string; name: string } | null }>;
}

interface Agent {
  id: string;
  name: string | null;
  email: string;
  role: string;
}

interface Team {
  id: string;
  name: string;
}

interface Conversation {
  id: string;
  contact?: {
    id?: string;
    name: string | null;
    phone: string;
    customFields?: { avatarUrl?: string | null } | null;
  };
  messages?: Message[];
  status: string;
  pipeline?: string | null;
  assignedTo: string | null;
  assignedUser?: { id: string; name: string | null; email: string } | null;
  assignedTeamId?: string | null;
  assignedTeam?: { id: string; name: string } | null;
}

interface ChatWindowProps {
  conversationId: string | null;
  recipientContacts?: Array<{ id: string; name: string | null; phone: string }>;
  onContactSaved?: () => void;
  onConversationNotFound?: () => void;
}

const EMOJIS = ['😀', '😂', '😍', '😭', '😘', '🤔', '👍', '🙌', '🔥', '❤️', '✨', '🎉', '🚀', '💯'];
const ATTACHMENT_OPTIONS = [
  { label: 'Photos', accept: 'image/*', icon: ImageIcon, color: 'from-violet-500 to-purple-600' },
  { label: 'Video', accept: 'video/*', icon: Video, color: 'from-rose-500 to-pink-600' },
  { label: 'Audio', accept: 'audio/*', icon: Music2, color: 'from-amber-500 to-orange-600' },
  { label: 'Document', accept: '.pdf,.doc,.docx,.txt,.xls,.xlsx,.ppt,.pptx', icon: FileText, color: 'from-sky-500 to-blue-600' },
];

const PIPELINE_STAGES = ['', 'LEAD', 'QUALIFIED', 'NEGOTIATION', 'WON', 'LOST'] as const;
const PIPELINE_LABELS: Record<string, string> = {
  '': 'No Pipeline',
  LEAD: 'Lead',
  QUALIFIED: 'Qualified',
  NEGOTIATION: 'Negotiation',
  WON: 'Won',
  LOST: 'Lost',
};

function blocksToText(blocks: Array<{ type: string; [key: string]: unknown }>): string {
  return blocks.map((b) => {
    if (b.type === 'text') return (b.content as string) || '';
    if (b.type === 'media') return (b.caption as string) || '';
    if (b.type === 'promo') {
      const lines = [b.title as string, b.description as string].filter(Boolean);
      if (b.ctaLabel) lines.push(`\n→ ${b.ctaLabel}`);
      return lines.join('\n');
    }
    if (b.type === 'product') return `🛍️ ${b.name}\n💰 ${b.price}\n\n→ ${b.buttonLabel}`;
    if (b.type === 'reminder') return `📅 *${b.title}*\n${b.datetime}\n\n✓ ${b.confirmLabel}   ↺ ${b.rescheduleLabel}`;
    if (b.type === 'support') {
      const faqs = (b.faqs as string[]).map((f, i) => `${i + 1}. ${f}`).join('\n');
      return `${b.greeting}\n\n${faqs}`;
    }
    if (b.type === 'buttons') {
      const lines = (b.buttons as Array<{ label: string; action?: string; url?: string }>).map((btn) => {
        if (btn.action === 'call') return `📞 ${btn.label}`;
        if (btn.action === 'url' && btn.url) return `🔗 ${btn.label}: ${btn.url}`;
        return `↩ Reply: ${btn.label}`;
      });
      return lines.join('\n');
    }
    return '';
  }).filter(Boolean).join('\n\n');
}

function formatDuration(seconds?: number | null) {
  if (seconds === null || seconds === undefined) return '';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function getPreferredAudioMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'audio/webm';
  const candidates = ['audio/ogg;codecs=opus', 'audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || 'audio/webm';
}

type RightPanelTab = 'details' | 'notes' | 'history';

export default function ChatWindow({ conversationId, recipientContacts = [], onContactSaved, onConversationNotFound }: ChatWindowProps) {
  const router = useRouter();
  const { data: session } = useSession();

  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [message, setMessage] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [recipientPhone, setRecipientPhone] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showEmojiBar, setShowEmojiBar] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [recordedAudio, setRecordedAudio] = useState<File | null>(null);
  const [typingHint, setTypingHint] = useState('');
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true);
  const [unreadWhileScrolled, setUnreadWhileScrolled] = useState(0);
  const [savedReplies, setSavedReplies] = useState<Array<{ shortcut: string; message: string }>>([]);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; content: string; type?: string; payload?: { blocks?: Array<{ type: string; url?: string; caption?: string; mediaType?: string; [key: string]: unknown }>; category?: string } }>>([]);
  const [templateFollowUp, setTemplateFollowUp] = useState('');
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [showSaveContactModal, setShowSaveContactModal] = useState(false);
  const [rightTab, setRightTab] = useState<RightPanelTab>('details');
  const [showRightPanel, setShowRightPanel] = useState(true);
  const [isAssigning, setIsAssigning] = useState(false);
  const [peerTyping, setPeerTyping] = useState(false);
  const [replyTo, setReplyTo] = useState<{ id: string; body: string; fromMe: boolean } | null>(null);
  const [forwardMessage, setForwardMessage] = useState<string | null>(null);
  const [showInteractiveComposer, setShowInteractiveComposer] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [showSearch, setShowSearch] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const emojiBarRef = useRef<HTMLDivElement>(null);
  const attachmentMenuRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<BlobPart[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  const fetchConversation = useCallback(async () => {
    if (!conversationId) return;
    try {
      const data = await api.get(`/api/conversations/${conversationId}`);
      if (data) {
        setConversation(data);
      } else {
        setConversation(null);
        onConversationNotFound?.();
      }
    } catch {
      setConversation(null);
    }
  }, [conversationId, onConversationNotFound]);

  const markAsRead = useCallback(() => {
    if (!conversationId) return;
    api.put(`/api/conversations/${conversationId}/read`, {}).catch(() => {});
  }, [conversationId]);

  const fetchAgents = useCallback(async () => {
    try {
      const data = await api.get('/api/teams/agents');
      setAgents(Array.isArray(data) ? data : []);
    } catch {
      setAgents([]);
    }
  }, []);

  const fetchTeams = useCallback(async () => {
    try {
      const data = await api.get('/api/teams/all');
      setTeams(Array.isArray(data) ? data : []);
    } catch {
      // non-admin: fall back to current team only
      try {
        const data = await api.get('/api/teams');
        if (data?.team) setTeams([data.team]);
      } catch {
        setTeams([]);
      }
    }
  }, []);

  const fetchSavedReplies = useCallback(async () => {
    try {
      const data = await api.get('/api/saved-replies');
      setSavedReplies(Array.isArray(data) ? data : []);
    } catch {
      setSavedReplies([]);
    }
  }, []);

  const fetchTemplates = useCallback(async () => {
    try {
      const data = await api.get('/api/templates');
      setTemplates(Array.isArray(data) ? data : []);
    } catch {
      setTemplates([]);
    }
  }, []);

  useEffect(() => {
    if (conversationId) {
      setConversation(null);
      setIsScrolledToBottom(true);
      setUnreadWhileScrolled(0);
      fetchConversation();
      markAsRead();
    }
    fetchAgents();
    fetchTeams();
    fetchSavedReplies();
    fetchTemplates();
  }, [conversationId, fetchConversation, fetchSavedReplies, fetchTemplates, fetchAgents, fetchTeams, markAsRead]);

  useEffect(() => {
    if (conversation?.contact?.phone) setRecipientPhone(conversation.contact.phone);
  }, [conversation?.contact?.phone]);

  // Notify conversation list to refetch when contact details change
  useEffect(() => {
    if (!conversation?.contact) return;
    try {
      window.dispatchEvent(new Event('conversations:refetch'));
    } catch {}
  }, [conversation?.contact?.id, conversation?.contact?.name]);

  useEffect(() => {
    if (isScrolledToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
    }
  }, [conversation?.messages?.length, isScrolledToBottom]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setIsScrolledToBottom(true);
    setUnreadWhileScrolled(0);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiBarRef.current && !emojiBarRef.current.contains(e.target as Node)) setShowEmojiBar(false);
      if (attachmentMenuRef.current && !attachmentMenuRef.current.contains(e.target as Node))
        setShowAttachmentMenu(false);
    };
    if (showEmojiBar || showAttachmentMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showEmojiBar, showAttachmentMenu]);

  useEffect(() => {
    if (!showTemplatePicker) return;
    const handler = (e: MouseEvent) => {
      const el = document.getElementById('template-picker-container');
      if (el && !el.contains(e.target as Node)) setShowTemplatePicker(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showTemplatePicker]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) window.clearInterval(recordingTimerRef.current);
      recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 80)}px`;
  }, [message]);

  useSocket('message:new', useCallback((data: any) => {
    if (data.conversationId !== conversationId) return;
    if (data.message) {
      setConversation((prev) => {
        if (!prev) return prev;
        const msgs = prev.messages ?? [];
        // If the server message already exists, ignore
        if (msgs.some((m) => m.id === data.message.id)) return prev;

        // Try to find an optimistic placeholder to replace:
        const optimisticIdx = msgs.findIndex((m: any) => {
          // Precise: match by clientId if both sides carry it
          if (data.message.clientId && (m as any).clientId === data.message.clientId) return true;
          if (!m.id?.toString().startsWith?.('optimistic-')) return false;
          // Fallback body match (text or caption)
          if (m.body && data.message.body && m.body === data.message.body) return true;
          // optimistic attachment placeholder like "[filename.ext]"
          if (m.body && m.body.startsWith('[') && m.body.endsWith(']')) {
            const inner = m.body.slice(1, -1);
            if (data.message.mediaFileName && data.message.mediaFileName === inner) return true;
          }
          // fallback: similar timestamp proximity (within 10s)
          try {
            const t1 = new Date(m.timestamp).getTime();
            const t2 = new Date(data.message.timestamp).getTime();
            if (Number.isFinite(t1) && Number.isFinite(t2) && Math.abs(t1 - t2) < 10000) return true;
          } catch {}
          return false;
        });
        let next: any[];
        if (optimisticIdx !== -1) {
          // replace optimistic with real message
          next = [...msgs];
          next[optimisticIdx] = data.message;
        } else {
          next = [...msgs, data.message];
        }
        next.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
        return { ...prev, messages: next };
      });
      setIsScrolledToBottom((atBottom) => {
        if (!atBottom && data.message.direction === 'INBOUND') {
          setUnreadWhileScrolled((n) => n + 1);
        }
        return atBottom;
      });
      // Notify conversation list about the new/updated message so sidebar updates in-place
      try {
        window.dispatchEvent(new CustomEvent('conversation:message', {
          detail: {
            conversationId,
            message: data.message,
          },
        }));
      } catch {}
    }
    markAsRead();
  }, [conversationId, markAsRead]));

  useSocket('conversation:updated', useCallback((data: any) => {
    if (data.conversationId !== conversationId) return;
    setConversation((prev) => {
      if (!prev) return prev;
      const { conversationId: _id, ...fields } = data;
      return { ...prev, ...fields };
    });
  }, [conversationId]));

  useSocket('message:reaction', useCallback((data: { conversationId: string; messageId: string; reactions: any[] }) => {
    if (data.conversationId !== conversationId) return;
    setConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages?.map((m) =>
          m.id === data.messageId ? { ...m, reactions: data.reactions } : m
        ),
      };
    });
  }, [conversationId]));

  useSocket('message:status', useCallback((data: { conversationId: string; messageId: string; status: string }) => {
    if (data.conversationId !== conversationId) return;
    setConversation((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        messages: prev.messages?.map((m) =>
          m.id === data.messageId ? { ...m, status: data.status as any } : m
        ),
      };
    });
  }, [conversationId]));

  // Peer typing indicator (other agents typing in this conversation)
  useSocket('typing:start', useCallback((data: { conversationId: string }) => {
    if (data.conversationId === conversationId) setPeerTyping(true);
  }, [conversationId]));

  useSocket('typing:stop', useCallback((data: { conversationId: string }) => {
    if (data.conversationId === conversationId) setPeerTyping(false);
  }, [conversationId]));

  const contactName = useMemo(
    () => conversation?.contact?.name || formatPhone(conversation?.contact?.phone) || 'Unknown contact',
    [conversation?.contact?.name, conversation?.contact?.phone],
  );
  const contactPhone = useMemo(() => formatPhone(conversation?.contact?.phone), [conversation?.contact?.phone]);
  const contactId = conversation?.contact?.id;
  const contactAvatar = conversation?.contact?.customFields?.avatarUrl;
  const messages = conversation?.messages ?? [];
  const isOpen = conversation?.status === 'OPEN';
  const statusLabel = conversation?.status?.toLowerCase() || 'unknown';
  const recordingLabel = formatDuration(recordingSeconds || 0) || '0:00';

  const handleAssignAgent = async (agentId: string) => {
    if (!conversationId) return;
    setIsAssigning(true);
    try {
      await api.put(`/api/conversations/${conversationId}/assign`, { agentId: agentId || null });
      // socket conversation:updated handles state update
    } finally {
      setIsAssigning(false);
    }
  };

  const handleAssignTeam = async (teamId: string) => {
    if (!conversationId) return;
    setIsAssigning(true);
    try {
      await api.put(`/api/conversations/${conversationId}/assign-team`, { teamId: teamId || null });
      // socket conversation:updated handles state update
    } finally {
      setIsAssigning(false);
    }
  };

  const handlePipelineChange = async (pipeline: string) => {
    if (!conversationId) return;
    await api.put(`/api/conversations/${conversationId}/pipeline`, { pipeline: pipeline || null });
    // socket conversation:updated handles state update
  };

  const handleStatusChange = async (status: string) => {
    if (!conversationId) return;
    await api.put(`/api/conversations/${conversationId}/status`, { status });
    // socket conversation:updated handles state update
  };

  const emitTyping = useCallback((isTyping: boolean) => {
    if (!conversationId) return;
    try {
      const socket = getSocket();
      socket.emit(isTyping ? 'typing:start' : 'typing:stop', { conversationId });
    } catch { /* socket might not be ready */ }
  }, [conversationId]);

  const handleMessageChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
    // Emit typing start; auto-stop after 3 seconds of inactivity
    emitTyping(true);
    if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => emitTyping(false), 3000);
  }, [emitTyping]);

  const insertEmoji = (emoji: string) => {
    const cursorPos = textareaRef.current?.selectionStart || message.length;
    const nextValue = message.slice(0, cursorPos) + emoji + message.slice(cursorPos);
    setMessage(nextValue);
    window.setTimeout(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursorPos + emoji.length, cursorPos + emoji.length);
    }, 0);
  };

  const openAttachmentPicker = (accept: string) => {
    if (!fileInputRef.current) return;
    fileInputRef.current.accept = accept;
    fileInputRef.current.click();
  };

  const stopRecording = useCallback(async () => {
    if (recordingTimerRef.current) {
      window.clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
    recordingStreamRef.current = null;
  }, []);

  const startRecording = useCallback(async () => {
    setRecordingError(null);
    setRecordedAudio(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setRecordingError('Audio recording is not supported in this browser.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getPreferredAudioMimeType();
      const recorder = new MediaRecorder(stream, { mimeType });
      recordingChunksRef.current = [];
      mediaRecorderRef.current = recorder;
      recordingStreamRef.current = stream;
      setRecordingSeconds(0);
      setIsRecording(true);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const mt = recorder.mimeType || 'audio/webm';
        const blob = new Blob(recordingChunksRef.current, { type: mt });
        const extension = mt.includes('ogg') ? 'ogg' : mt.includes('mp4') ? 'mp4' : 'webm';
        const file = new File([blob], `voice-note-${Date.now()}.${extension}`, { type: mt });
        setRecordedAudio(file);
        setAttachment(file);
      };
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingSeconds((current) => current + 1);
      }, 1000);
      recorder.start();
    } catch (error) {
      console.error('Recording failed:', error);
      setRecordingError('We could not access the microphone. Check browser permissions.');
      setIsRecording(false);
    }
  }, []);

  const sendMessage = async () => {
    const targetPhone = recipientPhone || conversation?.contact?.phone;
    if (!targetPhone) return;
    if (!message.trim() && !attachment && !recordedAudio) return;
    const clientId = crypto.randomUUID();
    const optimisticId = `optimistic-${clientId}`;
    try {
      setSendError(null);
      setIsSending(true);
      let finalMessage = message.trim();
      if (finalMessage.startsWith('/')) {
        const shortcut = finalMessage.split(/\s+/)[0];
        const match = savedReplies.find((reply) => reply.shortcut === shortcut);
        if (match) {
          const contactName = conversation?.contact?.name ?? '';
          const contactPhone = conversation?.contact?.phone ?? '';
          finalMessage = match.message.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => {
            if (k === 'name') return contactName;
            if (k === 'phone') return contactPhone;
            return '';
          });
          setTypingHint(`Expanded ${shortcut}`);
        }
      }
      // Optimistic: show message immediately
      const optimisticMsg: Message & { clientId?: string } = {
        id: optimisticId,
        clientId,
        fromMe: true,
        direction: 'OUTBOUND',
        body: attachment ? `[${attachment.name}]` : finalMessage,
        status: 'PROCESSED',
        timestamp: new Date().toISOString(),
        replyToId: replyTo?.id ?? null,
        replyToBody: replyTo?.body ?? null,
      };
      setConversation((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: [...(prev.messages ?? []), optimisticMsg] };
      });
      try {
        window.dispatchEvent(new CustomEvent('conversation:message', {
          detail: {
            conversationId,
            message: {
              id: optimisticMsg.id,
              body: optimisticMsg.body,
              fromMe: optimisticMsg.fromMe,
              timestamp: optimisticMsg.timestamp,
              status: optimisticMsg.status,
            },
          },
        }));
      } catch {}
      const pendingFollowUp = templateFollowUp;
      setMessage('');
      setAttachment(null);
      setRecordedAudio(null);
      setReplyTo(null);
      setTemplateFollowUp('');
      setShowEmojiBar(false);
      setShowAttachmentMenu(false);
      setTypingHint('');
      emitTyping(false);
      if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
      if (attachment || recordedAudio) {
        const media = attachment || recordedAudio;
        const caption = finalMessage;
        const formData = new FormData();
        formData.append('phone', targetPhone);
        formData.append('message', caption);
        formData.append('mediaCaption', caption);
        formData.append('media', media as File);
        formData.append('clientId', clientId);
        await apiForm(`/api/conversations/${conversationId}/reply`, formData);
        if (pendingFollowUp.trim()) {
          await api.post(`/api/conversations/${conversationId}/reply`, {
            phone: targetPhone,
            message: pendingFollowUp.trim(),
          });
        }
      } else {
        await api.post(`/api/conversations/${conversationId}/reply`, {
          phone: targetPhone,
          message: finalMessage,
          clientId,
          ...(replyTo ? { replyToId: replyTo.id, replyToBody: replyTo.body } : {}),
        });
      }
      // Keep optimistic message in place — socket 'message:new' will replace it smoothly.
    } catch (error) {
      // Remove optimistic message on failure
      setConversation((prev) => {
        if (!prev) return prev;
        return { ...prev, messages: (prev.messages ?? []).filter((m) => m.id !== optimisticId) };
      });
      setSendError(error instanceof Error ? error.message : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setAttachment(file);
    setRecordedAudio(null);
    setShowAttachmentMenu(false);
    if (file?.type?.startsWith('audio/')) setTypingHint('Audio attachment ready');
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!conversationId) return;
    if (!confirm('Delete this message? This cannot be undone.')) return;
    const backup = conversation?.messages ?? [];
    // Optimistic removal locally
    setConversation((prev) => {
      if (!prev) return prev;
      return { ...prev, messages: (prev.messages ?? []).filter((m) => m.id !== messageId) };
    });

    // If the message is an optimistic placeholder, skip API call
    if (messageId.startsWith('optimistic-')) {
      const last = (conversation?.messages ?? []).filter((m) => m.id !== messageId).slice(-1)[0] ?? null;
      if (last) {
        try { window.dispatchEvent(new CustomEvent('conversation:message', { detail: { conversationId, message: last } })); } catch {}
      } else {
        try { window.dispatchEvent(new Event('conversations:refetch')); } catch {}
      }
      return;
    }

    try {
      await api.delete(`/api/conversations/${conversationId}/messages/${messageId}`);
      // Refresh conversation state from server to get latest lastMessage
      try {
        const fresh = await api.get(`/api/conversations/${conversationId}`);
        if (fresh) setConversation(fresh);
        const last = fresh?.messages?.length ? fresh.messages[fresh.messages.length - 1] : null;
        if (last) {
          try {
            window.dispatchEvent(new CustomEvent('conversation:message', {
              detail: { conversationId, message: last },
            }));
          } catch {}
        } else {
          try { window.dispatchEvent(new Event('conversations:refetch')); } catch {}
        }
      } catch {
        try { window.dispatchEvent(new Event('conversations:refetch')); } catch {}
      }
    } catch (err) {
      // restore backup on error
      setConversation((prev) => (prev ? { ...prev, messages: backup } : prev));
      setSendError('Failed to delete message');
    }
  };

  if (!conversationId) {
    return (
      <div className="relative flex h-full items-center justify-center overflow-hidden bg-[#f0f2f5] dark:bg-[#0B141A]">
        <div className="absolute inset-0 chat-doodle-bg opacity-40 dark:opacity-20 pointer-events-none" />
        <div className="relative z-10 max-w-md px-8 text-center">
          <div className="mx-auto mb-6 flex h-32 w-32 items-center justify-center">
            <div className="absolute h-32 w-32 rounded-full bg-[#25D366]/10 blur-2xl" />
            <div className="relative flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] via-[#1FAA5C] to-[#128C7E] shadow-[0_20px_60px_-15px_rgba(37,211,102,0.5)]">
              <MessageSquare className="h-10 w-10 text-white" strokeWidth={1.75} />
            </div>
          </div>
          <h2 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-white">Keep your messages flowing</h2>
          <p className="mt-2 text-sm leading-relaxed text-gray-500 dark:text-[#8696A0]">
            Select a conversation from the sidebar to start chatting, manage assignments, and keep your team in sync.
          </p>
          <div className="mt-8 flex items-center justify-center gap-2 text-[11px] uppercase tracking-[0.18em] text-gray-400 dark:text-[#5C6970]">
            <span className="h-px w-8 bg-gray-300 dark:bg-white/10" />
            End-to-end workflow
            <span className="h-px w-8 bg-gray-300 dark:bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!conversation) {
    return (
      <div className="relative flex h-full items-center justify-center bg-[#f0f2f5] dark:bg-[#0B141A]">
        <div className="absolute inset-0 chat-doodle-bg opacity-30 dark:opacity-15 pointer-events-none" />
        <div className="relative flex flex-col items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 animate-ping rounded-full bg-[#25D366]/20" />
            <div className="relative h-12 w-12 animate-spin rounded-full border-[3px] border-gray-200 dark:border-white/10 border-t-[#25D366]" />
          </div>
          <p className="text-sm font-medium text-gray-500 dark:text-[#8696A0]">Loading conversation...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex h-full overflow-hidden bg-white dark:bg-[#111B21] chat-shell-light dark:chat-shell-dark">
      <style>{`
        /* WhatsApp's iconic doodle pattern background */
        .chat-doodle-bg {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cg fill='none' stroke='%23000' stroke-width='1' opacity='0.08'%3E%3Ccircle cx='50' cy='50' r='4'/%3E%3Cpath d='M120 80 q15 -20 30 0 t30 0' stroke-linecap='round'/%3E%3Crect x='220' y='40' width='40' height='30' rx='4'/%3E%3Cpath d='M310 60 l10 -15 l10 15 z' stroke-linejoin='round'/%3E%3Cpath d='M40 150 q20 -10 40 0 q20 10 40 0' stroke-linecap='round'/%3E%3Ccircle cx='200' cy='160' r='10'/%3E%3Cpath d='M280 140 l30 30 M310 140 l-30 30'/%3E%3Cpath d='M60 240 q25 -25 50 0 q25 25 50 0' stroke-linecap='round'/%3E%3Crect x='200' y='220' width='25' height='25' rx='3' transform='rotate(15 212 232)'/%3E%3Cpath d='M280 240 a15 15 0 1 1 30 0 a15 15 0 1 1 -30 0'/%3E%3Cpath d='M30 320 l20 -10 l20 10 l20 -10 l20 10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='180' cy='340' r='6'/%3E%3Cpath d='M260 320 q15 15 30 0 q15 -15 30 0' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E");
          background-size: 400px 400px;
        }
        :is(.dark .chat-doodle-bg) {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 400 400'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1' opacity='0.06'%3E%3Ccircle cx='50' cy='50' r='4'/%3E%3Cpath d='M120 80 q15 -20 30 0 t30 0' stroke-linecap='round'/%3E%3Crect x='220' y='40' width='40' height='30' rx='4'/%3E%3Cpath d='M310 60 l10 -15 l10 15 z' stroke-linejoin='round'/%3E%3Cpath d='M40 150 q20 -10 40 0 q20 10 40 0' stroke-linecap='round'/%3E%3Ccircle cx='200' cy='160' r='10'/%3E%3Cpath d='M280 140 l30 30 M310 140 l-30 30'/%3E%3Cpath d='M60 240 q25 -25 50 0 q25 25 50 0' stroke-linecap='round'/%3E%3Crect x='200' y='220' width='25' height='25' rx='3' transform='rotate(15 212 232)'/%3E%3Cpath d='M280 240 a15 15 0 1 1 30 0 a15 15 0 1 1 -30 0'/%3E%3Cpath d='M30 320 l20 -10 l20 10 l20 -10 l20 10' stroke-linecap='round' stroke-linejoin='round'/%3E%3Ccircle cx='180' cy='340' r='6'/%3E%3Cpath d='M260 320 q15 15 30 0 q15 -15 30 0' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E");
        }

        .chat-shell-light {
          background-color: #131313;
          background-image:
            radial-gradient(at 20% 0%, rgba(37, 211, 102, 0.03) 0px, transparent 50%),
            radial-gradient(at 80% 100%, rgba(18, 140, 126, 0.03) 0px, transparent 50%);
        }
        .chat-shell-dark {
          background-color: #111B21;
          background-image:
            radial-gradient(at 20% 0%, rgba(37, 211, 102, 0.05) 0px, transparent 50%),
            radial-gradient(at 80% 100%, rgba(18, 140, 126, 0.04) 0px, transparent 50%);
        }

        .glass-header-light {
          background: #111B21;
          backdrop-filter: saturate(180%) blur(16px);
          -webkit-backdrop-filter: saturate(180%) blur(16px);
        }
        .glass-header-dark {
          background: rgba(17, 27, 33, 0.85);
          backdrop-filter: saturate(180%) blur(16px);
          -webkit-backdrop-filter: saturate(180%) blur(16px);
        }

        .message-input-focus:focus {
          outline: none;
          border-color: transparent;
          box-shadow: 0 0 0 2px rgba(37,211,102,0.45), 0 8px 24px -12px rgba(37,211,102,0.25);
        }

        .float-in {
          animation: float-in 0.28s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes float-in {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .pop-in { animation: pop-in 0.22s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes pop-in {
          from { opacity: 0; transform: scale(0.9) translateY(8px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        .slide-down { animation: slide-down 0.24s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slide-down {
          from { opacity: 0; max-height: 0; }
          to { opacity: 1; max-height: 240px; }
        }

        .pulse-dot::before {
          content: '';
          position: absolute;
          inset: -2px;
          border-radius: 9999px;
          background: inherit;
          animation: pulse-ring 2s ease-out infinite;
          opacity: 0.6;
        }
        @keyframes pulse-ring {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(2.4); opacity: 0; }
        }

        .recording-wave span {
          display: inline-block;
          width: 3px;
          margin: 0 1px;
          background: currentColor;
          border-radius: 2px;
          animation: wave 1.2s ease-in-out infinite;
        }
        .recording-wave span:nth-child(1) { animation-delay: 0s; height: 8px; }
        .recording-wave span:nth-child(2) { animation-delay: 0.15s; height: 14px; }
        .recording-wave span:nth-child(3) { animation-delay: 0.3s; height: 18px; }
        .recording-wave span:nth-child(4) { animation-delay: 0.45s; height: 12px; }
        .recording-wave span:nth-child(5) { animation-delay: 0.6s; height: 16px; }
        @keyframes wave {
          0%, 100% { transform: scaleY(0.5); }
          50% { transform: scaleY(1); }
        }

        .icon-btn {
          position: relative;
          isolation: isolate;
        }
        .icon-btn::before {
          content: '';
          position: absolute;
          inset: 0;
          border-radius: inherit;
          background: currentColor;
          opacity: 0;
          transition: opacity 0.18s ease;
          z-index: -1;
        }
        .icon-btn:hover::before { opacity: 0.08; }
        .icon-btn:active::before { opacity: 0.14; }

        /* Custom scrollbar */
        .chat-scroll::-webkit-scrollbar { width: 6px; }
        .chat-scroll::-webkit-scrollbar-track { background: transparent; }
        .chat-scroll::-webkit-scrollbar-thumb {
          background: rgba(134, 150, 160, 0.25);
          border-radius: 3px;
        }
        .chat-scroll::-webkit-scrollbar-thumb:hover {
          background: rgba(134, 150, 160, 0.5);
        }

        /* Subtle gradient ring for avatars */
        .avatar-ring {
          background: linear-gradient(135deg, #25D366 0%, #1FAA5C 50%, #128C7E 100%);
          padding: 2px;
        }

        /* Right panel slide-in on mobile */
        @media (max-width: 1023px) {
          .right-panel-mobile {
            position: absolute;
            top: 0;
            right: 0;
            bottom: 0;
            z-index: 50;
            box-shadow: -20px 0 50px -10px rgba(0,0,0,0.25);
            animation: slide-in-right 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
        }
        @keyframes slide-in-right {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }

        /* Send button shine */
        .send-btn-active {
          background: linear-gradient(135deg, #25D366 0%, #1FAA5C 100%);
          box-shadow: 0 6px 16px -4px rgba(37, 211, 102, 0.5), 0 2px 4px rgba(37, 211, 102, 0.3);
        }
        .send-btn-active:hover {
          background: linear-gradient(135deg, #2ee06f 0%, #25b568 100%);
          box-shadow: 0 8px 20px -4px rgba(37, 211, 102, 0.6), 0 4px 8px rgba(37, 211, 102, 0.4);
        }

        .reply-bar {
          background: linear-gradient(90deg, rgba(37,211,102,0.08), rgba(37,211,102,0.02));
        }
        :is(.dark .reply-bar) {
          background: linear-gradient(90deg, rgba(37,211,102,0.14), rgba(37,211,102,0.04));
        }
      `}</style>

      {/* ===== MAIN CHAT AREA ===== */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        {/* Header */}
        <div className="relative z-20 flex items-center justify-between gap-2 border-b border-black/5 dark:border-white/5 glass-header-light dark:glass-header-dark px-3 sm:px-5 py-3">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative shrink-0">
              <div className="avatar-ring rounded-full">
                <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-base font-semibold text-white">
                  {contactAvatar ? (
                    <img src={contactAvatar} alt={contactName} className="h-full w-full object-cover" />
                  ) : (
                    contactName.charAt(0).toUpperCase()
                  )}
                </div>
              </div>
              {statusLabel === 'open' && (
                <div className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-[#25D366] ring-2 ring-white dark:ring-[#111B21]">
                  <div className="pulse-dot absolute inset-0 rounded-full bg-[#25D366]" />
                </div>
              )}
              {statusLabel !== 'open' && (
                <div
                  className={`absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full ring-2 ring-white dark:ring-[#111B21] ${
                    statusLabel === 'pending' ? 'bg-amber-400' : 'bg-slate-400'
                  }`}
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h3 className="truncate text-[15px] font-semibold tracking-tight text-gray-900 dark:text-white">{contactName}</h3>
                {!isOpen && (
                  <span className="shrink-0 rounded-md bg-gray-200/80 dark:bg-white/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">
                    {conversation.status}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                {peerTyping ? (
                  <p className="flex items-center gap-1 text-xs text-[#25D366]">
                    <span className="recording-wave inline-flex h-3 items-end">
                      <span /><span /><span />
                    </span>
                    typing...
                  </p>
                ) : (
                  <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]">{contactPhone || 'Online'}</p>
                )}
              </div>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {contactId && (
              <div className="hidden md:flex items-center gap-1.5 mr-1">
                <button
                  type="button"
                  onClick={() => router.push(`/tasks?contactId=${encodeURIComponent(contactId)}`)}
                  className="rounded-full border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-[#E9EDEF] transition-all hover:border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-[#1FAA5C]"
                >
                  Task
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/deals?contactId=${encodeURIComponent(contactId)}`)}
                  className="rounded-full border border-gray-200 dark:border-white/10 bg-white/60 dark:bg-white/5 px-3 py-1.5 text-xs font-medium text-gray-700 dark:text-[#E9EDEF] transition-all hover:border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-[#1FAA5C]"
                >
                  Deal
                </button>
              </div>
            )}
            {!conversation?.contact?.name && (
              <button
                type="button"
                onClick={() => setShowSaveContactModal(true)}
                className="mr-1 rounded-full bg-gradient-to-br from-[#25D366] to-[#1FAA5C] px-3 py-1.5 text-xs font-semibold text-white shadow-md shadow-[#25D366]/30 transition-all hover:shadow-lg hover:shadow-[#25D366]/40 active:scale-95"
              >
                Save Contact
              </button>
            )}
            {/* Search toggle */}
            <button
              type="button"
              onClick={() => { setShowSearch((v) => !v); setSearchQuery(''); setSearchResults([]); }}
              className={`icon-btn flex h-9 w-9 items-center justify-center rounded-full transition-colors ${
                showSearch ? 'bg-[#25D366]/15 text-[#25D366]' : 'text-gray-600 dark:text-[#AEBAC1]'
              }`}
              aria-label="Search messages"
            >
              <Search className="h-[18px] w-[18px]" />
            </button>
            {/* Toggle right panel */}
            <button
              type="button"
              onClick={() => setShowRightPanel((v) => !v)}
              className="icon-btn flex h-9 w-9 items-center justify-center rounded-full text-gray-600 dark:text-[#AEBAC1] transition-colors"
              aria-label={showRightPanel ? 'Hide details' : 'Show details'}
            >
              {showRightPanel ? <ChevronRight className="h-[18px] w-[18px]" /> : <ChevronLeft className="h-[18px] w-[18px]" />}
            </button>
          </div>
        </div>

        {/* Search bar */}
        {showSearch && (
          <div className="slide-down relative z-10 border-b border-black/5 dark:border-white/5 bg-white/80 dark:bg-[#111B21]/80 backdrop-blur-sm px-4 py-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-[#8696A0]" />
              <input
                type="text"
                value={searchQuery}
                onChange={async (e) => {
                  setSearchQuery(e.target.value);
                  if (!conversationId || !e.target.value.trim()) { setSearchResults([]); return; }
                  try {
                    const data = await api.get(`/api/conversations/${conversationId}/messages/search?q=${encodeURIComponent(e.target.value)}`);
                    setSearchResults(Array.isArray(data) ? data : []);
                  } catch { setSearchResults([]); }
                }}
                placeholder="Search messages in this conversation..."
                autoFocus
                className="w-full rounded-full border border-gray-200 dark:border-white/10 bg-gray-50 dark:bg-[#202C33] pl-10 pr-10 py-2 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8696A0] focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSearchResults([]); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        )}
        {showSearch && searchResults.length > 0 && (
          <div className="relative z-10 max-h-56 overflow-y-auto chat-scroll border-b border-black/5 dark:border-white/5 bg-white dark:bg-[#111B21]">
            <div className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400 dark:text-[#5C6970]">
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
            </div>
            {searchResults.map((r) => (
              <button
                key={r.id}
                type="button"
                className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-gray-50 dark:hover:bg-white/5 border-b border-gray-100 dark:border-white/5 last:border-0"
                onClick={() => {
                  setShowSearch(false);
                  setSearchQuery('');
                  setSearchResults([]);
                }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-[#25D366]">
                    {r.fromMe ? 'You' : 'Contact'}
                  </p>
                  <p className="text-[11px] text-gray-400 dark:text-[#8696A0]">
                    {new Date(r.timestamp).toLocaleString()}
                  </p>
                </div>
                <p className="mt-0.5 text-sm text-gray-700 dark:text-[#E9EDEF] truncate">{r.body}</p>
              </button>
            ))}
          </div>
        )}

        {/* Messages area */}
        <div className="relative flex-1 overflow-hidden chat-shell-light dark:chat-shell-dark">
          <div className="absolute inset-0 chat-doodle-bg pointer-events-none" />
          <div
            ref={scrollContainerRef}
            className="chat-scroll relative h-full overflow-y-auto overflow-x-hidden px-3 sm:px-6 py-4"
            onScroll={() => {
              const el = scrollContainerRef.current;
              if (!el) return;
              const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
              const atBottom = distanceFromBottom < 140;
              setIsScrolledToBottom(atBottom);
              if (atBottom) setUnreadWhileScrolled(0);
            }}
          >
              {messages.length === 0 ? (
              <div className="flex h-full min-h-[300px] items-center justify-center">
                <div className="pop-in rounded-3xl border border-dashed border-gray-300/70 dark:border-white/10 bg-white/80 dark:bg-[#111B21]/80 backdrop-blur-sm px-10 py-12 text-center shadow-sm max-w-sm">
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/10">
                    <MessageSquare className="h-7 w-7 text-[#25D366]" strokeWidth={1.75} />
                  </div>
                  <p className="text-base font-semibold text-gray-900 dark:text-white">No messages yet</p>
                  <p className="mt-1.5 text-sm text-gray-500 dark:text-[#8696A0]">
                    Send the first reply, share a file, or record a voice note to begin the conversation.
                  </p>
                </div>
              </div>
              ) : (
              messages.map((msg, idx) => {
                // Group consecutive messages from same sender within 2 minutes
                const prev = messages[idx - 1];
                const msgDate = new Date(msg.timestamp);
                const prevDate = prev ? new Date(prev.timestamp) : null;
                const isGrouped = prev && prev.fromMe === msg.fromMe &&
                  (msgDate.getTime() - new Date(prev.timestamp).getTime() < 120000);

                // Date separator: show when day changes
                const showDateSeparator = !prev || (
                  prevDate &&
                  (msgDate.toDateString() !== prevDate.toDateString())
                );

                const dateLabel = (() => {
                  const today = new Date();
                  const yesterday = new Date(today);
                  yesterday.setDate(yesterday.getDate() - 1);
                  if (msgDate.toDateString() === today.toDateString()) return 'Today';
                  if (msgDate.toDateString() === yesterday.toDateString()) return 'Yesterday';
                  return msgDate.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
                })();

                return (
                  <div key={msg.id}>
                  {showDateSeparator && (
                    <div className="flex items-center gap-3 my-4 px-2">
                      <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/10" />
                      <span className="text-[11px] font-medium text-gray-400 dark:text-[#8696A0] bg-white dark:bg-[#111B21] px-3 py-1 rounded-full border border-gray-200/60 dark:border-white/10 shadow-sm">
                        {dateLabel}
                      </span>
                      <div className="flex-1 h-px bg-gray-200/60 dark:bg-white/10" />
                    </div>
                  )}
                  <div className={`float-in w-full ${isGrouped ? 'mt-0.5' : 'mt-2'}`}>
                    <MessageBubble
                      message={msg as any}
                      conversationId={conversationId ?? undefined}
                      onReactionUpdate={(messageId, reactions) => {
                        setConversation((prev) => {
                          if (!prev) return prev;
                          return {
                            ...prev,
                            messages: prev.messages?.map((m) =>
                              m.id === messageId ? { ...m, reactions } : m
                            ),
                          };
                        });
                      }}
                      onReply={(legacyMsg: any) => {
                        setReplyTo({ id: legacyMsg.id, body: legacyMsg.body || legacyMsg.mediaCaption || '', fromMe: legacyMsg.fromMe });
                        textareaRef.current?.focus();
                      }}
                      onDelete={handleDeleteMessage}
                      onForward={(body: string) => setForwardMessage(body)}
                    />
                  </div>
                  </div>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </div>
          {/* Scroll-to-bottom button */}
          {!isScrolledToBottom && (
            <button
              type="button"
              onClick={scrollToBottom}
              className="pop-in absolute bottom-4 right-4 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white dark:bg-[#202C33] border border-gray-200 dark:border-white/10 shadow-xl text-gray-600 dark:text-[#AEBAC1] hover:text-[#25D366] hover:border-[#25D366]/30 transition-all hover:scale-105"
              aria-label="Scroll to bottom"
            >
              {unreadWhileScrolled > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-gradient-to-br from-[#25D366] to-[#1FAA5C] px-1.5 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-[#0B141A]">
                  {unreadWhileScrolled > 99 ? '99+' : unreadWhileScrolled}
                </span>
              )}
              <ChevronDown className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Input area */}
        <div className="relative z-10 border-t border-black/5 dark:border-white/5 bg-[#f0f2f5] dark:bg-[#1F2C33] px-3 sm:px-5 py-3">
          {/* Peer agent typing indicator */}
          {peerTyping && (
            <div className="mb-2 flex items-center gap-2 px-1 text-xs text-gray-500 dark:text-[#8696A0]">
              <span className="inline-flex gap-0.5">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#25D366] [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#25D366] [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#25D366] [animation-delay:300ms]" />
              </span>
              <span className="font-medium">Another agent is typing</span>
            </div>
          )}
          {sendError && (
            <div className="pop-in mb-2.5 flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-3 py-2">
              <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-500/20">
                <X className="h-3 w-3 text-red-600" />
              </div>
              <p className="text-xs font-medium text-red-700 dark:text-red-200">{sendError}</p>
            </div>
          )}
          {recordingError && (
            <div className="pop-in mb-2.5 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-3 py-2">
              <p className="text-xs font-medium text-amber-700 dark:text-amber-200">{recordingError}</p>
            </div>
          )}
          {replyTo && (
            <div className="pop-in reply-bar mb-2 flex items-start gap-3 rounded-xl border-l-[3px] border-[#25D366] px-3 py-2 pr-2">
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-wider text-[#25D366]">
                  Replying to {replyTo.fromMe ? 'yourself' : contactName}
                </p>
                <p className="mt-0.5 text-xs text-gray-600 dark:text-[#AEBAC1] truncate">{replyTo.body}</p>
              </div>
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="shrink-0 rounded-full p-1 text-gray-400 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-600 dark:hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
          {(attachment || recordedAudio) && (
            <div className="pop-in mb-2.5 flex items-center gap-3 rounded-2xl border border-[#25D366]/30 bg-gradient-to-r from-[#25D366]/10 via-[#25D366]/5 to-transparent dark:from-[#25D366]/15 px-3 py-2.5">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#25D366]/15 text-[#25D366]">
                {recordedAudio ? <Mic className="h-4 w-4" /> : attachment?.type?.startsWith('image/') ? <ImageIcon className="h-4 w-4" /> : attachment?.type?.startsWith('video/') ? <Video className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#1FAA5C]">
                  {recordedAudio ? 'Voice note ready' : 'Attachment ready'}
                </p>
                <p className="truncate text-sm font-medium text-gray-900 dark:text-white">
                  {recordedAudio?.name || attachment?.name}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setAttachment(null); setRecordedAudio(null); setRecordingSeconds(0); }}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-200 dark:hover:bg-white/10 hover:text-gray-700 dark:hover:text-white transition-colors"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Recording active state */}
          {isRecording && (
            <div className="pop-in mb-2.5 flex items-center gap-3 rounded-2xl border border-red-300 dark:border-red-500/30 bg-red-50 dark:bg-red-500/10 px-4 py-2.5">
              <div className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-red-500" />
              </div>
              <span className="recording-wave inline-flex h-5 items-end text-red-500">
                <span /><span /><span /><span /><span />
              </span>
              <span className="font-mono text-sm font-semibold text-red-600 dark:text-red-300">{recordingLabel}</span>
              <span className="ml-auto text-xs text-red-500">Recording...</span>
            </div>
          )}

          <div className="flex items-end gap-1.5 sm:gap-2">
            <div className="relative" ref={emojiBarRef}>
              <button
                onClick={() => setShowEmojiBar((v) => !v)}
                className={`icon-btn flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                  showEmojiBar ? 'text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]'
                }`}
                type="button"
                aria-label="Emoji"
              >
                <Smile className="h-[22px] w-[22px]" />
              </button>
              {showEmojiBar && (
                <EmojiPicker
                  onSelect={(emoji) => { insertEmoji(emoji); }}
                  onClose={() => setShowEmojiBar(false)}
                />
              )}
            </div>

            <div className="relative" ref={attachmentMenuRef}>
              <button
                onClick={() => setShowAttachmentMenu((v) => !v)}
                className={`icon-btn flex h-10 w-10 items-center justify-center rounded-full transition-all ${
                  showAttachmentMenu ? 'rotate-45 text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]'
                }`}
                type="button"
                aria-label="Attach"
              >
                <Paperclip className="h-[22px] w-[22px]" />
              </button>
              {showAttachmentMenu && (
                <div className="float-in absolute bottom-full left-0 z-50 mb-3 min-w-[220px] overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#233138] shadow-2xl">
                  <input ref={fileInputRef} type="file" onChange={handleAttachmentChange} className="hidden" />
                  <div className="border-b border-gray-100 dark:border-white/5 px-4 py-2.5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-[#8696A0]">Share</p>
                  </div>
                  <div className="p-2">
                    {ATTACHMENT_OPTIONS.map((option) => {
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.label}
                          type="button"
                          onClick={() => openAttachmentPicker(option.accept)}
                          className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-gray-700 dark:text-[#E9EDEF] transition-colors hover:bg-gray-50 dark:hover:bg-white/5"
                        >
                          <span className={`flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br ${option.color} text-white shadow-sm`}>
                            <Icon className="h-4 w-4" />
                          </span>
                          {option.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Template picker */}
            {templates.length > 0 && (
              <div id="template-picker-container" className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => setShowTemplatePicker((v) => !v)}
                  className={`icon-btn flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                    showTemplatePicker ? 'text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]'
                  }`}
                  title="Insert template"
                >
                  <FileText className="h-[20px] w-[20px]" />
                </button>
                {showTemplatePicker && (
                  <div className="float-in absolute bottom-full left-0 z-50 mb-3 w-80 overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#233138] shadow-2xl">
                    <div className="flex items-center justify-between border-b border-gray-100 dark:border-white/5 px-4 py-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.16em] text-gray-400 dark:text-[#8696A0]">
                        Templates · {templates.length}
                      </span>
                      <button type="button" onClick={() => setShowTemplatePicker(false)} className="rounded-full p-1 text-gray-400 hover:bg-gray-100 dark:hover:bg-white/10">
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <div className="max-h-72 overflow-y-auto chat-scroll p-2 space-y-1">
                      {templates.map((t) => {
                        const contactName = conversation?.contact?.name ?? '';
                        const contactPhone = conversation?.contact?.phone ?? '';
                        const blocks = t.payload?.blocks ?? [];
                        const subst = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => {
                          if (k === 'name') return contactName;
                          if (k === 'phone') return contactPhone;
                          return '';
                        });
                        const mediaBlock = blocks.find((b) => b.type === 'media' && b.url);
                        const nonMediaBlocks = blocks.filter((b) => b.type !== 'media');
                        const mediaCaptionText = blocks.length > 0
                          ? subst((mediaBlock?.caption as string) || '')
                          : subst(t.content);
                        const followUpText = nonMediaBlocks.length > 0 ? subst(blocksToText(nonMediaBlocks)) : '';
                        const previewText = blocks.length > 0 ? subst(blocksToText(blocks)) : subst(t.content);
                        const hasButtons = blocks.some((b) => b.type === 'buttons' || b.type === 'reminder' || b.type === 'support');
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={async () => {
                              setMessage(mediaCaptionText);
                              setTemplateFollowUp(mediaBlock ? followUpText : '');
                              if (mediaBlock?.url) {
                                try {
                                  const resp = await fetch(mediaBlock.url as string);
                                  const blob = await resp.blob();
                                  const urlParts = (mediaBlock.url as string).split('/');
                                  const fileName = urlParts[urlParts.length - 1] || 'media';
                                  const file = new File([blob], fileName, { type: blob.type });
                                  setAttachment(file);
                                } catch {
                                  // media fetch failed — text still applied
                                }
                              }
                              setShowTemplatePicker(false);
                              textareaRef.current?.focus();
                            }}
                            className="group/tpl w-full rounded-xl border border-transparent px-3 py-2.5 text-left transition-all hover:border-[#25D366]/30 hover:bg-[#25D366]/5 dark:hover:bg-[#25D366]/10"
                          >
                            <div className="flex items-center gap-1.5">
                              <p className="flex-1 text-sm font-semibold text-gray-900 dark:text-white group-hover/tpl:text-[#1FAA5C]">{t.name}</p>
                              {mediaBlock && <span className="rounded-full bg-violet-100 dark:bg-violet-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">Media</span>}
                              {hasButtons && <span className="rounded-full bg-blue-100 dark:bg-blue-900/40 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-blue-600 dark:text-blue-300">Btns</span>}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500 dark:text-[#8696A0]">{previewText}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Interactive message composer button */}
            <button
              type="button"
              onClick={() => setShowInteractiveComposer(true)}
              className={`icon-btn hidden sm:flex h-10 w-10 items-center justify-center rounded-full transition-colors ${
                showInteractiveComposer ? 'text-[#25D366]' : 'text-gray-500 dark:text-[#8696A0]'
              }`}
              title="Send interactive message (buttons, list, CTA)"
            >
              <StickyNote className="h-[20px] w-[20px]" />
            </button>

            <div className="relative flex-1">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={handleMessageChange}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                className="message-input-focus min-h-[36px] max-h-20 w-full resize-none rounded-2xl border border-transparent bg-white dark:bg-[#2A3942] px-4 py-2 pr-12 text-[15px] text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-[#8696A0] shadow-sm transition-all"
                rows={1}
              />
              {typingHint && (
                <div className="pointer-events-none absolute bottom-2.5 right-3 rounded-full bg-[#25D366]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1FAA5C]">
                  {typingHint}
                </div>
              )}
            </div>

            {message.trim() || attachment || recordedAudio ? (
              <button
                onClick={sendMessage}
                disabled={isSending}
                className="send-btn-active group/send flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white transition-all active:scale-95 disabled:opacity-70"
                type="button"
                aria-label="Send"
              >
                {isSending ? (
                  <Loader2 className="h-[18px] w-[18px] animate-spin" />
                ) : (
                  <Send className="h-[18px] w-[18px] transition-transform group-hover/send:translate-x-0.5 group-hover/send:-translate-y-0.5" />
                )}
              </button>
            ) : (
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-all active:scale-95 ${
                  isRecording
                    ? 'bg-red-500 text-white shadow-lg shadow-red-500/40'
                    : 'bg-gradient-to-br from-[#25D366] to-[#1FAA5C] text-white shadow-md shadow-[#25D366]/30 hover:shadow-lg hover:shadow-[#25D366]/40'
                }`}
                type="button"
                aria-label={isRecording ? 'Stop recording' : 'Start recording'}
              >
                {isRecording ? <Square className="h-[18px] w-[18px]" fill="currentColor" /> : <Mic className="h-[18px] w-[18px]" />}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== RIGHT PANEL ===== */}
      {showRightPanel && (
        <>
          {/* Mobile backdrop */}
          <div
            className="lg:hidden absolute inset-0 z-40 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowRightPanel(false)}
          />
          <div className="right-panel-mobile lg:relative flex w-[88%] sm:w-[400px] lg:w-80 shrink-0 flex-col border-l border-black/5 dark:border-white/5 bg-white dark:bg-[#111B21]">
            {/* Panel header with close on mobile */}
            <div className="lg:hidden flex items-center justify-between border-b border-gray-200 dark:border-white/5 px-4 py-3">
              <p className="text-sm font-semibold text-gray-900 dark:text-white">Conversation Details</p>
              <button
                type="button"
                onClick={() => setShowRightPanel(false)}
                className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100 dark:hover:bg-white/10"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tab bar */}
            <div className="relative flex border-b border-gray-200 dark:border-white/5">
              {([
                { id: 'details' as const, label: 'Details', icon: MessageSquare, color: '#25D366' },
                { id: 'notes' as const, label: 'Notes', icon: StickyNote, color: '#F59E0B' },
                { id: 'history' as const, label: 'History', icon: GitBranch, color: '#3B82F6' },
              ]).map((tab) => {
                const Icon = tab.icon;
                const isActive = rightTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setRightTab(tab.id)}
                    className="relative flex flex-1 flex-col items-center justify-center gap-1 py-3 text-[11px] font-semibold uppercase tracking-wider transition-colors"
                    style={{ color: isActive ? tab.color : undefined }}
                  >
                    <Icon className={`h-4 w-4 transition-colors ${isActive ? '' : 'text-gray-400 dark:text-[#8696A0]'}`} />
                    <span className={isActive ? '' : 'text-gray-500 dark:text-[#8696A0]'}>{tab.label}</span>
                    {isActive && (
                      <div
                        className="absolute bottom-0 left-1/4 right-1/4 h-0.5 rounded-t-full"
                        style={{ background: tab.color }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {rightTab === 'details' && (
              <div className="chat-scroll flex-1 overflow-y-auto px-4 py-5 space-y-5">
                {/* Contact card */}
                {conversation.contact && (
                  <div className="pop-in relative overflow-hidden rounded-2xl border border-gray-200 dark:border-white/10 bg-gradient-to-br from-[#25D366]/5 via-white to-white dark:from-[#25D366]/10 dark:via-[#1F2C33] dark:to-[#1F2C33] p-4">
                    <div className="absolute -top-12 -right-12 h-32 w-32 rounded-full bg-[#25D366]/10 blur-2xl pointer-events-none" />
                    <div className="relative flex items-center gap-3">
                      <div className="avatar-ring rounded-full">
                        <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-[#25D366] to-[#128C7E] text-base font-bold text-white">
                          {contactAvatar ? (
                            <img src={contactAvatar} alt={contactName} className="h-full w-full object-cover" />
                          ) : (
                            contactName.charAt(0).toUpperCase()
                          )}
                        </div>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-gray-900 dark:text-white">{contactName}</p>
                        <p className="truncate text-xs text-gray-500 dark:text-[#8696A0]">{contactPhone}</p>
                      </div>
                    </div>
                    {contactId && (
                      <button
                        type="button"
                        onClick={() => router.push(`/contacts?id=${contactId}`)}
                        className="relative mt-3 w-full rounded-xl border border-gray-200 dark:border-white/10 bg-white/80 dark:bg-white/5 py-2 text-xs font-semibold text-gray-700 dark:text-[#E9EDEF] transition-all hover:border-[#25D366]/40 hover:bg-[#25D366]/5 hover:text-[#1FAA5C]"
                      >
                        View Full Profile →
                      </button>
                    )}
                  </div>
                )}

                {/* Status */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-[#8696A0]">
                    <span className={`h-1.5 w-1.5 rounded-full ${statusLabel === 'open' ? 'bg-[#25D366]' : statusLabel === 'pending' ? 'bg-amber-400' : 'bg-slate-400'}`} />
                    Status
                  </label>
                  <select
                    value={conversation.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2.5 pr-9 text-sm font-medium text-gray-900 dark:text-white shadow-sm transition-all focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238696A0' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="OPEN">Open</option>
                    <option value="PENDING">Pending</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="ARCHIVED">Archived</option>
                    <option value="SPAM">Spam</option>
                  </select>
                </div>

                {/* Pipeline */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-[#8696A0]">
                    <GitBranch className="h-3 w-3" />
                    Pipeline Stage
                  </label>
                  <select
                    value={conversation.pipeline || ''}
                    onChange={(e) => handlePipelineChange(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2.5 pr-9 text-sm font-medium text-gray-900 dark:text-white shadow-sm transition-all focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238696A0' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    {PIPELINE_STAGES.map((stage) => (
                      <option key={stage} value={stage}>
                        {PIPELINE_LABELS[stage]}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Assign Agent */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-[#8696A0]">
                    <User className="h-3 w-3" />
                    Assigned Agent
                    {isAssigning && <Loader2 className="h-3 w-3 animate-spin text-[#25D366]" />}
                  </label>
                  <select
                    value={conversation.assignedTo || ''}
                    onChange={(e) => handleAssignAgent(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2.5 pr-9 text-sm font-medium text-gray-900 dark:text-white shadow-sm transition-all focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238696A0' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="">Unassigned</option>
                    {agents.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.name || agent.email}
                      </option>
                    ))}
                  </select>
                  {conversation.assignedUser && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-[10px] font-bold text-white shadow-sm">
                        {(conversation.assignedUser.name || conversation.assignedUser.email).charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-indigo-700 dark:text-indigo-300 truncate">
                        {conversation.assignedUser.name || conversation.assignedUser.email}
                      </span>
                    </div>
                  )}
                </div>

                {/* Assign Team */}
                <div>
                  <label className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.16em] text-gray-500 dark:text-[#8696A0]">
                    <Users className="h-3 w-3" />
                    Assigned Team
                  </label>
                  <select
                    value={conversation.assignedTeamId || ''}
                    onChange={(e) => handleAssignTeam(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#202C33] px-3 py-2.5 pr-9 text-sm font-medium text-gray-900 dark:text-white shadow-sm transition-all focus:border-[#25D366] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20"
                    style={{ backgroundImage: `url("data:image/svg+xml;charset=US-ASCII,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%238696A0' d='M3 5l3 3 3-3z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}
                  >
                    <option value="">No Team</option>
                    {teams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>
                  {conversation.assignedTeam && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-violet-600 text-[10px] font-bold text-white shadow-sm">
                        {conversation.assignedTeam.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate">
                        {conversation.assignedTeam.name}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {rightTab === 'notes' && conversationId && (
              <div className="flex-1 overflow-hidden">
                <InternalNotes conversationId={conversationId} />
              </div>
            )}

            {rightTab === 'history' && conversationId && (
              <AssignmentHistory conversationId={conversationId} />
            )}
          </div>
        </>
      )}

      {forwardMessage !== null && (
        <ForwardModal
          messageBody={forwardMessage}
          onClose={() => setForwardMessage(null)}
        />
      )}

      {showInteractiveComposer && conversationId && (
        <InteractiveComposer
          conversationId={conversationId}
          phone={recipientPhone || conversation?.contact?.phone || ''}
          provider="meta"
          onClose={() => setShowInteractiveComposer(false)}
          onSent={() => {
            fetchConversation();
            try { window.dispatchEvent(new Event('conversations:refetch')); } catch {}
          }}
        />
      )}

      <SaveContactModal
        isOpen={showSaveContactModal}
        onClose={() => setShowSaveContactModal(false)}
        phone={conversation?.contact?.phone || ''}
        name={conversation?.contact?.name}
        onSuccess={() => {
          fetchConversation();
          try { window.dispatchEvent(new Event('conversations:refetch')); } catch {}
          onContactSaved?.();
        }}
      />
    </div>
  );
}
