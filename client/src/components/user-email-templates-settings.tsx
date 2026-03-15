import { useState, useRef, useCallback } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Save,
  RotateCcw,
  Eye,
  AlertTriangle,
  Check,
  Loader2,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface TemplateData {
  newOrgSubject: string;
  newOrgBody: string;
  returningContactSubject: string;
  returningContactBody: string;
  updatedAt: string | null;
  hasCustomized: boolean;
}

interface DefaultTemplates {
  newOrgSubject: string;
  newOrgBody: string;
  returningContactSubject: string;
  returningContactBody: string;
}

const MERGE_VARIABLES = [
  { key: '{{contact_name}}', label: 'Contact Name', description: "Event requester's name" },
  { key: '{{group_name}}', label: 'Organization', description: 'Organization name' },
  { key: '{{event_date}}', label: 'Event Date', description: 'Requested/scheduled date' },
  { key: '{{toolkit_link}}', label: 'Toolkit Link', description: 'Hardcoded toolkit URL' },
  { key: '{{tsp_contact_name}}', label: 'Your Name', description: "Logged-in user's name" },
];

type TabType = 'new_org' | 'returning_contact';

export default function UserEmailTemplatesSettings() {
  const { toast } = useToast();
  const [activeTemplateTab, setActiveTemplateTab] = useState<TabType>('new_org');
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewData, setPreviewData] = useState<{ subject: string | null; body: string | null } | null>(null);

  // Form state
  const [newOrgSubject, setNewOrgSubject] = useState('');
  const [newOrgBody, setNewOrgBody] = useState('');
  const [returningContactSubject, setReturningContactSubject] = useState('');
  const [returningContactBody, setReturningContactBody] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Refs for textarea cursor position
  const newOrgBodyRef = useRef<HTMLTextAreaElement>(null);
  const returningBodyRef = useRef<HTMLTextAreaElement>(null);

  // Fetch user's templates
  const { data: templates, isLoading } = useQuery<TemplateData>({
    queryKey: ['/api/user/email-templates'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/email-templates');
      return res.json();
    },
  });

  // Fetch defaults for reset
  const { data: defaults } = useQuery<DefaultTemplates>({
    queryKey: ['/api/user/email-templates/defaults'],
    queryFn: async () => {
      const res = await apiRequest('GET', '/api/user/email-templates/defaults');
      return res.json();
    },
  });

  // Initialize form state from fetched data
  if (templates && !initialized) {
    setNewOrgSubject(templates.newOrgSubject);
    setNewOrgBody(templates.newOrgBody);
    setReturningContactSubject(templates.returningContactSubject);
    setReturningContactBody(templates.returningContactBody);
    setInitialized(true);
  }

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('PUT', '/api/user/email-templates', {
        newOrgSubject,
        newOrgBody,
        returningContactSubject,
        returningContactBody,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/user/email-templates'] });
      toast({
        title: 'Templates saved',
        description: 'Your email templates have been updated.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to save templates. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Preview mutation
  const previewMutation = useMutation({
    mutationFn: async () => {
      const subject = activeTemplateTab === 'new_org' ? newOrgSubject : returningContactSubject;
      const body = activeTemplateTab === 'new_org' ? newOrgBody : returningContactBody;
      const res = await apiRequest('POST', '/api/user/email-templates/preview', {
        subject,
        body,
      });
      return res.json();
    },
    onSuccess: (data) => {
      setPreviewData(data);
      setPreviewOpen(true);
    },
    onError: () => {
      toast({
        title: 'Preview error',
        description: 'Failed to generate preview.',
        variant: 'destructive',
      });
    },
  });

  // Insert merge variable at cursor position
  const insertVariable = useCallback((variable: string) => {
    const textareaRef = activeTemplateTab === 'new_org' ? newOrgBodyRef : returningBodyRef;
    const setter = activeTemplateTab === 'new_org' ? setNewOrgBody : setReturningContactBody;
    const currentValue = activeTemplateTab === 'new_org' ? newOrgBody : returningContactBody;

    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);
      setter(newValue);

      // Restore cursor position after the inserted text
      requestAnimationFrame(() => {
        textarea.selectionStart = start + variable.length;
        textarea.selectionEnd = start + variable.length;
        textarea.focus();
      });
    } else {
      // If no cursor position, append to end
      setter(currentValue + variable);
    }
  }, [activeTemplateTab, newOrgBody, returningContactBody]);

  // Reset to defaults
  const handleReset = () => {
    if (!defaults) return;

    if (activeTemplateTab === 'new_org') {
      setNewOrgSubject(defaults.newOrgSubject);
      setNewOrgBody(defaults.newOrgBody);
    } else {
      setReturningContactSubject(defaults.returningContactSubject);
      setReturningContactBody(defaults.returningContactBody);
    }

    toast({
      title: 'Reset to defaults',
      description: 'Template reset to default. Click Save to keep this change.',
    });
  };

  // Check if toolkit link is missing from current body
  const currentBody = activeTemplateTab === 'new_org' ? newOrgBody : returningContactBody;
  const missingToolkitLink = currentBody && !currentBody.includes('{{toolkit_link}}');

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          Loading templates...
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">My Email Templates</CardTitle>
          <CardDescription>
            Customize the emails you send to event organizers. These templates pre-populate the Send Email
            dialog on each event, but you can always edit before sending.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Template Tabs */}
          <div className="flex space-x-1 border-b">
            <button
              onClick={() => setActiveTemplateTab('new_org')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTemplateTab === 'new_org'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              New Organization
            </button>
            <button
              onClick={() => setActiveTemplateTab('returning_contact')}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTemplateTab === 'returning_contact'
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              Returning Contact
            </button>
          </div>

          {/* Merge Variable Helper Bar */}
          <div>
            <Label className="text-xs text-muted-foreground mb-1 block">Insert merge variable:</Label>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_VARIABLES.map((v) => (
                <Badge
                  key={v.key}
                  variant="outline"
                  className="cursor-pointer hover:bg-primary/10 transition-colors text-xs"
                  title={v.description}
                  onClick={() => insertVariable(v.key)}
                >
                  {v.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Subject Field */}
          <div>
            <Label htmlFor="template-subject">Subject</Label>
            <Input
              id="template-subject"
              value={activeTemplateTab === 'new_org' ? newOrgSubject : returningContactSubject}
              onChange={(e) =>
                activeTemplateTab === 'new_org'
                  ? setNewOrgSubject(e.target.value)
                  : setReturningContactSubject(e.target.value)
              }
              placeholder="Email subject line..."
            />
          </div>

          {/* Body Textarea */}
          <div>
            <Label htmlFor="template-body">Body</Label>
            <Textarea
              id="template-body"
              ref={activeTemplateTab === 'new_org' ? newOrgBodyRef : returningBodyRef}
              value={currentBody}
              onChange={(e) =>
                activeTemplateTab === 'new_org'
                  ? setNewOrgBody(e.target.value)
                  : setReturningContactBody(e.target.value)
              }
              placeholder="Email body text..."
              className="min-h-[250px] font-mono text-sm"
            />
          </div>

          {/* Toolkit link warning */}
          {missingToolkitLink && (
            <Alert variant="destructive" className="border-amber-500 bg-amber-50">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                Toolkit link not found in this template — are you sure? Click the "Toolkit Link" chip above to insert it.
              </AlertDescription>
            </Alert>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Templates
            </Button>
            <Button
              variant="outline"
              onClick={() => previewMutation.mutate()}
              disabled={previewMutation.isPending}
            >
              {previewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin mr-2" />
              ) : (
                <Eye className="w-4 h-4 mr-2" />
              )}
              Preview
            </Button>
            <Button variant="ghost" onClick={handleReset}>
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset to Default
            </Button>
          </div>

          {templates?.updatedAt && (
            <p className="text-xs text-muted-foreground">
              Last saved: {new Date(templates.updatedAt).toLocaleString()}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Template Preview</DialogTitle>
          </DialogHeader>
          {previewData && (
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="font-medium">{previewData.subject || '(no subject)'}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div className="mt-1 p-3 bg-muted rounded-md whitespace-pre-wrap text-sm">
                  {previewData.body || '(no body)'}
                </div>
              </div>
              <p className="text-xs text-muted-foreground italic">
                This preview uses sample data. Actual values will vary per event.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
