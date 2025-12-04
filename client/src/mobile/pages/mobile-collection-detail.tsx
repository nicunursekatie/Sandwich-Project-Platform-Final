import { useRoute, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import {
  Calendar,
  MapPin,
  Clock,
  User,
  Sandwich,
  Check,
  X,
  Edit,
  Phone,
} from 'lucide-react';
import { MobileShell } from '../components/mobile-shell';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

/**
 * Mobile collection detail screen - view collection details
 */
export function MobileCollectionDetail() {
  const [, navigate] = useLocation();
  const [, params] = useRoute('/m/collections/:id');
  const collectionId = params?.id;

  // Fetch collection details
  const { data: collection, isLoading, error } = useQuery({
    queryKey: ['/api/collections', collectionId],
    enabled: !!collectionId,
    staleTime: 60000,
  });

  if (isLoading) {
    return (
      <MobileShell title="Collection" showBack onBack={() => navigate('/m/collections')}>
        <div className="p-4 space-y-4 animate-pulse">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-3/4" />
          <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-1/2" />
          <div className="h-32 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </MobileShell>
    );
  }

  if (error || !collection) {
    return (
      <MobileShell title="Collection" showBack onBack={() => navigate('/m/collections')}>
        <div className="p-4 text-center py-12">
          <p className="text-slate-500 dark:text-slate-400">Collection not found</p>
          <button
            onClick={() => navigate('/m/collections')}
            className="mt-4 px-6 py-2 bg-brand-primary text-white rounded-full font-medium"
          >
            Back to Collections
          </button>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell
      title="Collection Details"
      showBack
      onBack={() => navigate('/m/collections')}
      headerActions={
        <button
          onClick={() => navigate(`/m/collections/${collectionId}/edit`)}
          className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
        >
          <Edit className="w-5 h-5" />
        </button>
      }
    >
      <div className="p-4 space-y-4">
        {/* Header with count */}
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-brand-primary/10 flex items-center justify-center">
                <Sandwich className="w-6 h-6 text-brand-primary" />
              </div>
              <div>
                <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                  {collection.count || 0}
                </p>
                <p className="text-sm text-slate-500 dark:text-slate-400">sandwiches</p>
              </div>
            </div>
            {collection.verified !== undefined && (
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium",
                collection.verified
                  ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400"
              )}>
                {collection.verified ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>Verified</span>
                  </>
                ) : (
                  <>
                    <X className="w-4 h-4" />
                    <span>Unverified</span>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Date */}
          {collection.date && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
              <Calendar className="w-4 h-4" />
              <span>
                {format(new Date(collection.date), 'EEEE, MMMM d, yyyy')}
              </span>
            </div>
          )}

          {collection.time && (
            <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400 mt-1">
              <Clock className="w-4 h-4" />
              <span>{collection.time}</span>
            </div>
          )}
        </div>

        {/* Host Info */}
        {(collection.hostName || collection.hostAddress) && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Host
            </h3>
            <div className="space-y-2">
              {collection.hostName && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  <span className="text-slate-900 dark:text-slate-100 font-medium">
                    {collection.hostName}
                  </span>
                </div>
              )}
              {collection.hostAddress && (
                <p className="text-slate-600 dark:text-slate-400 ml-6">
                  {collection.hostAddress}
                </p>
              )}
              {collection.hostPhone && (
                <a
                  href={`tel:${collection.hostPhone}`}
                  className="flex items-center gap-2 text-brand-primary ml-6"
                >
                  <Phone className="w-4 h-4" />
                  <span>{collection.hostPhone}</span>
                </a>
              )}
            </div>
          </div>
        )}

        {/* Driver Info */}
        {collection.driverName && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Driver
            </h3>
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-900 dark:text-slate-100 font-medium">
                {collection.driverName}
              </span>
            </div>
            {collection.driverPhone && (
              <a
                href={`tel:${collection.driverPhone}`}
                className="flex items-center gap-2 text-brand-primary mt-2 ml-6"
              >
                <Phone className="w-4 h-4" />
                <span>{collection.driverPhone}</span>
              </a>
            )}
          </div>
        )}

        {/* Recipient Info */}
        {(collection.recipientName || collection.recipientAddress) && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
              Recipient
            </h3>
            <div className="space-y-2">
              {collection.recipientName && (
                <p className="text-slate-900 dark:text-slate-100 font-medium">
                  {collection.recipientName}
                </p>
              )}
              {collection.recipientAddress && (
                <div className="flex items-start gap-2">
                  <MapPin className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
                  <span className="text-slate-600 dark:text-slate-400">
                    {collection.recipientAddress}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Notes */}
        {collection.notes && (
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">
              Notes
            </h3>
            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap">
              {collection.notes}
            </p>
          </div>
        )}
      </div>
    </MobileShell>
  );
}

export default MobileCollectionDetail;
