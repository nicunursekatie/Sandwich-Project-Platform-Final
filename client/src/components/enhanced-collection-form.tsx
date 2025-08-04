import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useActivityTracker } from '@/hooks/useActivityTracker';

const collectionFormSchema = z.object({
  hostName: z.string().min(1, 'Host name is required'),
  collectionDate: z.string().min(1, 'Collection date is required'),
  individualSandwiches: z.number().min(0, 'Must be 0 or greater'),
  group1Name: z.string().optional(),
  group1Count: z.number().optional(),
  group2Name: z.string().optional(),
  group2Count: z.number().optional(),
  submissionMethod: z.string().optional()
});

type CollectionFormData = z.infer<typeof collectionFormSchema>;

interface EnhancedCollectionFormProps {
  onSubmit: (data: CollectionFormData) => Promise<void>;
  isWalkthrough?: boolean;
}

export function EnhancedCollectionForm({ onSubmit, isWalkthrough = false }: EnhancedCollectionFormProps) {
  const { 
    trackView, 
    trackClick, 
    trackFormSubmit, 
    trackActivity 
  } = useActivityTracker();

  const form = useForm<CollectionFormData>({
    resolver: zodResolver(collectionFormSchema),
    defaultValues: {
      hostName: '',
      collectionDate: '',
      individualSandwiches: 0,
      group1Name: '',
      group1Count: 0,
      group2Name: '',
      group2Count: 0,
      submissionMethod: 'manual'
    }
  });

  // Track form view on component mount
  useEffect(() => {
    trackView(
      isWalkthrough ? 'Collection Walkthrough Form' : 'Standard Collection Form',
      'Collections',
      'Data Entry',
      `User opened ${isWalkthrough ? 'walkthrough' : 'standard'} collection form`
    );
  }, [trackView, isWalkthrough]);

  // Track field interactions
  const trackFieldInteraction = (fieldName: string, action: string) => {
    trackActivity({
      action: action,
      section: 'Collections',
      feature: 'Data Entry',
      details: `${action} ${fieldName} field`,
      metadata: {
        fieldName,
        formType: isWalkthrough ? 'walkthrough' : 'standard',
        timestamp: new Date().toISOString()
      }
    });
  };

  // Track form submission attempt
  const handleSubmit = async (data: CollectionFormData) => {
    try {
      // Track submission attempt
      trackActivity({
        action: 'Submit Attempt',
        section: 'Collections',
        feature: 'Data Entry',
        details: `User attempted to submit collection form for ${data.hostName}`,
        metadata: {
          hostName: data.hostName,
          collectionDate: data.collectionDate,
          totalSandwiches: data.individualSandwiches + (data.group1Count || 0) + (data.group2Count || 0),
          formType: isWalkthrough ? 'walkthrough' : 'standard',
          hasGroupCollections: !!(data.group1Name || data.group2Name)
        }
      });

      await onSubmit(data);
      
      // Track successful submission
      trackFormSubmit(
        `Collection Form (${data.hostName})`,
        'Collections',
        'Data Entry',
        true
      );

    } catch (error) {
      // Track failed submission
      trackFormSubmit(
        `Collection Form (${data.hostName})`,
        'Collections',
        'Data Entry',
        false
      );
      throw error;
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {isWalkthrough ? 'Collection Data Walkthrough' : 'Standard Collection Entry'}
        </CardTitle>
        <CardDescription>
          {isWalkthrough 
            ? 'Step-by-step guided collection data entry with detailed tracking'
            : 'Quick collection data entry with activity monitoring'
          }
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            
            <FormField
              control={form.control}
              name="hostName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host Organization Name</FormLabel>
                  <FormControl>
                    <Input 
                      placeholder="Enter host organization name" 
                      {...field}
                      onFocus={() => trackFieldInteraction('hostName', 'Focus')}
                      onBlur={() => trackFieldInteraction('hostName', 'Blur')}
                      onChange={(e) => {
                        field.onChange(e);
                        if (e.target.value.length > 0) {
                          trackFieldInteraction('hostName', 'Input');
                        }
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    The organization hosting the sandwich collection
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="collectionDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Collection Date</FormLabel>
                  <FormControl>
                    <Input 
                      type="date" 
                      {...field}
                      onFocus={() => trackFieldInteraction('collectionDate', 'Focus')}
                      onChange={(e) => {
                        field.onChange(e);
                        trackFieldInteraction('collectionDate', 'Change');
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="individualSandwiches"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Individual Sandwiches</FormLabel>
                  <FormControl>
                    <Input 
                      type="number" 
                      min="0"
                      placeholder="0"
                      {...field}
                      onChange={(e) => {
                        field.onChange(Number(e.target.value));
                        trackFieldInteraction('individualSandwiches', 'Update');
                      }}
                      onFocus={() => trackFieldInteraction('individualSandwiches', 'Focus')}
                    />
                  </FormControl>
                  <FormDescription>
                    Number of individual sandwiches collected
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="group1Name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group 1 Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Optional group name" 
                        {...field}
                        onFocus={() => trackFieldInteraction('group1Name', 'Focus')}
                        onChange={(e) => {
                          field.onChange(e);
                          if (e.target.value.length > 0) {
                            trackClick('Group Collection', 'Collections', 'Data Entry', 'User started entering group collection data');
                          }
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="group1Count"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Group 1 Count</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="0"
                        placeholder="0"
                        {...field}
                        onChange={(e) => {
                          field.onChange(Number(e.target.value));
                          trackFieldInteraction('group1Count', 'Update');
                        }}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="submissionMethod"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Submission Method</FormLabel>
                  <Select 
                    onValueChange={(value) => {
                      field.onChange(value);
                      trackActivity({
                        action: 'Select',
                        section: 'Collections',
                        feature: 'Data Entry',
                        details: `Selected submission method: ${value}`,
                        metadata: { submissionMethod: value }
                      });
                    }}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select submission method" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="manual">Manual Entry</SelectItem>
                      <SelectItem value="walkthrough">Guided Walkthrough</SelectItem>
                      <SelectItem value="bulk">Bulk Upload</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-4">
              <Button 
                type="submit" 
                className="flex-1"
                onClick={() => trackClick('Submit Collection Form', 'Collections', 'Data Entry')}
              >
                {isWalkthrough ? 'Complete Collection Entry' : 'Save Collection Data'}
              </Button>
              
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  trackClick('Cancel Form', 'Collections', 'Data Entry', 'User cancelled collection form');
                  form.reset();
                }}
              >
                Cancel
              </Button>
            </div>

            {/* Activity Tracking Status */}
            <div className="mt-6 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm text-green-700 dark:text-green-300">
                <strong>Activity Tracking Active</strong>
                <p className="mt-1">This form tracks detailed user interactions including field focus, data entry, and submission attempts for comprehensive analytics.</p>
              </div>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}