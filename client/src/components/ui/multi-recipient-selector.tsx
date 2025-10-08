import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X, Building, Home } from 'lucide-react';

export interface Recipient {
  id: number;
  name: string;
}

export interface Host {
  id: number;
  name: string;
}

interface MultiRecipientSelectorProps {
  value?: string[]; // Changed from number[] to string[] to support "host:ID" and "recipient:ID" format
  onChange?: (value: string[]) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  'data-testid'?: string;
}

export const MultiRecipientSelector: React.FC<MultiRecipientSelectorProps> = ({
  value = [],
  onChange,
  placeholder = "Select recipients or hosts...",
  className = '',
  disabled = false,
  'data-testid': testId,
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(value);
  const [selectValue, setSelectValue] = useState<string>('');
  const [customValue, setCustomValue] = useState<string>('');
  const [showCustomInput, setShowCustomInput] = useState<boolean>(false);

  // Fetch recipients from the API
  const {
    data: recipients = [],
    isLoading: isLoadingRecipients,
    error: recipientsError,
  } = useQuery<Recipient[]>({
    queryKey: ['/api/recipients'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  // Fetch hosts from the API
  const {
    data: hosts = [],
    isLoading: isLoadingHosts,
    error: hostsError,
  } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
    staleTime: 10 * 60 * 1000, // 10 minutes
  });

  const isLoading = isLoadingRecipients || isLoadingHosts;
  const error = recipientsError || hostsError;

  // Sync with controlled value
  useEffect(() => {
    setSelectedIds(value);
  }, [value]);

  // Handle adding an item (recipient, host, or custom)
  const handleAdd = (selection: string) => {
    if (selection === 'custom') {
      setShowCustomInput(true);
      setSelectValue('custom');
      return;
    }
    
    if (selection && !selectedIds.includes(selection)) {
      const newIds = [...selectedIds, selection];
      setSelectedIds(newIds);
      if (onChange) {
        onChange(newIds);
      }
    }
    setSelectValue(''); // Reset select
    setShowCustomInput(false);
  };

  // Handle custom text entry
  const handleAddCustom = () => {
    if (customValue.trim() && !selectedIds.includes(`custom:${customValue.trim()}`)) {
      const newIds = [...selectedIds, `custom:${customValue.trim()}`];
      setSelectedIds(newIds);
      if (onChange) {
        onChange(newIds);
      }
    }
    setCustomValue('');
    setShowCustomInput(false);
    setSelectValue('');
  };

  // Handle removing an item
  const handleRemove = (id: string) => {
    const newIds = selectedIds.filter(item => item !== id);
    setSelectedIds(newIds);
    if (onChange) {
      onChange(newIds);
    }
  };

  // Get display name for an ID
  const getDisplayName = (id: string): { name: string; icon: React.ReactNode; type: string } => {
    // Parse the ID format (host:5, recipient:10, or custom:text)
    if (id.startsWith('host:')) {
      const hostId = parseInt(id.replace('host:', ''));
      const host = hosts.find(h => h.id === hostId);
      return { 
        name: host?.name || `Unknown Host (${hostId})`, 
        icon: <Home className="w-3 h-3" />,
        type: 'host'
      };
    } else if (id.startsWith('recipient:')) {
      const recipientId = parseInt(id.replace('recipient:', ''));
      const recipient = recipients.find(r => r.id === recipientId);
      return { 
        name: recipient?.name || `Unknown Recipient (${recipientId})`, 
        icon: <Building className="w-3 h-3" />,
        type: 'recipient'
      };
    } else if (id.startsWith('custom:')) {
      return { 
        name: id.replace('custom:', ''), 
        icon: null,
        type: 'custom'
      };
    }
    
    // Fallback for legacy numeric IDs (treat as recipient)
    const numId = parseInt(id);
    if (!isNaN(numId)) {
      const recipient = recipients.find(r => r.id === numId);
      return { 
        name: recipient?.name || `Unknown (${id})`, 
        icon: <Building className="w-3 h-3" />,
        type: 'recipient'
      };
    }
    
    return { name: id, icon: null, type: 'unknown' };
  };

  // Get available options (not already selected)
  const availableHosts = hosts.filter(h => !selectedIds.includes(`host:${h.id}`));
  const availableRecipients = recipients.filter(r => !selectedIds.includes(`recipient:${r.id}`));

  return (
    <div className={`space-y-3 ${className}`} data-testid={testId}>
      {/* Selected Items as Badges */}
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedIds.map((id) => {
            const { name, icon, type } = getDisplayName(id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1 px-3 py-1 text-sm"
                data-testid={`badge-${type}-${id}`}
              >
                {icon}
                <span>{name}</span>
                {!disabled && (
                  <button
                    type="button"
                    onClick={() => handleRemove(id)}
                    className="ml-1 hover:text-destructive"
                    data-testid={`button-remove-${id}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Add Item Selector */}
      {!disabled && (
        <Select
          value={selectValue}
          onValueChange={handleAdd}
          disabled={isLoading}
        >
          <SelectTrigger className="w-full" data-testid={`${testId}-select`}>
            <SelectValue placeholder={
              isLoading ? "Loading..." : 
              selectedIds.length > 0 ? "Add another..." : 
              placeholder
            } />
          </SelectTrigger>
          <SelectContent>
            {error && (
              <SelectItem value="error" disabled>
                Error loading data
              </SelectItem>
            )}
            
            {/* Hosts Section */}
            {availableHosts.length > 0 && (
              <>
                <SelectItem value="hosts-header" disabled className="font-semibold text-[#236383]">
                  <div className="flex items-center gap-2">
                    <Home className="w-4 h-4" />
                    <span>Hosts</span>
                  </div>
                </SelectItem>
                {availableHosts.map((host) => (
                  <SelectItem key={`host-${host.id}`} value={`host:${host.id}`}>
                    <div className="flex items-center gap-2 pl-4">
                      <Home className="w-3 h-3 text-gray-500" />
                      <span>{host.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Recipients Section */}
            {availableRecipients.length > 0 && (
              <>
                <SelectItem value="recipients-header" disabled className="font-semibold text-[#236383]">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4" />
                    <span>Recipient Organizations</span>
                  </div>
                </SelectItem>
                {availableRecipients.map((recipient) => (
                  <SelectItem key={`recipient-${recipient.id}`} value={`recipient:${recipient.id}`}>
                    <div className="flex items-center gap-2 pl-4">
                      <Building className="w-3 h-3 text-gray-500" />
                      <span>{recipient.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </>
            )}
            
            {/* Custom Entry Option */}
            <SelectItem value="custom">
              Custom destination...
            </SelectItem>
            
            {availableHosts.length === 0 && availableRecipients.length === 0 && !error && (
              <SelectItem value="none" disabled>
                {selectedIds.length > 0 ? "All options selected" : "No options available"}
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      )}

      {/* Custom Entry Input */}
      {showCustomInput && !disabled && (
        <div className="flex gap-2">
          <Input
            type="text"
            placeholder="Enter custom destination..."
            value={customValue}
            onChange={(e) => setCustomValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCustom();
              } else if (e.key === 'Escape') {
                setShowCustomInput(false);
                setSelectValue('');
                setCustomValue('');
              }
            }}
            className="flex-1"
            autoFocus
            data-testid={`${testId}-custom-input`}
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddCustom}
            disabled={!customValue.trim()}
            data-testid={`${testId}-custom-add`}
          >
            Add
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              setShowCustomInput(false);
              setSelectValue('');
              setCustomValue('');
            }}
            data-testid={`${testId}-custom-cancel`}
          >
            Cancel
          </Button>
        </div>
      )}

      {/* Info text */}
      {selectedIds.length === 0 && !showCustomInput && (
        <p className="text-sm text-gray-500">
          No recipients assigned yet. Use the dropdown above to add hosts, recipient organizations, or custom destinations.
        </p>
      )}
    </div>
  );
};
