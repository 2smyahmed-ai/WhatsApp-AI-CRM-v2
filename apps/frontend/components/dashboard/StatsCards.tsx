import { Users, MessageSquare, Zap, Phone } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

interface StatsCardsProps {
  data: {
    totalContacts: number;
    openConversations: number;
    todayMessages: number;
    automationsFired: number;
  };
}

export default function StatsCards({ data }: StatsCardsProps) {
  const stats = [
    {
      name: 'Total Contacts',
      value: data.totalContacts,
      icon: Users,
      bgColor: 'bg-blue-50 dark:bg-blue-500/10',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      name: 'Open Conversations',
      value: data.openConversations,
      icon: MessageSquare,
      bgColor: 'bg-[#25D366]/10 dark:bg-[#25D366]/15',
      iconColor: 'text-[#25D366]',
    },
    {
      name: 'Messages Today',
      value: data.todayMessages,
      icon: Phone,
      bgColor: 'bg-purple-50 dark:bg-purple-500/10',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      name: 'Automations Fired',
      value: data.automationsFired,
      icon: Zap,
      bgColor: 'bg-orange-50 dark:bg-orange-500/10',
      iconColor: 'text-orange-600 dark:text-orange-400',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
      {stats.map((stat) => (
        <Card key={stat.name} className="border-gray-200 dark:border-white/10 bg-white dark:bg-[#111B21] shadow-soft dark:shadow-[0_8px_20px_rgba(0,0,0,0.2)]">
          <CardContent className="p-5">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm text-gray-600 dark:text-[#8696A0]">{stat.name}</p>
                <p className="mt-2 text-3xl font-semibold text-gray-900 dark:text-white">{stat.value}</p>
              </div>
              <div className={`rounded-2xl border border-gray-200 dark:border-white/10 ${stat.bgColor} p-3`}>
                <stat.icon className={`h-6 w-6 ${stat.iconColor}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
