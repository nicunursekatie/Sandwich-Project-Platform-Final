import { Building2, Car, Users } from 'lucide-react';
import { useDashboardNavigation } from '@/contexts/dashboard-navigation-context';
import { FloatingAIChat } from '@/components/floating-ai-chat';

export default function TSPNetwork() {
  const { setActiveSection } = useDashboardNavigation();

  const networkCards = [
    {
      id: 'hosts',
      title: 'Hosts',
      description: 'Manage host locations and schedules',
      icon: Building2,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50',
    },
    {
      id: 'drivers',
      title: 'Drivers',
      description: 'Manage delivery drivers and routes',
      icon: Car,
      iconBg: 'bg-green-100',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      hoverBg: 'hover:bg-green-50',
    },
    {
      id: 'volunteers',
      title: 'Volunteers',
      description: 'Manage volunteer team members',
      icon: Users,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      hoverBg: 'hover:bg-purple-50',
    },
    {
      id: 'recipients',
      title: 'Recipients',
      description: 'Manage recipient organizations',
      icon: Users,
      iconBg: 'bg-orange-100',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      hoverBg: 'hover:bg-orange-50',
    },
  ];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-brand-primary">
          <Users className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">TSP Network</h1>
          <p className="text-gray-600">
            Manage all the people and organizations in The Sandwich Project network
          </p>
        </div>
      </div>

      {/* Network Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {networkCards.map((card) => {
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              onClick={() => {
                setActiveSection(card.id);
                window.history.pushState({}, '', `/dashboard?section=${card.id}`);
              }}
              className={`group relative bg-white rounded-xl border-2 ${card.borderColor} ${card.hoverBg} p-6 text-left transition-all duration-200 hover:shadow-lg hover:scale-[1.02] active:scale-[0.98]`}
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-14 h-14 rounded-xl ${card.iconBg} mb-4 group-hover:scale-110 transition-transform duration-200`}>
                <Icon className={`w-7 h-7 ${card.iconColor}`} />
              </div>

              {/* Content */}
              <h3 className="text-xl font-bold text-gray-900 mb-2">
                {card.title}
              </h3>
              <p className="text-gray-600 text-sm">
                {card.description}
              </p>

              {/* Arrow indicator */}
              <div className="absolute top-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <svg
                  className="w-6 h-6 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
            </button>
          );
        })}
      </div>

      {/* Quick Stats or Additional Info */}
      <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-xl border-2 border-teal-200 p-6 mt-8">
        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-primary" />
          About TSP Network
        </h3>
        <p className="text-sm text-gray-700">
          The TSP Network includes all the people and organizations that make our mission possible.
          Each group plays a vital role in collecting and distributing sandwiches to those in need.
        </p>
      </div>

      {/* AI Assistant */}
      <FloatingAIChat
        contextType="general"
        title="Network Assistant"
        subtitle="Ask about hosts, drivers, and volunteers"
        suggestedQuestions={[
          "How many active hosts do we have?",
          "How do I add a new volunteer?",
          "What drivers are available?",
          "Show me recent network changes",
          "How do I update host information?",
          "What recipients are we serving?",
        ]}
      />
    </div>
  );
}
