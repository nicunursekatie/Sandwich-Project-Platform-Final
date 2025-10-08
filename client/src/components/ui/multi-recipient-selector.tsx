import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

export interface Recipient {
  id: number;
  name: string;
}

interface MultiRecipientSelectorProps {
  value?: number[];
  onChange?: (value: number[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export const MultiRecipientSelector: React.FC<MultiRecipientSelectorProps> = ({
  value = [],
  onChange,
  placeholder = "Select recipient organizations...",
  className = '',
  disabled = false,
  'data-testid': testId,
}) => {
  const [selectedIds, setSelectedIds] = useState<number[]>(value);
  const [selectValue, setSelectValue] = useState<string>('');

  // Fetch recipients from the API
  const {
    data: recipients = [],
    isLoading,
    error,
  } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Sync with controlled value
  useEffect(() => {
    setSelectedIds(value);
  }, [value]);

  // Handle adding a recipient
  const handleAddRecipient = (recipientId: string) => {
    const id = parseInt(recipientId);
    if (id && !selectedIds.includes(id)) {
      const newIds = [...selectedIds, id];
      setSelectedIds(newIds);
      if (onChange) {
        onChange(newIds);
      }
    }
    setSelectValue(''); // Reset select
  };

  // Handle removing a recipient
  const handleRemoveRecipient = (recipientId: number) => {
    const newIds = selectedIds.filter(id => id !== recipientId);
    setSelectedIds(newIds);
    if (onChange) {
      onChange(newIds);
    }
  };

  // Get recipient name by ID
  const getRecipientName = (id: number): string => {
    const recipient = recipients.find(r => r.id === id);
    return recipient?.name || `Unknown (ID: ${id})`;
  };

  // Get available recipients (not already selected)
  const availableRecipients = recipients.filter(r => !selectedIds.includes(r.id));

  return (
    <div className={`space-y-3 ${className}`} data-testid={testId}>
      {/* Selected Recipients as Badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => (
            <Badge
              key={id}
              variant="secondary"
              className="flex items-center gap-1 px-3 py-1 text-sm"
              data-testid={`badge-recipient-${id}`}
            >
              {getRecipientName(id)}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemoveRecipient(id)}
                  className="ml-1 hover:text-destructive"
                  data-testid={`button-remove-recipient-${id}`}
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}

      {/* Add Recipient Selector */}
      {!disabled && availableRecipients.length > 0 && (
        <Select
          value={selectValue}
          onValueChange={handleAddRecipient}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full" data-testid={`${testId}-select`}>
            <SelectValue placeholder={
              isLoading ? "Loading recipients..." : 
              selectedIds.length > 0 ? "Add another recipient..." : 
              placeholder
            } />
          </SelectTrigger>
          <SelectContent>
            {error && (
              <SelectItem value="error" disabled>
                Error loading recipients
              </SelectItem>
            )}
            {availableRecipients.length === 0 && !error && (
              <SelectItem value="none" disabled>
                {selectedIds.length > 0 ? "All recipients selected" : "No recipients available"}
              </SelectItem>
            )}
            {availableRecipients.map((recipient) => (
              <SelectItem key={recipient.id} value={recipient.id.toString()}>
                {recipient.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Info text */}
      {selectedIds.length === 0 && (
        <p className="text-sm text-gray-500">
          No recipients assigned yet. Use the dropdown above to add recipient organizations.
        </p>
      )}
    </div>
  );
};
