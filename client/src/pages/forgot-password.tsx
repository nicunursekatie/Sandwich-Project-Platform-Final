import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import tspLogo from '@assets/LOGOS/TSP_transparent.png';

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      const response = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (data.success) {
        setIsSuccess(true);
        setMessage(data.message || 'If an account with this email exists, you will receive a password reset link.');
      } else {
        setMessage(data.message || 'An error occurred. Please try again.');
      }
    } catch (error) {
      setMessage('Unable to send reset email. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <img
                src={tspLogo}
                alt="The Sandwich Project"
                className="h-16 w-auto mx-auto"
              />
            </div>
            <CardTitle className="text-teal-600">Check Your Email</CardTitle>
            <CardDescription>
              We've sent password reset instructions to your email
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto">
              <Mail className="w-8 h-8 text-teal-600" />
            </div>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Button
                onClick={() => setLocation('/login')}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Back to Login
              </Button>
              <p className="text-sm text-gray-600">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  onClick={() => {
                    setIsSuccess(false);
                    setEmail('');
                    setMessage('');
                  }}
                  className="text-teal-600 hover:text-teal-700 underline"
                >
                  try again
                </button>
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-16 w-auto mx-auto"
            />
          </div>
          <CardTitle>Forgot Password</CardTitle>
          <CardDescription>
            Enter your email address and we'll send you a link to reset your password
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {message && !isSuccess && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                placeholder="your.email@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
                className="w-full"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading || !email}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Reset Link'
              )}
            </Button>

            <div className="text-center">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setLocation('/login')}
                className="text-slate-600 hover:text-slate-800"
              >
                <ArrowLeft size={16} className="mr-2" />
                Back to Login
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}


