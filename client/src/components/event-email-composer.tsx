import { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

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
  'Event Planning - {organizationName}',
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
  const { toast } = useToast();

  // Fetch available documents
  const { data: documents = [] } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });

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

  // Initialize with comprehensive template when component opens
  useEffect(() => {
    if (isOpen && !content) {
      const eventDetails = formatEventDetails();
      const template = `Hi ${eventRequest.firstName}!

Thanks for reaching out and for your interest in making sandwiches for us! I've attached our complete toolkit to help you prepare for a successful sandwich-making event.

Groups can hold their events any day of the week if they can make 200 or more sandwiches. We also use volunteer drivers to pick up deli sandwiches, so you don't have to transport them. Once you set a date for your event, we'd appreciate at least two weeks' notice to add you to our schedule.

🔗 HELPFUL RESOURCES:

📊 Inventory Calculator: https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html
Use this tool to calculate exactly how much food you'll need for your event!

📋 Food Safety Guidelines & Sandwich Making Instructions (attached)
- Deli Sandwich Making 101
- PBJ Sandwich Making 101  
- Food Safety Guidelines for Volunteers

⚠️ IMPORTANT FOOD SAFETY REQUIREMENTS:
• A refrigerator is necessary to make deli sandwiches so that meat, cheese, and sandwiches are always cold
• Food-safe gloves must be worn at all times
• Anyone with long hair must tie it back
• Sandwiches must be made indoors
• Do not use the heel of the bread loaf

📅 NEXT STEP - Schedule Your Planning Call:
Once you've reviewed everything, we'd love to schedule a brief planning call! Please use the link below to book a time within 2-3 business days:

🗓️ Schedule a Call: https://thesandwichproject.as.me/

We look forward to working with you to make a difference in our community!

Best regards,
Stephanie Luis
The Sandwich Project
📞 678.372.9024
📧 info@thesandwichproject.org
🌐 www.thesandwichproject.org`;

      setContent(template);
      setSubject(
        `The Sandwich Project - Event Resources for ${eventRequest.organizationName}`
      );

      // Pre-select toolkit documents from attached_assets folder
      setSelectedAttachments([
        '/attached_assets/20240622-TSP-Deli Sandwich Making 101_1749341916236.pdf',
        '/attached_assets/20250205-TSP-PBJ Sandwich Making 101_1753670644141.pdf',
        '/attached_assets/20230525-TSP-Food Safety Volunteers (1)_1753670644140.pdf',
      ]);
    }
  }, [isOpen, eventRequest, formatEventDetails]);

  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: {
      recipientEmail: string;
      subject: string;
      content: string;
      isDraft: boolean;
      attachments: string[];
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
        contextType: 'event_request',
        contextId: eventRequest.id.toString(),
        contextTitle: `Event: ${eventRequest.organizationName}`,
      });
    },
    onSuccess: () => {
      toast({
        title: isDraft ? 'Draft saved successfully' : 'Email sent successfully',
        description: isDraft
          ? 'You can find the draft in your email drafts folder'
          : `Email sent to ${eventRequest.firstName} ${eventRequest.lastName}`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/emails'] });
      onEmailSent?.();
      onClose();
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
    });
  };

  const toggleAttachment = (fileUrl: string) => {
    setSelectedAttachments((prev) =>
      prev.includes(fileUrl)
        ? prev.filter((f) => f !== fileUrl)
        : [...prev, fileUrl]
    );
  };

  const getDocumentIcon = (fileName: string) => {
    if (fileName.includes('Inventory')) return Calculator;
    if (fileName.includes('Safety')) return Shield;
    if (fileName.includes('Making')) return Users;
    return FileText;
  };

  // Available toolkit documents (inventory calculator is now online)
  const toolkitDocuments = [
    {
      name: 'Food Safety Guidelines',
      url: '/toolkit/food-safety-volunteers.pdf',
    },
    {
      name: 'Deli Sandwich Instructions',
      url: '/toolkit/deli-sandwich-making-101.pdf',
    },
    {
      name: 'PB&J Sandwich Instructions',
      url: '/toolkit/pbj-sandwich-making-101.pdf',
    },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Mail className="w-5 h-5 text-teal-600" />
            Send Email to Event Contact
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
            <Label htmlFor="content" className="text-sm font-medium">
              Message
            </Label>
            <div className="text-xs text-gray-500 mb-2 p-2 bg-blue-50 rounded border border-blue-200">
              💡 <strong>Quick Links:</strong> Inventory Calculator:
              https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html
              | Schedule Call: https://thesandwichproject.as.me/
            </div>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Write your message here..."
              className="min-h-[300px] w-full resize-none"
            />
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attach Toolkit Documents (optional)
            </Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {toolkitDocuments.map((doc) => {
                const IconComponent = getDocumentIcon(doc.name);
                const isSelected = selectedAttachments.includes(doc.url);

                return (
                  <Card
                    key={doc.url}
                    className={`cursor-pointer transition-all duration-200 ${
                      isSelected
                        ? 'bg-gradient-to-r from-teal-100 to-cyan-200 border-teal-300 shadow-md'
                        : 'bg-gradient-to-r from-gray-50 to-white border-gray-200 hover:border-teal-200'
                    }`}
                    onClick={() => toggleAttachment(doc.url)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onChange={() => toggleAttachment(doc.url)}
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
                            {doc.name}
                          </p>
                          <p className="text-xs text-gray-500 uppercase">PDF</p>
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
                className="flex items-center gap-2"
              >
                <Clock className="w-4 h-4" />
                Save as Draft
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
                {sendEmailMutation.isPending ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
