import Link from 'next/link';
import { Edit, MessageSquare, PlusCircle, Trash2 } from 'lucide-react';
import { formatPhone } from '../../lib/phone';

interface Contact {
  id: string;
  phone: string;
  name: string | null;
  tag: string | null;
  notes: string | null;
  createdAt: string;
}

interface ContactsTableProps {
  contacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (id: string) => void;
  onOpenDetails: (contact: Contact) => void;
}

export default function ContactsTable({ contacts, onEdit, onDelete, onOpenDetails }: ContactsTableProps) {
  return (
    <div className="space-y-0 rounded-2xl border border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] overflow-hidden shadow-card dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-white/5 bg-gray-50 dark:bg-[#202C33]">
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Name</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Phone</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Tag</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Notes</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Created</th>
              <th className="px-6 py-4 text-left text-xs font-semibold uppercase tracking-wider text-gray-700 dark:text-[#8696A0]">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-white/5">
            {contacts.map((contact) => (
              <tr key={contact.id} className="hover:bg-gray-50 dark:hover:bg-white/3 transition-colors">
                <td className="px-6 py-3 text-sm font-medium text-gray-900 dark:text-white">{contact.name || '-'}</td>
                <td className="px-6 py-3 text-sm text-gray-600 dark:text-[#8696A0]">{formatPhone(contact.phone)}</td>
                <td className="px-6 py-3 text-sm">
                  <div className="flex flex-wrap gap-1">
                    {(contact.tag ? contact.tag.split(',').map((tag) => tag.trim()).filter(Boolean) : []).map((tag) => (
                      <span key={tag} className="inline-flex rounded-full bg-[#25D366]/10 dark:bg-[#25D366]/15 px-2.5 py-1 text-xs font-medium text-[#25D366]">
                        {tag}
                      </span>
                    ))}
                    {!contact.tag && <span className="text-gray-400 dark:text-[#8696A0]">-</span>}
                  </div>
                </td>
                <td className="px-6 py-3 max-w-xs truncate text-sm text-gray-600 dark:text-[#8696A0]">{contact.notes || '-'}</td>
                <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-[#8696A0]">{new Date(contact.createdAt).toLocaleDateString()}</td>
                <td className="px-6 py-3 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <button onClick={() => onEdit(contact)} className="p-1.5 text-[#25D366] dark:text-[#25D366] hover:text-[#25D366]/80 dark:hover:text-[#25D366]/80 transition-colors" type="button" title="Edit">
                      <Edit className="h-4 w-4" />
                    </button>
                    <button type="button" onClick={() => onOpenDetails(contact)} className="px-2 py-1 text-xs font-medium text-[#25D366] dark:text-[#25D366] hover:text-[#25D366]/80 dark:hover:text-[#25D366]/80 transition-colors" title="View">
                      View
                    </button>
                    <Link href={`/tasks?contactId=${encodeURIComponent(contact.id)}`} className="p-1.5 text-[#25D366] dark:text-[#25D366] hover:text-[#25D366]/80 dark:hover:text-[#25D366]/80 transition-colors" title="Task">
                      <PlusCircle className="h-4 w-4" />
                    </Link>
                    <Link href={`/deals?contactId=${encodeURIComponent(contact.id)}`} className="p-1.5 text-[#25D366] dark:text-[#25D366] hover:text-[#25D366]/80 dark:hover:text-[#25D366]/80 transition-colors" title="Deal">
                      <PlusCircle className="h-4 w-4" />
                    </Link>
                    <button onClick={() => { window.location.href = `/conversations?phone=${encodeURIComponent(contact.phone)}`; }} className="p-1.5 text-[#25D366] dark:text-[#25D366] hover:text-[#25D366]/80 dark:hover:text-[#25D366]/80 transition-colors" title="Chat" type="button">
                      <MessageSquare className="h-4 w-4" />
                    </button>
                    <button onClick={() => onDelete(contact.id)} className="p-1.5 text-rose-600 dark:text-rose-400 hover:text-rose-700 dark:hover:text-rose-300 transition-colors" type="button" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
