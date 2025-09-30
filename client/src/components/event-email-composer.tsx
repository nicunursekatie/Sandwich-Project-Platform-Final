import { useState, useEffect, useRef } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import {
  Mail,
  Send,
  Paperclip,
  FileText,
  Calculator,
  Users,
  Clock,
  X,
  Shield,
  Calendar,
  History,
  Loader2,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface EventRequest {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  organizationName: string;
  department?: string;
  desiredEventDate?: string;
  eventAddress?: string;
  estimatedSandwichCount?: number;
  eventStartTime?: string;
  eventEndTime?: string;
  message?: string;
}

interface Document {
  id: number;
  title: string;
  fileName: string;
  category: string;
  filePath: string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  content: string;
  defaultAttachments: string[];
}

// Quick start options for subject line
const SUBJECT_SUGGESTIONS = [
  'Re: {organizationName} Event',
  'The Sandwich Project - Event Resources',
  'Event Requests - {organizationName}',
  'Follow-up: {organizationName}',
  'custom', // Custom subject
];

interface EventEmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  eventRequest: EventRequest;
  onEmailSent?: () => void;
}

export function EventEmailComposer({
  isOpen,
  onClose,
  eventRequest,
  onEmailSent,
}: EventEmailComposerProps) {
  const [selectedSubjectSuggestion, setSelectedSubjectSuggestion] =
    useState<string>('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');
  const [selectedAttachments, setSelectedAttachments] = useState<string[]>([]);
  const [isDraft, setIsDraft] = useState(false);
  const [includeSchedulingLink, setIncludeSchedulingLink] = useState(false);
  const [requestPhoneCall, setRequestPhoneCall] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  
  // Smart regeneration state management
  const [hasManualEdits, setHasManualEdits] = useState(false);
  const [isResettingToTemplate, setIsResettingToTemplate] = useState(false);
  const lastGeneratedContentRef = useRef<string>('');
  const isInitialLoad = useRef(true);
  const { toast } = useToast();
  const { user } = useAuth();

  // Fetch available documents
  const { data: documents = [], isLoading: isDocumentsLoading } = useQuery<Document[]>({
    queryKey: ['/api/storage/documents'],
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Fetch available drafts for this event request
  const { data: availableDrafts = [], isLoading: isDraftsLoading } = useQuery({
    queryKey: ['/api/emails/event', eventRequest.id, 'drafts'],
    queryFn: () => apiRequest('GET', `/api/emails/event/${eventRequest.id}/drafts`),
    enabled: isOpen, // Only fetch when dialog is open
  });

  // Check if current content has been manually edited
  const isContentManuallyEdited = () => {
    // If we don't have a last generated content, assume it's manual
    if (!lastGeneratedContentRef.current) return true;
    
    // Compare current content with last generated template (ignore whitespace differences)
    const currentContentNormalized = content.trim().replace(/\s+/g, ' ');
    const lastGeneratedNormalized = lastGeneratedContentRef.current.trim().replace(/\s+/g, ' ');
    
    return currentContentNormalized !== lastGeneratedNormalized;
  };

  // Smart regenerate - only regenerate if content hasn't been manually edited
  const smartRegenerateEmailContent = (includeScheduling: boolean, requestPhone: boolean, force: boolean = false) => {
    // If hasManualEdits is true, never regenerate (unless forced)
    if (hasManualEdits && !force) {
      return false; // Content was not regenerated
    }
    
    // If forced (Reset to Template) or content hasn't been manually edited, regenerate
    if (force || !isContentManuallyEdited()) {
      regenerateEmailContent(includeScheduling, requestPhone);
      setHasManualEdits(false);
      return true; // Content was regenerated
    }
    return false; // Content was not regenerated
  };

  // Regenerate email content based on selected options
  const regenerateEmailContent = (includeScheduling: boolean, requestPhone: boolean) => {
    const userName = user?.firstName && user?.lastName 
      ? `${user.firstName} ${user.lastName}`
      : user?.email || 'The Sandwich Project Team';
    
    const userPhone = user?.phoneNumber || '';
    const userEmail = user?.preferredEmail || user?.email || 'info@thesandwichproject.org';
    
    // Determine scheduling section based on selected options
    let schedulingCallText = '';
    
    if (includeScheduling) {
      schedulingCallText = `Once you have reviewed everything, we would love to connect! Please use the link below to schedule a quick call:

Within 2–3 business days of this email
Or within 24 hours if your event is happening in the next week

🗓️ https://thesandwichproject.as.me/`;
    } else if (requestPhone) {
      schedulingCallText = `Once you have reviewed everything, we would love to connect! Please reply to this email with your phone number and best times to call you. We'll reach out within 1-2 business days.`;
    } else {
      schedulingCallText = `Once you have reviewed everything, we would love to connect! Please reply to this email to schedule a planning call.`;
    }
    
    const template = `Hi ${eventRequest.firstName},

Thank you for reaching out and for your interest in making sandwiches with us! We are so glad you want to get involved. Attached you'll find a toolkit (everything you need to plan a sandwich-making event), plus a link to our interactive planning guide with an inventory calculator and food safety tips.


**Event Scheduling**

• Groups may host events on any day of the week if making 200+ sandwiches.

• If you have some flexibility with dates, let us know! We can suggest times when sandwiches are especially needed.

• Once you have set a date, we ask for at least two weeks' notice so we can add you to our schedule.


**Transportation**

• We provide transportation for 200+ deli sandwiches and for larger amounts of PBJs (based on volunteer driver availability).

• If you're located outside our host home radius, we would be happy to discuss delivery options with you.


**Food Safety Reminders**

• A refrigerator is required to make deli sandwiches so that meat, cheese, and sandwiches are always cold.

• Food-safe gloves must be worn.

• Hair should be tied back or in a hairnet.

• Sandwiches must be made indoors.

• We provide food to vulnerable populations, so please read and follow all safety rules.


${schedulingCallText}


We look forward to working with you!

Warmly,
${userName}${userPhone ? '\n' + userPhone : ''}
${userEmail}`;

    setContent(template);
    // Store the generated content for comparison
    lastGeneratedContentRef.current = template;
  };

  // Format event details for template insertion
  const formatEventDetails = () => {
    const details = [];
    if (eventRequest.desiredEventDate) {
      const date = new Date(eventRequest.desiredEventDate + 'T12:00:00');
      details.push(
        `Date: ${date.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        })}`
      );
    }
    if (eventRequest.eventStartTime && eventRequest.eventEndTime) {
      details.push(
        `Time: ${eventRequest.eventStartTime} - ${eventRequest.eventEndTime}`
      );
    }
    if (eventRequest.eventAddress) {
      details.push(`Location: ${eventRequest.eventAddress}`);
    }
    if (eventRequest.estimatedSandwichCount) {
      details.push(
        `Estimated Sandwiches: ${eventRequest.estimatedSandwichCount}`
      );
    }

    return details.length > 0 ? `\n${details.join('\n')}\n` : '';
  };

  // Apply subject suggestion when selected
  useEffect(() => {
    if (selectedSubjectSuggestion && selectedSubjectSuggestion !== 'custom') {
      const processedSubject = selectedSubjectSuggestion.replace(
        '{organizationName}',
        eventRequest.organizationName
      );
      setSubject(processedSubject);
    }
  }, [selectedSubjectSuggestion, eventRequest]);

  // Effect to handle option changes with smart regeneration
  useEffect(() => {
    // Skip on initial load or when resetting to template
    if (isInitialLoad.current || isResettingToTemplate) return;
    
    // Skip if dialog is not open
    if (!isOpen) return;
    
    // Skip if no content exists yet
    if (!content) return;
    
    // Always regenerate when checkboxes change (force=true to bypass manual edits check)
    regenerateEmailContent(includeSchedulingLink, requestPhoneCall);
    setHasManualEdits(false);
    
  }, [includeSchedulingLink, requestPhoneCall]);

  // Initialize with comprehensive template when component opens
  useEffect(() => {
    if (isOpen && !content) {
      // Just call regenerateEmailContent to avoid duplicating template logic
      regenerateEmailContent(includeSchedulingLink, requestPhoneCall);
      
      // Mark as not having manual edits initially
      setHasManualEdits(false);
      
      setSubject(
        `Thanks for reaching out to The Sandwich Project!`
      );
      
      // Clear initial load flag after first template generation
      isInitialLoad.current = false;
    }
  }, [isOpen, eventRequest, formatEventDetails, includeSchedulingLink, requestPhoneCall, user]);

  // Separate effect to handle default attachment selection after documents load
  useEffect(() => {
    // Only run when dialog is open, documents are loaded, and no attachments are currently selected
    // This ensures we don't override manually selected attachments or loaded drafts
    if (isOpen && documents.length > 0 && selectedAttachments.length === 0) {
      // Pre-select standard toolkit documents based on available documents
      const defaultAttachments = documents
        .filter(doc => {
          const searchText = `${doc.title} ${doc.fileName}`.toLowerCase();
          // Exclude recipients document - only for hosts and volunteers
          if (searchText.includes('recipient')) return false;
          
          return searchText.includes('food safety') || 
                 searchText.includes('deli') || 
                 searchText.includes('pbj') || 
                 searchText.includes('pb&j') ||
                 searchText.includes('sandwich making');
        })
        .map(doc => doc.filePath);
      
      if (defaultAttachments.length > 0) {
        setSelectedAttachments(defaultAttachments);
      }
    }
  }, [isOpen, documents, selectedAttachments.length]);

  // Reset state when dialog closes
  useEffect(() => {
    if (!isOpen) {
      // Reset all state when dialog closes
      setHasManualEdits(false);
      setIsResettingToTemplate(false);
      lastGeneratedContentRef.current = '';
      isInitialLoad.current = true;
      setDraftSaved(false);
    }
  }, [isOpen]);

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: {
      recipientEmail: string;
      subject: string;
      content: string;
      isDraft: boolean;
      attachments: string[];
      includeSchedulingLink: boolean;
      requestPhoneCall: boolean;
    }) => {
      return apiRequest('POST', '/api/emails/event', {
        eventRequestId: eventRequest.id,
        recipientId: 'external', // External contact
        recipientName: `${eventRequest.firstName} ${eventRequest.lastName}`,
        recipientEmail: emailData.recipientEmail,
        subject: emailData.subject,
        content: emailData.content,
        isDraft: emailData.isDraft,
        attachments: emailData.attachments,
        includeSchedulingLink: emailData.includeSchedulingLink,
        requestPhoneCall: emailData.requestPhoneCall,
        contextType: 'event_request',
        contextId: eventRequest.id.toString(),
        contextTitle: `Event: ${eventRequest.organizationName}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      
      if (isDraft) {
        // For drafts: Keep dialog open, show clear feedback
        toast({
          title: '📝 Draft Saved Successfully',
          description: `Your draft has been saved. You can continue editing or find it later in Communication > Inbox > Drafts folder.`,
          duration: 6000, // Longer duration for important info
        });
        // Reset the isDraft flag but keep dialog open for continued editing
        setIsDraft(false);
        setDraftSaved(true);
      } else {
        // For sent emails: Close dialog, show success
        toast({
          title: '✅ Email Sent Successfully',
          description: `Email sent to ${eventRequest.firstName} ${eventRequest.lastName}`,
        });
        onEmailSent?.();
        onClose();
      }
    },
    onError: (error) => {
      toast({
        title: 'Failed to send email',
        description:
          error instanceof Error ? error.message : 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleSend = (asDraft: boolean = false) => {
    if (!subject.trim() || !content.trim()) {
      toast({
        title: 'Missing information',
        description: 'Please enter both subject and content',
        variant: 'destructive',
      });
      return;
    }

    setIsDraft(asDraft);
    sendEmailMutation.mutate({
      recipientEmail: eventRequest.email,
      subject: subject.trim(),
      content: content.trim(),
      isDraft: asDraft,
      attachments: selectedAttachments,
      includeSchedulingLink: includeSchedulingLink,
      requestPhoneCall: requestPhoneCall,
    });
  };

  const toggleAttachment = (fileUrl: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(fileUrl)
        ? prev.filter((f) => f !== fileUrl)
        : [...prev, fileUrl]
    );
  };

  // Handle content changes to track manual edits
  const handleContentChange = (newContent: string) => {
    setContent(newContent);
    
    // Don't mark as manual edit if we're resetting to template or on initial load
    if (!isResettingToTemplate && !isInitialLoad.current) {
      // Only mark as manual edit if the content differs from last generated
      if (lastGeneratedContentRef.current && newContent.trim() !== lastGeneratedContentRef.current.trim()) {
        setHasManualEdits(true);
      }
    }
  };

  // Reset to template functionality
  const resetToTemplate = () => {
    setIsResettingToTemplate(true);
    smartRegenerateEmailContent(includeSchedulingLink, requestPhoneCall, true);
    setIsResettingToTemplate(false);
    
    toast({
      title: '✨ Template Refreshed',
      description: 'Email content has been reset to the current template with your selected options.',
      duration: 3000,
    });
  };

  // Load draft functionality
  const loadDraft = (draft: any) => {
    // Hydrate all state from the selected draft
    setSubject(draft.subject || '');
    setContent(draft.content || '');
    
    // Parse attachments if they exist (they might be stored as JSON)
    if (draft.attachments) {
      try {
        const attachments = typeof draft.attachments === 'string' 
          ? JSON.parse(draft.attachments) 
          : draft.attachments;
        setSelectedAttachments(attachments || []);
      } catch {
        setSelectedAttachments([]);
      }
    }
    
    // Load explicit boolean preferences from the draft data
    setIncludeSchedulingLink(draft.includeSchedulingLink || false);
    setRequestPhoneCall(draft.requestPhoneCall || false);
    
    // Clear the subject suggestion since we're loading a custom draft
    setSelectedSubjectSuggestion('custom');
    
    // Clear draft saved state since we're now editing
    setDraftSaved(false);
    
    // Mark as manual edits since we're loading custom draft content
    setHasManualEdits(true);
    lastGeneratedContentRef.current = draft.content || '';
    
    // Show success toast
    toast({
      title: '📝 Draft Loaded',
      description: `Draft from ${new Date(draft.updatedAt).toLocaleDateString()} has been loaded. You can continue editing.`,
      duration: 4000,
    });
  };

  const getDocumentIcon = (document: Document) => {
    const searchText = `${document.title} ${document.fileName}`.toLowerCase();
    if (searchText.includes('inventory') || searchText.includes('calculator')) return Calculator;
    if (searchText.includes('safety')) return Shield;
    if (searchText.includes('making') || searchText.includes('sandwich')) return Users;
    return FileText;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="w-5 h-5 text-teal-600" />
            Send Email to Event Contact
            {draftSaved && (
              <Badge 
                variant="outline" 
                className="ml-2 bg-amber-50 text-amber-700 border-amber-300"
              >
                📝 Draft Saved
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Recipient Info */}
          <Card className="bg-gradient-to-r from-teal-50 to-cyan-100 border border-teal-200">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-teal-600" />
                <div>
                  <p className="font-medium text-gray-900">
                    {eventRequest.firstName} {eventRequest.lastName}
                  </p>
                  <p className="text-sm text-gray-600">{eventRequest.email}</p>
                  <p className="text-sm text-teal-700 font-medium">
                    {eventRequest.organizationName}
                  </p>
                  {eventRequest.department && (
                    <p className="text-sm text-gray-600">
                      {eventRequest.department}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Load Draft Section */}
          {isDraftsLoading && (
            <Card className="bg-blue-50 border border-blue-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
                  <div>
                    <p className="font-medium text-blue-900">Loading drafts...</p>
                    <p className="text-sm text-blue-600">
                      Checking for previously saved drafts for this event.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {!isDraftsLoading && availableDrafts.length > 0 && (
            <Card className="bg-amber-50 border border-amber-200">
              <CardContent className="p-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <History className="w-5 h-5 text-amber-600" />
                    <Label className="text-sm font-medium text-amber-900">
                      Previous Drafts Found ({availableDrafts.length})
                    </Label>
                  </div>
                  <p className="text-sm text-amber-700">
                    You have saved drafts for this event. Load one to continue where you left off.
                  </p>
                  <div className="space-y-2">
                    {availableDrafts.map((draft: any) => (
                      <div
                        key={draft.id}
                        className="flex items-center justify-between p-3 bg-white rounded-lg border border-amber-200"
                      >
                        <div className="flex-1">
                          <p className="font-medium text-gray-900 truncate">
                            {draft.subject || 'Untitled Draft'}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span>
                              Saved: {new Date(draft.updatedAt).toLocaleDateString()} at {new Date(draft.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            <span>
                              To: {draft.recipientName}
                            </span>
                          </div>
                          {draft.content && (
                            <p className="text-sm text-gray-500 mt-1 truncate">
                              {draft.content.substring(0, 100)}...
                            </p>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => loadDraft(draft)}
                          className="ml-3 bg-amber-100 border-amber-300 text-amber-700 hover:bg-amber-200"
                          data-testid={`button-load-draft-${draft.id}`}
                        >
                          <History className="w-4 h-4 mr-1" />
                          Load Draft
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Original Request Message */}
          {eventRequest.message && (
            <Card className="bg-gray-50 border border-gray-200">
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-gray-600" />
                    <Label className="text-sm font-medium text-gray-700">
                      Original Request Message:
                    </Label>
                  </div>
                  <div className="pl-7">
                    <p className="text-sm text-gray-600 whitespace-pre-wrap">
                      {eventRequest.message}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Subject Suggestions */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">
              Quick Subject Ideas (optional)
            </Label>
            <Select
              value={selectedSubjectSuggestion}
              onValueChange={setSelectedSubjectSuggestion}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a subject suggestion or write your own" />
              </SelectTrigger>
              <SelectContent>
                {SUBJECT_SUGGESTIONS.map((suggestion, index) => (
                  <SelectItem key={index} value={suggestion}>
                    {suggestion === 'custom'
                      ? 'Custom subject'
                      : suggestion.replace(
                          '{organizationName}',
                          eventRequest.organizationName
                        )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <Label htmlFor="subject" className="text-sm font-medium">
              Subject
            </Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Enter email subject"
              className="w-full"
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="content" className="text-sm font-medium">
                Message
              </Label>
              {hasManualEdits && (
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded border border-amber-200">
                    <AlertTriangle className="w-3 h-3" />
                    Custom content - template won't auto-update
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={resetToTemplate}
                    className="text-xs h-7 bg-blue-50 border-blue-300 text-blue-700 hover:bg-blue-100"
                    data-testid="button-reset-template"
                  >
                    <RefreshCw className="w-3 h-3 mr-1" />
                    Reset to Template
                  </Button>
                </div>
              )}
            </div>
            <div className="text-xs text-gray-500 mb-2 p-2 bg-blue-50 rounded border border-blue-200">
              💡 <strong>Quick Links:</strong> Inventory Calculator:
              https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html
              | Schedule Call: https://thesandwichproject.as.me/
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => handleContentChange(e.target.value)}
              placeholder="Write your message here..."
              className="min-h-[300px] w-full resize-none"
            />
          </div>
          
          {/* Next Step Options */}
          <div className="space-y-3 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <Label className="text-sm font-medium text-gray-700">
              Next Steps for Event Scheduling (select at least one):
            </Label>
            
            {/* Scheduling Link Option */}
            <div className="flex items-center space-x-3">
              <Checkbox
                id="include-scheduling"
                checked={includeSchedulingLink}
                onCheckedChange={(checked) => {
                  setIncludeSchedulingLink(checked as boolean);
                  if (checked) {
                    setRequestPhoneCall(false); // Make them mutually exclusive
                  }
                }}
              />
              <Label 
                htmlFor="include-scheduling" 
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Calendar className="w-4 h-4 text-teal-600" />
                Include self-service scheduling link
              </Label>
            </div>
            
            {/* Phone Call Request Option */}
            <div className="flex items-center space-x-3">
              <Checkbox
                id="request-phone"
                checked={requestPhoneCall}
                onCheckedChange={(checked) => {
                  setRequestPhoneCall(checked as boolean);
                  if (checked) {
                    setIncludeSchedulingLink(false); // Make them mutually exclusive
                  }
                }}
              />
              <Label 
                htmlFor="request-phone" 
                className="flex items-center gap-2 cursor-pointer text-sm"
              >
                <Users className="w-4 h-4 text-orange-600" />
                Request they reply with phone number for follow-up call
              </Label>
            </div>
            
            {!includeSchedulingLink && !requestPhoneCall && (
              <p className="text-xs text-amber-600 italic">
                ⚠️ At least one follow-up method should be selected
              </p>
            )}
            
            {hasManualEdits && (includeSchedulingLink || requestPhoneCall) && (
              <p className="text-xs text-blue-600 italic bg-blue-50 p-2 rounded border border-blue-200">
                💡 Your custom content is preserved. Use "Reset to Template" above to apply these new options.
              </p>
            )}
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attach Documents (optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {documents.map((doc) => {
                const IconComponent = getDocumentIcon(doc);
                const isSelected = selectedAttachments.includes(doc.filePath);

                return (
                  <Card
                    key={doc.id}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-r from-teal-100 to-cyan-200 border-teal-300 shadow-md'
                        : 'bg-gradient-to-r from-gray-50 to-white border-gray-200 hover:border-teal-200'
                    }`}
                    onClick={() => toggleAttachment(doc.filePath)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleAttachment(doc.filePath)}
                          className="flex-shrink-0"
                        />
                        <IconComponent
                          className={`w-4 h-4 flex-shrink-0 ${
                            isSelected ? 'text-teal-600' : 'text-gray-500'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-sm font-medium truncate ${
                              isSelected ? 'text-teal-900' : 'text-gray-700'
                            }`}
                          >
                            {doc.title}
                          </p>
                          <p className="text-xs text-gray-500 uppercase">
                            {doc.category || 'Document'}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {selectedAttachments.length > 0 && (
              <div className="mt-3">
                <Badge
                  variant="outline"
                  className="bg-gradient-to-r from-teal-100 to-cyan-200 text-teal-800 border-teal-300"
                >
                  {selectedAttachments.length} document
                  {selectedAttachments.length !== 1 ? 's' : ''} selected
                </Badge>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t">
            <Button
              variant="outline"
              onClick={onClose}
              className="flex items-center gap-2"
            >
              <X className="w-4 h-4" />
              Cancel
            </Button>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => handleSend(true)}
                disabled={sendEmailMutation.isPending}
                className="flex items-center gap-2 border-amber-300 text-amber-700 hover:bg-amber-50"
              >
                <Clock className="w-4 h-4" />
                {sendEmailMutation.isPending && isDraft ? 'Saving Draft...' : 'Save as Draft'}
              </Button>

              <Button
                onClick={() => handleSend(false)}
                disabled={
                  sendEmailMutation.isPending ||
                  !subject.trim() ||
                  !content.trim()
                }
                className="flex items-center gap-2 bg-gradient-to-r from-teal-600 to-cyan-700 hover:from-teal-700 hover:to-cyan-800"
              >
                <Send className="w-4 h-4" />
                {sendEmailMutation.isPending && !isDraft ? 'Sending Email...' : 'Send Email Now'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
