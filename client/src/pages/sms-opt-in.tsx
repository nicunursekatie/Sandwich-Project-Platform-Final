import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, CheckCircle, AlertTriangle, Smartphone, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";

interface SMSOptInData {
  phoneNumber: string;
  consent: boolean;
}

export default function SMSOptInPage() {
  const { toast } = useToast();
  const { user, isLoading: authLoading } = useAuth();
  const [phoneNumber, setPhoneNumber] = useState("");
  const [consent, setConsent] = useState(false);
  const [hasOptedIn, setHasOptedIn] = useState(false);

  // Check if user already has SMS consent
  const { data: userSMSStatus, isLoading: statusLoading } = useQuery({
    queryKey: ['/api/users/sms-status'],
    queryFn: () => apiRequest('GET', '/api/users/sms-status'),
    enabled: !!user?.id,
  });

  // SMS opt-in mutation
  const optInMutation = useMutation({
    mutationFn: (data: SMSOptInData) => apiRequest('POST', '/api/users/sms-opt-in', data),
    onSuccess: () => {
      setHasOptedIn(true);
      toast({
        title: "Success!",
        description: "You've been signed up for SMS reminders.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to sign up for SMS reminders.",
        variant: "destructive",
      });
    },
  });

  // SMS opt-out mutation
  const optOutMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/users/sms-opt-out'),
    onSuccess: () => {
      toast({
        title: "Unsubscribed",
        description: "You've been removed from SMS reminders.",
      });
      setHasOptedIn(false);
      setPhoneNumber("");
      setConsent(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to unsubscribe from SMS reminders.",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast({
        title: "Error",
        description: "Please enter your phone number.",
        variant: "destructive",
      });
      return;
    }

    if (!consent) {
      toast({
        title: "Error",
        description: "Please check the consent box to proceed.",
        variant: "destructive",
      });
      return;
    }

    optInMutation.mutate({
      phoneNumber: phoneNumber.trim(),
      consent: true
    });
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX for US numbers
    if (digits.length >= 10) {
      const match = digits.match(/^(\d{3})(\d{3})(\d{4})/);
      if (match) {
        return `(${match[1]}) ${match[2]}-${match[3]}`;
      }
    } else if (digits.length >= 6) {
      const match = digits.match(/^(\d{3})(\d{3})/);
      if (match) {
        return `(${match[1]}) ${match[2]}`;
      }
    } else if (digits.length >= 3) {
      const match = digits.match(/^(\d{3})/);
      if (match) {
        return `(${match[1]})`;
      }
    }
    
    return digits;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  if (authLoading || statusLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-b-2 border-[#1f7b7b] mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
            <CardTitle>Sign In Required</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-gray-600 mb-4">
              You need to be signed in to sign up for SMS reminders.
            </p>
            <Link href="/login">
              <Button className="w-full">Sign In</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user already opted in
  const isAlreadyOptedIn = userSMSStatus?.hasOptedIn || hasOptedIn;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-2xl mx-auto px-4">
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="outline" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="bg-[#1f7b7b] p-3 rounded-full">
                <MessageSquare className="h-8 w-8 text-white" />
              </div>
            </div>
            <CardTitle className="text-2xl">SMS Reminder Sign-up</CardTitle>
            <p className="text-gray-600 mt-2">
              Get text message reminders for weekly sandwich collection submissions
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            {isAlreadyOptedIn ? (
              // Already opted in - show status and opt-out option
              <div className="text-center space-y-4">
                <Alert>
                  <CheckCircle className="h-4 w-4" />
                  <AlertDescription>
                    You're signed up for SMS reminders! 
                    {userSMSStatus?.phoneNumber && (
                      <span className="block mt-1 font-medium">
                        Phone: {userSMSStatus.phoneNumber}
                      </span>
                    )}
                  </AlertDescription>
                </Alert>

                <div className="bg-gray-50 p-4 rounded-lg text-sm text-gray-600">
                  <h4 className="font-medium text-gray-900 mb-2">What you'll receive:</h4>
                  <ul className="space-y-1">
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
                >
                  {optOutMutation.isPending ? "Unsubscribing..." : "Unsubscribe from SMS Reminders"}
                </Button>
              </div>
            ) : (
              // Not opted in - show sign-up form
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h3 className="font-medium text-blue-900 mb-2 flex items-center gap-2">
                    <Smartphone className="h-4 w-4" />
                    How SMS Reminders Work
                  </h3>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• Get text reminders when weekly sandwich counts are missing</li>
                    <li>• Includes direct links to the app for easy submission</li>
                    <li>• Only used for sandwich collection reminders</li>
                    <li>• You can unsubscribe at any time</li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="(555) 123-4567"
                    value={phoneNumber}
                    onChange={handlePhoneChange}
                    required
                    className="text-lg"
                  />
                  <p className="text-sm text-gray-500">
                    We'll format this automatically. US numbers only.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <Checkbox
                      id="consent"
                      checked={consent}
                      onCheckedChange={(checked) => setConsent(checked as boolean)}
                      className="mt-1"
                    />
                    <div>
                      <Label htmlFor="consent" className="text-sm leading-relaxed cursor-pointer">
                        I consent to receive SMS text message reminders from The Sandwich Project about weekly collection submissions. I understand:
                      </Label>
                      <ul className="text-xs text-gray-600 mt-2 space-y-1 ml-4">
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
                  className="w-full bg-[#1f7b7b] hover:bg-[#165a5a]"
                  disabled={optInMutation.isPending || !consent || !phoneNumber.trim()}
                >
                  {optInMutation.isPending ? "Signing Up..." : "Sign Up for SMS Reminders"}
                </Button>
              </form>
            )}

            <div className="text-center">
              <p className="text-sm text-gray-500">
                Questions? Contact us by replying to the announcement email.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}