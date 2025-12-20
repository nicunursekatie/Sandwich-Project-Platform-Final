import React, { useState, useEffect } from 'react';
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
import {
  Eye,
  EyeOff,
  CheckCircle,
  XCircle,
  Loader2,
  KeyRound,
} from 'lucide-react';
import tspLogo from '@assets/LOGOS/TSP_transparent.png';
import { apiRequest } from '@/lib/queryClient';

/**
 * Set Password Page
 *
 * This page is shown to users who were manually created without a password.
 * They are redirected here after their first login attempt to set up their password.
 */
export default function SetPassword() {
  const [, setLocation] = useLocation();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [message, setMessage] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);
  const [userEmail, setUserEmail] = useState('');
  const [token, setToken] = useState('');
  const [passwordStrength, setPasswordStrength] = useState({
    hasLength: false,
    hasLowercase: false,
    hasUppercase: false,
    hasNumber: false,
  });

  // Get the token from URL params and verify it
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const tokenParam = urlParams.get('token');
    const emailParam = urlParams.get('email'); // Legacy support for direct email redirects
    
    if (tokenParam) {
      setToken(tokenParam);
      // Verify the token
      verifyToken(tokenParam);
    } else if (emailParam) {
      // Legacy flow: if email is provided, request a token first
      requestToken(decodeURIComponent(emailParam));
    } else {
      setIsVerifying(false);
      setMessage('Invalid or missing setup link. Please request a new password setup link.');
    }
  }, []);

  const verifyToken = async (tokenToVerify: string) => {
    try {
      const response = await apiRequest('GET', `/api/auth/verify-initial-password-token/${tokenToVerify}`);
      if (response.valid) {
        setUserEmail(response.email);
        setIsVerifying(false);
      } else {
        setIsVerifying(false);
        setMessage(response.message || 'Invalid or expired setup link. Please request a new password setup link.');
      }
    } catch (error: any) {
      setIsVerifying(false);
      setMessage('Failed to verify setup link. Please try again.');
    }
  };

  const requestToken = async (email: string) => {
    setIsVerifying(true);
    try {
      const response = await apiRequest('POST', '/api/auth/request-initial-password', {
        email,
      });
      if (response.success) {
        setMessage('A password setup link has been sent to your email. Please check your inbox and click the link to set your password.');
        setIsVerifying(false);
      } else {
        setIsVerifying(false);
        setMessage(response.message || 'Failed to request password setup link.');
      }
    } catch (error: any) {
      setIsVerifying(false);
      setMessage('Failed to request password setup link. Please try again.');
    }
  };

  // Check password strength
  useEffect(() => {
    setPasswordStrength({
      hasLength: newPassword.length >= 8,
      hasLowercase: /[a-z]/.test(newPassword),
      hasUppercase: /[A-Z]/.test(newPassword),
      hasNumber: /\d/.test(newPassword),
    });
  }, [newPassword]);

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      setMessage('Passwords do not match.');
      return;
    }

    const allStrengthRequirements =
      Object.values(passwordStrength).every(Boolean);
    if (!allStrengthRequirements) {
      setMessage('Password does not meet security requirements.');
      return;
    }

    setIsLoading(true);
    setMessage('');

    if (!token) {
      setMessage('Invalid setup link. Please request a new password setup link.');
      return;
    }

    try {
      const response = await apiRequest('POST', '/api/auth/set-initial-password', {
        token,
        password: newPassword,
      });

      if (response.success) {
        setIsSuccess(true);
        setMessage('Password set successfully! You can now log in.');
        // Redirect to login after 2 seconds
        setTimeout(() => {
          window.location.href = '/login';
        }, 2000);
      } else {
        setMessage(response.message || 'Failed to set password. Please try again.');
      }
    } catch (error: any) {
      setMessage(error.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (isVerifying) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-16 w-auto mx-auto mb-4"
            />
            <CardTitle>Verifying Setup Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-teal-600" />
            <p className="text-slate-600">Please wait while we verify your setup link...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!userEmail && !token) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-16 w-auto mx-auto mb-4"
            />
            <CardTitle className="text-red-600">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <XCircle className="h-4 w-4" />
              <AlertDescription>
                {message || 'This link is invalid or has expired. Please try logging in again to request a new setup link.'}
              </AlertDescription>
            </Alert>
            <Button
              onClick={() => (window.location.href = '/login')}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              Back to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-16 w-auto mx-auto mb-4"
            />
            <CardTitle className="text-green-600">
              Password Set Successfully!
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{message}</AlertDescription>
            </Alert>
            <p className="text-slate-600 text-sm">
              Redirecting to login in 2 seconds...
            </p>
            <Button
              onClick={() => (window.location.href = '/login')}
              className="w-full bg-teal-600 hover:bg-teal-700"
            >
              Go to Login Now
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <img
            src={tspLogo}
            alt="The Sandwich Project"
            className="h-16 w-auto mx-auto mb-4"
          />
          <div className="flex justify-center mb-4">
            <div className="w-12 h-12 bg-teal-100 rounded-full flex items-center justify-center">
              <KeyRound className="w-6 h-6 text-teal-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Welcome! Set Your Password</CardTitle>
          <CardDescription>
            Your account has been created. Please set a password to complete your setup.
          </CardDescription>
          {userEmail && (
            <p className="text-sm text-slate-500 mt-2">
              Account: {userEmail}
            </p>
          )}
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetPassword} className="space-y-6">
            {message && !isSuccess && (
              <Alert variant="destructive">
                <XCircle className="h-4 w-4" />
                <AlertDescription>{message}</AlertDescription>
              </Alert>
            )}

            {/* New Password */}
            <div className="space-y-2">
              <Label htmlFor="newPassword">Create Password</Label>
              <div className="relative">
                <Input
                  id="newPassword"
                  type={showPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password Strength Indicators */}
            {newPassword && (
              <div className="space-y-2">
                <Label className="text-sm text-slate-600">
                  Password Requirements:
                </Label>
                <div className="space-y-1">
                  {Object.entries({
                    hasLength: 'At least 8 characters',
                    hasLowercase: 'One lowercase letter',
                    hasUppercase: 'One uppercase letter',
                    hasNumber: 'One number',
                  }).map(([key, label]) => (
                    <div key={key} className="flex items-center gap-2 text-xs">
                      {passwordStrength[
                        key as keyof typeof passwordStrength
                      ] ? (
                        <CheckCircle size={12} className="text-green-600" />
                      ) : (
                        <XCircle size={12} className="text-red-400" />
                      )}
                      <span
                        className={
                          passwordStrength[key as keyof typeof passwordStrength]
                            ? 'text-green-600'
                            : 'text-slate-500'
                        }
                      >
                        {label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Confirm Password */}
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm Password</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm your password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirmPassword ? (
                    <EyeOff size={16} />
                  ) : (
                    <Eye size={16} />
                  )}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-red-500 text-sm">Passwords do not match</p>
              )}
            </div>

            <Button
              type="submit"
              className="w-full bg-teal-600 hover:bg-teal-700"
              disabled={
                isLoading ||
                !Object.values(passwordStrength).every(Boolean) ||
                newPassword !== confirmPassword
              }
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  Setting Password...
                </>
              ) : (
                'Set Password & Continue'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
