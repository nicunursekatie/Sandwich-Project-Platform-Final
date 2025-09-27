import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  CheckCircle, 
  MessageSquare, 
  Shield, 
  Phone, 
  AlertTriangle,
  Info,
  FileText,
  ExternalLink 
} from 'lucide-react';

export default function SMSVerificationDocs() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex justify-center">
            <div className="bg-teal-600 p-3 rounded-full">
              <Shield className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            SMS Notification Compliance Documentation
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
            This page documents The Sandwich Project's SMS notification system compliance 
            with Twilio and telecommunications regulations.
          </p>
        </div>

        {/* Consent Process Overview */}
        <Card className="border-2 border-teal-600">
          <CardHeader className="bg-teal-50 dark:bg-teal-950">
            <CardTitle className="flex items-center gap-2 text-teal-800 dark:text-teal-200">
              <CheckCircle className="h-5 w-5" />
              User Consent Process
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-3">
              <h3 className="font-semibold text-lg">Two-Step Verification Process:</h3>
              <ol className="list-decimal ml-6 space-y-2 text-gray-700 dark:text-gray-300">
                <li>User explicitly opts in through checkbox consent on their profile</li>
                <li>Verification code sent via SMS to confirm phone number ownership</li>
                <li>User must enter code or reply "YES" to complete enrollment</li>
              </ol>
            </div>
            
            <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <AlertDescription className="text-blue-800 dark:text-blue-200">
                Users must be authenticated and logged in to opt into SMS notifications, 
                ensuring identity verification and preventing unauthorized sign-ups.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Exact Consent Text */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Exact Consent Language
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="bg-gray-100 dark:bg-gray-800 p-6 rounded-lg border-2 border-gray-300 dark:border-gray-600">
              <div className="flex items-start gap-3">
                <div className="mt-1">
                  <input type="checkbox" checked readOnly className="w-4 h-4" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium text-gray-900 dark:text-gray-100">
                    I consent to receive SMS text message reminders from The Sandwich Project 
                    about weekly collection submissions. I understand:
                  </p>
                  <ul className="text-sm text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                    <li>• Messages will only be sent for sandwich collection reminders</li>
                    <li>• I can unsubscribe at any time</li>
                    <li>• Standard message and data rates may apply</li>
                    <li>• My phone number will not be shared with third parties</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-400">
              <Badge variant="secondary" className="mb-2">Required Checkbox</Badge>
              <p>Users must actively check this box to proceed with SMS enrollment.</p>
            </div>
          </CardContent>
        </Card>

        {/* UI Screenshots */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="h-5 w-5" />
              User Interface Elements
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dashboard Prompt */}
            <div className="space-y-3">
              <h3 className="font-semibold">1. Dashboard SMS Prompt</h3>
              <div className="bg-gradient-to-r from-teal-50 to-blue-50 dark:from-teal-950/30 dark:to-blue-950/30 p-4 rounded-lg border-l-4 border-teal-600">
                <div className="flex items-start gap-3">
                  <MessageSquare className="h-5 w-5 text-teal-600 mt-1" />
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                      Stay up-to-date with SMS reminders
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                      Get text reminders when weekly sandwich counts are missing. Never miss a submission again!
                    </p>
                    <div className="flex gap-2 mt-3">
                      <button className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm rounded-md">
                        Set Up SMS Reminders
                      </button>
                      <button className="px-4 py-2 border border-gray-300 text-gray-600 text-sm rounded-md">
                        Maybe Later
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      ✓ Only sandwich collection reminders • Unsubscribe anytime • US numbers only
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Profile Notifications Tab */}
            <div className="space-y-3">
              <h3 className="font-semibold">2. Profile Notifications Tab</h3>
              <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700">
                <div className="space-y-4">
                  <div className="bg-blue-50 dark:bg-blue-950/50 p-4 rounded-lg">
                    <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                      How SMS Reminders Work
                    </h4>
                    <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
                      <li>• Get text reminders when weekly sandwich counts are missing</li>
                      <li>• Includes direct links to the app for easy submission</li>
                      <li>• Only used for sandwich collection reminders</li>
                      <li>• You can unsubscribe at any time</li>
                    </ul>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Phone Number *</label>
                    <input 
                      type="tel" 
                      placeholder="(XXX) XXX-XXXX" 
                      className="w-full px-3 py-2 border rounded-md blur-sm"
                      readOnly
                    />
                    <p className="text-xs text-gray-500">
                      Personal information has been blurred for privacy
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Opt-Out Instructions */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Opt-Out Methods & STOP/HELP Commands
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              {/* SMS Commands */}
              <div className="bg-red-50 dark:bg-red-950/30 p-4 rounded-lg">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-3">
                  SMS Text Commands
                </h3>
                <div className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Badge variant="destructive">STOP</Badge>
                    <span className="text-gray-700 dark:text-gray-300">
                      Immediately unsubscribe from all SMS notifications
                    </span>
                  </div>
                  <div className="flex items-start gap-2">
                    <Badge variant="secondary">HELP</Badge>
                    <span className="text-gray-700 dark:text-gray-300">
                      Receive information about the service and support contact
                    </span>
                  </div>
                </div>
              </div>

              {/* In-App Methods */}
              <div className="bg-green-50 dark:bg-green-950/30 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 dark:text-green-100 mb-3">
                  In-App Unsubscribe
                </h3>
                <ol className="list-decimal ml-4 space-y-1 text-sm text-gray-700 dark:text-gray-300">
                  <li>Go to Profile → Notifications tab</li>
                  <li>Click "Unsubscribe from SMS"</li>
                  <li>Confirmation message appears</li>
                  <li>No further messages will be sent</li>
                </ol>
              </div>
            </div>

            <Alert>
              <AlertDescription>
                <strong>Standard Response to HELP:</strong><br />
                "The Sandwich Project SMS: Weekly collection reminders only. 
                Reply STOP to unsubscribe. Message frequency varies. 
                Msg&Data rates may apply. Support: admin@sandwich.project"
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>

        {/* Message Types & Frequency */}
        <Card>
          <CardHeader>
            <CardTitle>Message Types & Frequency</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4">
              <div className="border-l-4 border-blue-500 pl-4">
                <h3 className="font-semibold">Message Content</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Only sandwich collection submission reminders for missing weekly data
                </p>
              </div>
              
              <div className="border-l-4 border-green-500 pl-4">
                <h3 className="font-semibold">Frequency</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Maximum of once per week, only when collection data is missing
                </p>
              </div>
              
              <div className="border-l-4 border-purple-500 pl-4">
                <h3 className="font-semibold">Timing</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Sent during business hours (9 AM - 5 PM local time)
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4">
                <h3 className="font-semibold">Geographic Restriction</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  US phone numbers only (+1 country code)
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Protection */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Data Protection & Privacy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Phone numbers are encrypted in the database</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>No sharing with third parties except Twilio for delivery</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Audit logs maintained for all opt-in/opt-out actions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span>Immediate deletion upon user account removal</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Links */}
        <Card>
          <CardHeader>
            <CardTitle>Legal & Compliance Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <a 
                href="/privacy-policy" 
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Privacy Policy
              </a>
              <a 
                href="/terms-of-service" 
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Terms of Service
              </a>
              <a 
                href="mailto:admin@sandwich.project" 
                className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
              >
                <ExternalLink className="h-4 w-4" />
                Contact Support: admin@sandwich.project
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Footer */}
        <div className="text-center py-8">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            This documentation page is maintained for compliance with Twilio and 
            telecommunications regulations.
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-2">
            Last updated: {new Date().toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  );
}