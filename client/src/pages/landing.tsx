import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Heart,
  Users,
  Calendar,
  MessageSquare,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { DocumentsBrowser } from '@/components/documents-browser';
import tspLogo from '@assets/CMYK_PRINT_TSP-01_1749585167435.png';
import tspTransparent from '@assets/LOGOS/Copy of TSP_transparent.png';

export default function Landing() {
  const [showToolkit, setShowToolkit] = useState(false);

  const handleLogin = () => {
    // Redirect to Replit Auth login
    window.location.href = '/api/login';
  };

  // Fetch real statistics for public display
  const { data: statsData } = useQuery({
    queryKey: ['/api/sandwich-collections/stats'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections/stats');
      if (!response.ok) throw new Error('Failed to fetch stats');
      return response.json();
    },
    retry: false,
  });

  const { data: collectionsResponse } = useQuery({
    queryKey: ['/api/sandwich-collections'],
    queryFn: async () => {
      const response = await fetch('/api/sandwich-collections?page=1&limit=1000');
      if (!response.ok) throw new Error('Failed to fetch collections');
      return response.json();
    },
    retry: false,
  });

  const collections = collectionsResponse?.collections || [];
  const totalSandwiches = statsData?.completeTotalSandwiches || 0;
  // Use calculated overall weekly average from actual operational data
  // Based on 2023-2025 performance: 8,983/week (2023), 8,851/week (2024), 7,861/week (2025)
  const weeklyAverage = 8700;
  // Use the verified record week from official records (38,828 on Nov 15, 2023 - Week 190)
  const recordWeek = 38828;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-slate-50 to-indigo-100 p-4">
      <div className="max-w-6xl mx-auto space-y-12 py-8">
        {/* Hero Section */}
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <img
              src={tspLogo}
              alt="The Sandwich Project"
              className="h-24 w-auto"
            />
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            A 501(c)(3) nonprofit organization serving Georgia communities by
            collecting and distributing sandwiches to fight food insecurity.
            Connecting volunteers, hosts, and nonprofit partners to make a
            lasting impact one sandwich at a time.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={handleLogin}
              size="lg"
              className="bg-brand-primary hover:bg-brand-primary-dark active:bg-brand-primary-dark text-white font-semibold px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-2xl active:scale-95 focus:outline-none focus:ring-4 focus:ring-brand-primary/30 group"
            >
              <span className="flex items-center gap-2">
                Enter Platform
                <svg
                  className="w-5 h-5 group-hover:translate-x-1 transition-transform duration-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </span>
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => {
                console.log(
                  'Toolkit button clicked, current state:',
                  showToolkit
                );
                setShowToolkit(!showToolkit);
              }}
              className="border-2 border-brand-primary text-brand-primary hover:bg-brand-primary hover:text-white px-8 py-4 rounded-xl transition-all duration-300 transform hover:scale-105 hover:shadow-lg active:scale-95 focus:outline-none focus:ring-4 focus:ring-brand-primary/20"
            >
              {showToolkit ? 'Hide' : 'View'} Group Toolkit
            </Button>
          </div>
        </div>

        {/* Real-time Statistics - Hidden when toolkit is shown */}
        {!showToolkit && (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <CardHeader>
                <img
                  src={tspTransparent}
                  alt="TSP Logo"
                  className="h-12 w-12 mx-auto mb-4 object-contain"
                />
                <CardTitle className="text-2xl font-bold">
                  {totalSandwiches.toLocaleString()}
                </CardTitle>
                <CardDescription className="font-semibold">
                  Sandwiches Delivered
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  shared with community members
                </p>
              </CardContent>
            </Card>

            <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <CardHeader>
                <Calendar className="h-12 w-12 text-green-600 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold">
                  {weeklyAverage.toLocaleString()}
                </CardTitle>
                <CardDescription className="font-semibold">
                  Weekly Average
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">collected each week</p>
              </CardContent>
            </Card>

            <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02]">
              <CardHeader>
                <TrendingUp className="h-12 w-12 text-purple-600 mx-auto mb-4" />
                <CardTitle className="text-2xl font-bold">
                  {recordWeek.toLocaleString()}
                </CardTitle>
                <CardDescription className="font-semibold">
                  Record Week
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">
                  weekly sandwich collection
                </p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Volunteer Toolkit Section */}
        {showToolkit && (
          <Card className="bg-blue-50 border-2 border-blue-500">
            <CardHeader className="text-center">
              <CardTitle className="text-3xl text-brand-primary">
                🛠️ Group Toolkit
              </CardTitle>
              <CardDescription className="text-lg">
                Essential documents and training materials for The Sandwich
                Project volunteers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 text-center">
                <Button
                  onClick={handleLogin}
                  variant="outline"
                  className="mb-4"
                >
                  ← Access Full Platform
                </Button>
              </div>
              <DocumentsBrowser />
            </CardContent>
          </Card>
        )}

        {/* Efficiency Metrics Section */}
        <Card className="bg-gradient-to-r from-green-50 to-blue-50 border-2 border-green-200">
          <CardHeader className="text-center">
            <CardTitle className="text-2xl font-bold text-green-800">
              Proven Impact Efficiency
            </CardTitle>
            <CardDescription className="text-lg text-green-700">
              Data-backed claims with measurable results
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-3 gap-6">
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">449K</div>
                <div className="text-sm font-medium text-gray-700">
                  Year Output
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  2024 verified weekly totals
                </div>
              </div>
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-2xl font-bold text-red-600">47+</div>
                <div className="text-sm font-medium text-gray-700">
                  Mile Radius
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  verified geographic coverage
                </div>
              </div>
              <div className="text-center p-4 bg-white/60 rounded-lg">
                <div className="text-2xl font-bold text-brand-primary">1,800+</div>
                <div className="text-sm font-medium text-gray-700">
                  Weekly Data Points
                </div>
                <div className="text-xs text-gray-600 mt-1">
                  weekly data points tracked
                </div>
              </div>
            </div>
            <div className="mt-6 text-center">
              <div className="inline-flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-gray-700">
                  Crisis Response: +100% surge capacity proven during Hurricane
                  week
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Features Grid */}
        <div className="grid md:grid-cols-3 gap-6">
          <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group">
            <CardHeader>
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors duration-300">
                <Users className="h-8 w-8 text-brand-primary" />
              </div>
              <CardTitle className="group-hover:text-brand-primary transition-colors duration-300">
                Team Management
              </CardTitle>
              <CardDescription>
                Manage hosts, volunteers, and drivers with comprehensive contact
                and role management
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group">
            <CardHeader>
              <div className="w-16 h-16 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-green-200 transition-colors duration-300">
                <Calendar className="h-8 w-8 text-green-600" />
              </div>
              <CardTitle className="group-hover:text-green-600 transition-colors duration-300">
                Project Coordination
              </CardTitle>
              <CardDescription>
                Track sandwich collections, coordinate meetings, and manage
                project workflows
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="text-center bg-white/80 backdrop-blur-sm border-0 shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-[1.02] group">
            <CardHeader>
              <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-purple-200 transition-colors duration-300">
                <MessageSquare className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle className="group-hover:text-purple-600 transition-colors duration-300">
                Communication Hub
              </CardTitle>
              <CardDescription>
                Real-time messaging, committee discussions, and comprehensive
                reporting tools
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Contact Information */}
        <Card className="max-w-md mx-auto">
          <CardHeader className="text-center">
            <CardTitle>Get Involved</CardTitle>
            <CardDescription>
              Ready to make a difference in your community?
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <p className="text-sm text-gray-600">
              Contact us to learn about volunteer opportunities
            </p>
            <p className="text-sm font-medium">
              Visit:{' '}
              <span className="text-brand-primary">thesandwichproject.org</span>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
