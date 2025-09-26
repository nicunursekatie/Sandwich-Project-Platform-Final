import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useLocation } from 'wouter';
import { User, Lock, Mail, FileText, Save, MessageSquare, Smartphone, CheckCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, queryClient } from '@/lib/queryClient';

const profileSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  displayName: z.string().min(1, 'Display name is required'),
  email: z.string().email('Invalid email address'),
});

const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string().min(1, 'Please confirm your password'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

const smsSchema = z.object({
  phoneNumber: z.string().min(1, 'Phone number is required'),
  consent: z.boolean(),
});

interface SMSOptInData {
  phoneNumber: string;
  consent: boolean;
}

type ProfileFormData = z.infer<typeof profileSchema>;
type PasswordFormData = z.infer<typeof passwordSchema>;
type SMSFormData = z.infer<typeof smsSchema>;

export default function UserProfile() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();
  
  // Parse URL query parameters to get the tab
  const getTabFromURL = () => {
    const searchParams = new URLSearchParams(window.location.search);
    const tabParam = searchParams.get('tab');
    if (tabParam === 'password' || tabParam === 'notifications' || tabParam === 'profile') {
      return tabParam;
    }
    return 'profile'; // default
  };
  
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'notifications'>(getTabFromURL());
  const [phoneNumber, setPhoneNumber] = useState('');
  const [consent, setConsent] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  
  // Update active tab when URL changes
  useEffect(() => {
    const newTab = getTabFromURL();
    setActiveTab(newTab);
  }, [location]);

  const profileForm = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      displayName: '',
      email: '',
    },
  });

  const passwordForm = useForm<PasswordFormData>({
    resolver: zodResolver(passwordSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmPassword: '',
    },
  });

  // Load user profile data
  const { data: userProfile, isLoading } = useQuery({
    queryKey: ['/api/auth/profile'],
    enabled: !!user,
  });

  // Check if user already has SMS consent
  const { data: userSMSStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
    enabled: !!user?.id,
  });

  // Update form when profile data loads
  useEffect(() => {
    if (userProfile && typeof userProfile === 'object') {
      const profile = userProfile as any;
      profileForm.reset({
        firstName: profile.firstName || '',
        lastName: profile.lastName || '',
        displayName: profile.displayName || '',
        email: profile.email || '',
      });
    }
  }, [userProfile, profileForm]);

  // Update profile mutation
  const updateProfileMutation = useMutation({
    mutationFn: async (data: ProfileFormData) => {
      return await apiRequest('PUT', '/api/auth/profile', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/auth/user'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/profile'] });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update profile',
        variant: 'destructive',
      });
    },
  });

  // Change password mutation
  const changePasswordMutation = useMutation({
    mutationFn: async (data: PasswordFormData) => {
      return await apiRequest('PUT', '/api/auth/change-password', {
        currentPassword: data.currentPassword,
        newPassword: data.newPassword,
      });
    },
    onSuccess: () => {
      passwordForm.reset();
      toast({
        title: 'Password changed',
        description: 'Your password has been successfully updated.',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to change password',
        variant: 'destructive',
      });
    },
  });

  const onSubmitProfile = (data: ProfileFormData) => {
    updateProfileMutation.mutate(data);
  };

  const onSubmitPassword = (data: PasswordFormData) => {
    changePasswordMutation.mutate(data);
  };

  // SMS opt-in mutation
  const optInMutation = useMutation({
    mutationFn: (data: SMSOptInData) =>
      apiRequest('POST', '/api/users/sms-opt-in', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'Confirmation SMS Sent!',
        description: "Please check your phone and reply with your verification code or 'YES' to complete signup.",
      });
      setPhoneNumber('');
      setConsent(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send confirmation SMS.',
        variant: 'destructive',
      });
    },
  });

  // SMS confirmation mutation
  const confirmSMSMutation = useMutation({
    mutationFn: (verificationCode: string) =>
      apiRequest('POST', '/api/users/sms-confirm', { verificationCode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'SMS Confirmed!',
        description: "You'll now receive weekly sandwich collection reminders.",
      });
      setVerificationCode('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to confirm SMS signup.',
        variant: 'destructive',
      });
    },
  });

  // SMS opt-out mutation
  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users/sms-status'] });
      toast({
        title: 'Unsubscribed',
        description: "You've been removed from SMS reminders.",
      });
      setPhoneNumber('');
      setConsent(false);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description:
          error.message || 'Failed to unsubscribe from SMS reminders.',
        variant: 'destructive',
      });
    },
  });

  // SMS form handling - improved phone number formatting
  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Limit to 10 digits maximum
    const limitedDigits = digits.slice(0, 10);

    // Format progressively as user types
    if (limitedDigits.length === 0) return '';
    if (limitedDigits.length <= 3) return limitedDigits;
    if (limitedDigits.length <= 6) {
      return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    }
    // Format full number
    return `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    
    // Allow backspacing and deletion
    if (input.length < phoneNumber.length) {
      const digits = input.replace(/\D/g, '');
      setPhoneNumber(formatPhoneNumber(digits));
      return;
    }
    
    // Format normally for new input
    const formatted = formatPhoneNumber(input);
    setPhoneNumber(formatted);
  };

  const handleSMSSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!phoneNumber.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your phone number.',
        variant: 'destructive',
      });
      return;
    }

    if (!consent) {
      toast({
        title: 'Error',
        description: 'Please check the consent box to proceed.',
        variant: 'destructive',
      });
      return;
    }

    optInMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      consent: true,
    });
  };

  // Check user SMS status
  const isAlreadyOptedIn = userSMSStatus?.hasConfirmedOptIn;
  const isPendingConfirmation = userSMSStatus?.isPendingConfirmation;
  const smsStatus = userSMSStatus?.status;

  // SMS confirmation form handler
  const handleConfirmSMS = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!verificationCode.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter your verification code.',
        variant: 'destructive',
      });
      return;
    }

    confirmSMSMutation.mutate(verificationCode.trim());
  };

  if (isLoading || statusLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <User className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-main-heading text-primary">
          Account Settings
        </h1>
        <p className="font-body text-muted-foreground">
          Manage your profile information and account security
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 border-b">
        <button
          onClick={() => setActiveTab('profile')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'profile'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <User className="w-4 h-4 inline mr-2" />
          Profile
        </button>
        <button
          onClick={() => setActiveTab('password')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'password'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Lock className="w-4 h-4 inline mr-2" />
          Password
        </button>
        <button
          onClick={() => setActiveTab('notifications')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'notifications'
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
          data-testid="button-notifications-tab"
        >
          <MessageSquare className="w-4 h-4 inline mr-2" />
          Notifications
        </button>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Profile Information
            </CardTitle>
            <CardDescription>
              Update your personal information and display preferences
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...profileForm}>
              <form
                onSubmit={profileForm.handleSubmit(onSubmitProfile)}
                className="space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={profileForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl>
                          <Input placeholder="John" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={profileForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl>
                          <Input placeholder="Doe" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={profileForm.control}
                  name="displayName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Display Name</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="How you want to appear in messages and activities"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={profileForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email Address</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          placeholder="john@example.com"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={updateProfileMutation.isPending}
                  className="btn-tsp-primary"
                >
                  <Save className="w-4 h-4 mr-2" />
                  {updateProfileMutation.isPending
                    ? 'Saving...'
                    : 'Save Changes'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Password Tab */}
      {activeTab === 'password' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5" />
              Change Password
            </CardTitle>
            <CardDescription>
              Update your account password for security
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
                className="space-y-6"
              >
                <FormField
                  control={passwordForm.control}
                  name="currentPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Current Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your current password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <FormField
                  control={passwordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Enter your new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={passwordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm New Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Confirm your new password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  disabled={changePasswordMutation.isPending}
                  className="btn-tsp-primary"
                >
                  <Lock className="w-4 h-4 mr-2" />
                  {changePasswordMutation.isPending
                    ? 'Changing...'
                    : 'Change Password'}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>
      )}

      {/* Notifications Tab */}
      {activeTab === 'notifications' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              SMS Notifications
            </CardTitle>
            <CardDescription>
              Manage your SMS reminder preferences for weekly sandwich collection submissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {isAlreadyOptedIn ? (
              // Already confirmed SMS opt-in - show status and opt-out option
              <div className="space-y-4">
                <Alert data-testid="alert-sms-opted-in">
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    You're confirmed for SMS reminders!
                    {userSMSStatus?.phoneNumber && (
                      <span className="block mt-1 font-medium">
                        Phone: {userSMSStatus.phoneNumber}
                      </span>
                    )}
                    {userSMSStatus?.confirmedAt && (
                      <span className="block mt-1 text-xs text-muted-foreground">
                        Confirmed: {new Date(userSMSStatus.confirmedAt).toLocaleDateString()}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="bg-muted p-4 rounded-lg text-sm">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    What you'll receive:
                  </h4>
                  <ul className="space-y-1 text-muted-foreground">
                    <li>• Friendly reminders when weekly sandwich counts are missing</li>
                    <li>• Direct links to the app for easy submission</li>
                    <li>• Only related to sandwich collection reminders</li>
                  </ul>
                </div>

                <Button
                  variant="outline"
                  onClick={() => optOutMutation.mutate()}
                  disabled={optOutMutation.isPending}
                  className="w-full"
                  data-testid="button-sms-opt-out"
                >
                  {optOutMutation.isPending
                    ? 'Unsubscribing...'
                    : 'Unsubscribe from SMS Reminders'}
                </Button>
              </div>
            ) : isPendingConfirmation ? (
              // Pending confirmation - show verification code form
              <div className="space-y-4">
                <Alert data-testid="alert-sms-pending-confirmation">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <strong>SMS Confirmation Required</strong>
                    <br />
                    We sent a verification code to {userSMSStatus?.phoneNumber}. 
                    Please enter the 6-digit code below or reply "YES" to the text message.
                  </AlertDescription>
                </Alert>

                <form onSubmit={handleConfirmSMS} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="verification-code">Verification Code</Label>
                    <Input
                      id="verification-code"
                      type="text"
                      placeholder="Enter 6-digit code"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      maxLength={6}
                      className="text-lg text-center tracking-widest"
                      data-testid="input-verification-code"
                    />
                    <p className="text-sm text-muted-foreground">
                      You can also reply "YES" to the text message instead of entering the code here.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full btn-tsp-primary"
                    disabled={confirmSMSMutation.isPending || verificationCode.length !== 6}
                    data-testid="button-confirm-sms"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {confirmSMSMutation.isPending
                      ? 'Confirming...'
                      : 'Confirm SMS Signup'}
                  </Button>
                </form>

                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Didn't receive the code? Check your spam folder or try signing up again.
                  </p>
                </div>
              </div>
            ) : (
              // Not opted in - show sign-up form
              <form onSubmit={handleSMSSubmit} className="space-y-6">
                <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 dark:text-blue-100 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    How SMS Reminders Work
                  </h3>
                  <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                    <li>• Get text reminders when weekly sandwich counts are missing</li>
                    <li>• Includes direct links to the app for easy submission</li>
                    <li>• Only used for sandwich collection reminders</li>
                    <li>• You can unsubscribe at any time</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sms-phone">Phone Number *</Label>
                  <Input
                    id="sms-phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    required
                    className="text-lg"
                    data-testid="input-sms-phone"
                  />
                  <p className="text-sm text-muted-foreground">
                    We'll format this automatically. US numbers only.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="sms-consent"
                      checked={consent}
                      onCheckedChange={(checked) => setConsent(checked as boolean)}
                      className="mt-1"
                      data-testid="checkbox-sms-consent"
                    />
                    <div>
                      <Label
                        htmlFor="sms-consent"
                        className="text-sm leading-relaxed cursor-pointer"
                      >
                        I consent to receive SMS text message reminders from The
                        Sandwich Project about weekly collection submissions. I understand:
                      </Label>
                      <ul className="text-xs text-muted-foreground mt-2 space-y-1 ml-4">
                        <li>• Messages will only be sent for sandwich collection reminders</li>
                        <li>• I can unsubscribe at any time</li>
                        <li>• Standard message and data rates may apply</li>
                        <li>• My phone number will not be shared with third parties</li>
                      </ul>
                    </div>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full btn-tsp-primary"
                  disabled={optInMutation.isPending || !consent || !phoneNumber.trim()}
                  data-testid="button-sms-opt-in"
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  {optInMutation.isPending
                    ? 'Signing Up...'
                    : 'Sign Up for SMS Reminders'}
                </Button>
              </form>
            )}

            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Questions about SMS notifications? Contact us through the messaging system.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
