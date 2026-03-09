/**
 * TSP Contact Section
 *
 * Handles TSP contact assignment via user selection or custom text entry.
 * Includes collaboration field locking support.
 */
import * as React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, Edit } from 'lucide-react';
import { FieldLockIndicator } from '@/components/collaboration';
import type { EventFormData } from './types';

interface TspContactSectionProps {
  formData: EventFormData;
  setFormData: React.Dispatch<React.SetStateAction<any>>;
  users: any[];
  // Collaboration
  isCollaborationEnabled: boolean;
  isFieldLockedByOther: (fieldName: string) => boolean;
  getFieldLock: (fieldName: string) => any;
  handleFieldFocus: (fieldName: string) => void;
  handleFieldBlur: (fieldName: string) => void;
}

export const TspContactSection: React.FC<TspContactSectionProps> = ({
  formData,
  setFormData,
  users,
  isCollaborationEnabled,
  isFieldLockedByOther,
  getFieldLock,
  handleFieldFocus,
  handleFieldBlur,
}) => {
  return (
    <div>
      <div className="flex items-center gap-2 mb-2">
        <Label htmlFor="tspContact">TSP Contact Assignment</Label>
        {isCollaborationEnabled && isFieldLockedByOther('tspContact') && (
          <FieldLockIndicator
            lockedBy={getFieldLock('tspContact')?.lockedByName || 'Another user'}
            expiresAt={getFieldLock('tspContact')?.expiresAt}
            data-testid="field-lock-tsp-contact"
          />
        )}
      </div>
      <Tabs
        value={formData.customTspContact?.trim() ? 'custom' : 'user'}
        onValueChange={(value) => {
          if (value === 'custom') {
            setFormData((prev: any) => ({ ...prev, tspContact: '', customTspContact: prev.customTspContact || '' }));
          } else {
            setFormData((prev: any) => ({ ...prev, customTspContact: '', tspContact: prev.tspContact || '' }));
          }
        }}
      >
        <TabsList className="grid w-full grid-cols-2 mb-3">
          <TabsTrigger value="user" className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Select User
          </TabsTrigger>
          <TabsTrigger value="custom" className="flex items-center gap-2">
            <Edit className="w-4 h-4" />
            Custom Contact
          </TabsTrigger>
        </TabsList>

        <TabsContent value="user" className="space-y-2">
          <Select
            value={formData.tspContact}
            onValueChange={(value) => setFormData((prev: any) => ({ ...prev, tspContact: value, customTspContact: '' }))}
            disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
          >
            <SelectTrigger
              onFocus={() => handleFieldFocus('tspContact')}
              onBlur={() => handleFieldBlur('tspContact')}
              data-testid="select-tsp-contact"
            >
              <SelectValue placeholder="Select TSP contact" />
            </SelectTrigger>
            <SelectContent className="z-[200]" position="popper" sideOffset={5}>
              {users.filter((user) => user.id).map((user) => (
                <SelectItem key={user.id} value={user.id}>
                  {user.firstName && user.lastName
                    ? `${user.firstName} ${user.lastName}`
                    : user.email} ({user.email})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </TabsContent>

        <TabsContent value="custom" className="space-y-2">
          <Textarea
            id="customTspContact"
            value={formData.customTspContact}
            onChange={(e) => setFormData((prev: any) => ({ ...prev, customTspContact: e.target.value, tspContact: '' }))}
            onFocus={() => handleFieldFocus('tspContact')}
            onBlur={() => handleFieldBlur('tspContact')}
            placeholder="Enter custom TSP contact information (e.g., John Smith - john.smith@email.com - (555) 123-4567)"
            className="min-h-[100px]"
            disabled={isCollaborationEnabled && isFieldLockedByOther('tspContact')}
            data-testid="textarea-custom-tsp-contact"
          />
          <p className="text-xs text-gray-500">
            Use this for contacts not in the system. Enter name, email, phone, or other relevant information.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  );
};
