import React, { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Progress } from '@/components/ui/progress';
import { 
  Shield, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Play,
  RefreshCw,
  Users,
  Settings,
  Activity
} from 'lucide-react';

interface TestResult {
  user: string;
  endpoint: string;
  name: string;
  expected: string;
  actual: string;
  status_code: number;
  match: boolean;
}

interface TestSuite {
  name: string;
  status: 'pending' | 'running' | 'passed' | 'failed';
  results: TestResult[];
  error?: string;
}

const TEST_USERS = [
  {
    email: 'admin@sandwich.project',
    role: 'super_admin',
    description: 'Full system access'
  },
  {
    email: 'christine@thesandwichproject.org',
    role: 'core_team', 
    description: 'Meeting management + project oversight'
  },
  {
    email: 'juliet@thesandwichproject.org',
    role: 'volunteer',
    description: 'Limited volunteer access'
  },
  {
    email: 'test2@testing.com',
    role: 'viewer',
    description: 'View-only access'
  }
];

const CRITICAL_TESTS = [
  {
    name: 'Send to Agenda Permission',
    description: 'Verify meeting management permissions work correctly',
    endpoint: 'PATCH /api/projects/49',
    body: { reviewInNextMeeting: true },
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org']
  },
  {
    name: 'Project Edit Permission',
    description: 'Verify project editing permissions are separate from agenda',
    endpoint: 'PATCH /api/projects/49',
    body: { title: 'Test Update' },
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org']
  },
  {
    name: 'View Projects',
    description: 'Verify project viewing permissions',
    endpoint: 'GET /api/projects',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org', 'juliet@thesandwichproject.org', 'test2@testing.com']
  },
  {
    name: 'View Meetings',
    description: 'Verify meeting viewing permissions',
    endpoint: 'GET /api/meetings',
    expected_users: ['admin@sandwich.project', 'christine@thesandwichproject.org', 'juliet@thesandwichproject.org']
  }
];

export function SystemHealthDashboard() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [testSuites, setTestSuites] = useState<TestSuite[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState<string>('');

  // Check if user has permission to run tests
  const canRunTests = user?.role === 'super_admin' || user?.role === 'admin';

  // Old broken test function removed - now using working permission test API

  const runAllTests = async () => {
    if (!canRunTests) {
      toast({
        title: "Permission Denied",
        description: "Only admins can run system health tests",
        variant: "destructive"
      });
      return;
    }

    setIsRunning(true);
    setTestSuites([]);
    
    try {
      const suite: TestSuite = {
        name: 'Permission Matrix Test',
        status: 'running',
        results: []
      };
      
      setTestSuites([suite]);
      setCurrentTest('Running comprehensive permission matrix test...');
      
      // Use the new working permission test API
      const response = await fetch('/api/working-permission-test/matrix');
      if (!response.ok) {
        throw new Error('Permission test API failed');
      }
      
      const testData = await response.json();
      
      // Convert results to our format
      const convertedResults = testData.results.map((result: any) => ({
        user: result.user,
        endpoint: `${result.permission} Check`,
        name: result.permission,
        expected: result.expected ? 'ALLOW' : 'DENY',
        actual: result.actual ? 'ALLOW' : 'DENY',
        status_code: result.status === 'PASS' ? 200 : (result.status === 'FAIL' ? 403 : 500),
        match: result.passed
      }));
      
      suite.results = convertedResults;
      
      // Determine final status
      const failures = suite.results.filter(r => !r.match);
      suite.status = failures.length === 0 ? 'passed' : 'failed';
      
      setTestSuites([suite]);
      setCurrentTest('');
      
      if (failures.length === 0) {
        toast({
          title: "All Tests Passed!",
          description: `${testData.summary.successRate}% success rate - Authentication and permissions are working correctly`,
        });
      } else {
        toast({
          title: `${failures.length} Test Failures`,
          description: `${testData.summary.successRate}% success rate - Check the results below for permission issues`,
          variant: "destructive"
        });
      }
      
    } catch (error) {
      toast({
        title: "Test Suite Failed",
        description: error.message || "Failed to run tests",
        variant: "destructive"
      });
    } finally {
      setIsRunning(false);
    }
  };

  if (!canRunTests) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-red-500" />
            System Health Tests
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Shield className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-600">Only administrators can access system health tests.</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-teal-600" />
            System Health Tests
          </CardTitle>
          <p className="text-gray-600">
            Run comprehensive tests to verify authentication, permissions, and critical functionality
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <Button 
              onClick={runAllTests}
              disabled={isRunning}
              className="flex items-center gap-2"
            >
              {isRunning ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Permission Tests
                </>
              )}
            </Button>
          </div>

          {isRunning && currentTest && (
            <div className="mb-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-blue-800">{currentTest}</p>
              <Progress value={30} className="mt-2" />
            </div>
          )}

          {/* Test Users Overview */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Test Users
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {TEST_USERS.map(user => (
                <Card key={user.email} className="p-4">
                  <div className="space-y-2">
                    <div className="font-medium">{user.email}</div>
                    <Badge variant="outline">{user.role}</Badge>
                    <p className="text-sm text-gray-600">{user.description}</p>
                  </div>
                </Card>
              ))}
            </div>
          </div>

          <Separator />

          {/* Test Results */}
          {testSuites.map((suite, index) => (
            <div key={index} className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-lg font-semibold">{suite.name}</h3>
                <Badge 
                  className={
                    suite.status === 'passed' ? 'bg-green-100 text-green-800' :
                    suite.status === 'failed' ? 'bg-red-100 text-red-800' :
                    suite.status === 'running' ? 'bg-blue-100 text-blue-800' :
                    'bg-gray-100 text-gray-800'
                  }
                >
                  {suite.status === 'passed' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                  {suite.status === 'failed' && <XCircle className="w-3 h-3 mr-1" />}
                  {suite.status === 'running' && <RefreshCw className="w-3 h-3 mr-1 animate-spin" />}
                  {suite.status.toUpperCase()}
                </Badge>
              </div>

              {suite.results.length > 0 && (
                <div className="space-y-2">
                  {suite.results.map((result, idx) => (
                    <Card key={idx} className={`p-3 ${
                      result.match ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            {result.match ? (
                              <CheckCircle2 className="w-4 h-4 text-green-600" />
                            ) : (
                              <XCircle className="w-4 h-4 text-red-600" />
                            )}
                            <span className="font-medium">{result.name}</span>
                          </div>
                          <div className="text-sm text-gray-600 mt-1">
                            {result.user} → {result.endpoint}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">
                            Expected: <span className="font-medium">{result.expected}</span>
                          </div>
                          <div className="text-sm">
                            Actual: <span className="font-medium">{result.actual}</span>
                          </div>
                        </div>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {suite.status === 'failed' && (
                <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2 text-red-800">
                    <AlertTriangle className="w-4 h-4" />
                    <span className="font-medium">Permission Issues Detected</span>
                  </div>
                  <p className="text-red-700 mt-2">
                    Some users have incorrect permissions. Review the failed tests above and check user roles.
                  </p>
                </div>
              )}

              {suite.status === 'passed' && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                  <div className="flex items-center gap-2 text-green-800">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="font-medium">All Permission Tests Passed</span>
                  </div>
                  <p className="text-green-700 mt-2">
                    Authentication and authorization are working correctly across all user types.
                  </p>
                </div>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}