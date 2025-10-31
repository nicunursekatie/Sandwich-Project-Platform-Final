import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import {
  ExternalLink,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Calculator,
  Link as LinkIcon,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useOnboardingTracker } from '@/hooks/useOnboardingTracker';
import { useActivityTracker } from '@/hooks/useActivityTracker';
import { logger } from '@/lib/logger';

export default function ImportantLinks() {
  const [isLoading, setIsLoading] = useState(false);
  const [eventsZoomLevel, setEventsZoomLevel] = useState(85);
  const [userSheetZoomLevel, setUserSheetZoomLevel] = useState(85);
  const { track } = useOnboardingTracker();
  const { trackView, trackClick } = useActivityTracker();

  useEffect(() => {
    trackView(
      'Links',
      'Links',
      'Important Links',
      'User accessed important links page'
    );
  }, [trackView]);

  // URLs for all the important links
  const inventoryCalculatorUrl =
    'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html';
  const eventEstimatorUrl =
    'https://nicunursekatie.github.io/sandwichinventory/eventestimator/sandwichprojecteventestimator.html';
  const eventToolkitUrl =
    'https://nicunursekatie.github.io/sandwichinventory/toolkit.html';
  // Flyers configuration - add more flyers here as they become available
  const flyers = [
    {
      id: 'ncl',
      name: 'NCL Flyer - Social Media & QR Codes',
      url: 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/Flyers/NCLflyer.html',
      description: 'Social media QR codes, newsletter signup, and Amazon wishlist',
    },
    // Add more flyers here in the future:
    // {
    //   id: 'volunteer',
    //   name: 'Volunteer Recruitment Flyer',
    //   url: 'https://nicunursekatie.github.io/sandwichprojectcollectionsites/Flyers/volunteer.html',
    //   description: 'Flyer for recruiting volunteers',
    // },
  ];

  const [selectedFlyerId, setSelectedFlyerId] = useState(flyers[0].id);
  const selectedFlyer = flyers.find(f => f.id === selectedFlyerId) || flyers[0];

  // Events Google Sheet (published version)
  const eventsEmbedUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2r5KMRKuKSrqn1yQxtw8T0e5Ooi_iBfd0HlgGVcIHtFat3o54FrqyTLB_uq-RxojjSFg1GTvpIZLZ/pubhtml?widget=true&headers=false';
  const eventsFullViewUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vT2r5KMRKuKSrqn1yQxtw8T0e5Ooi_iBfd0HlgGVcIHtFat3o54FrqyTLB_uq-RxojjSFg1GTvpIZLZ/pubhtml';

  // User's specific Google Sheet
  const userSheetUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAgug7UWU-j96KzlWYnff0oS61ezmshAvgDFugYvC-EHSeHcl5TlIKuE2dbyAJ9hz2DexSCJbf6Cpr/pubhtml';
  const userSheetEmbedUrl =
    'https://docs.google.com/spreadsheets/d/e/2PACX-1vRAgug7UWU-j96KzlWYnff0oS61ezmshAvgDFugYvC-EHSeHcl5TlIKuE2dbyAJ9hz2DexSCJbf6Cpr/pubhtml?widget=true&headers=false';

  // Track page visit for onboarding challenge
  useEffect(() => {
    track('view_important_links');
  }, []);

  // Load user's saved zoom preferences
  useEffect(() => {
    const savedEventsZoom = localStorage.getItem('important-links-events-zoom');
    const savedUserSheetZoom = localStorage.getItem(
      'important-links-user-sheet-zoom'
    );

    if (savedEventsZoom) {
      setEventsZoomLevel(parseInt(savedEventsZoom));
    }
    if (savedUserSheetZoom) {
      setUserSheetZoomLevel(parseInt(savedUserSheetZoom));
    }
  }, []);

  // Zoom control handlers for Events Sheet
  const handleEventsZoomChange = (newZoom: number[]) => {
    const zoom = (newZoom || [])[0] || 85;
    setEventsZoomLevel(zoom);
    localStorage.setItem('important-links-events-zoom', zoom.toString());
  };

  const handleEventsZoomIn = () => {
    const newZoom = Math.min(eventsZoomLevel + 10, 150);
    handleEventsZoomChange([newZoom]);
  };

  const handleEventsZoomOut = () => {
    const newZoom = Math.max(eventsZoomLevel - 10, 50);
    handleEventsZoomChange([newZoom]);
  };

  const handleEventsResetZoom = () => {
    handleEventsZoomChange([85]);
  };

  // Zoom control handlers for User Sheet
  const handleUserSheetZoomChange = (newZoom: number[]) => {
    const zoom = (newZoom || [])[0] || 85;
    setUserSheetZoomLevel(zoom);
    localStorage.setItem('important-links-user-sheet-zoom', zoom.toString());
  };

  const handleUserSheetZoomIn = () => {
    const newZoom = Math.min(userSheetZoomLevel + 10, 150);
    handleUserSheetZoomChange([newZoom]);
  };

  const handleUserSheetZoomOut = () => {
    const newZoom = Math.max(userSheetZoomLevel - 10, 50);
    handleUserSheetZoomChange([newZoom]);
  };

  const handleUserSheetResetZoom = () => {
    handleUserSheetZoomChange([85]);
  };

  const handleRefreshEvents = () => {
    setIsLoading(true);
    const iframe = document.getElementById(
      'events-spreadsheet'
    ) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleRefreshUserSheet = () => {
    setIsLoading(true);
    const iframe = document.getElementById(
      'user-spreadsheet'
    ) as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-brand-primary mb-2">
          Important Links
        </h1>
        <p className="text-gray-600">
          Quick access to essential tools and spreadsheets for planning and
          coordination.
        </p>
      </div>

      <Tabs defaultValue="toolkit" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="toolkit" className="flex items-center gap-2">
            📦 Event Toolkit
          </TabsTrigger>
          <TabsTrigger value="flyers" className="flex items-center gap-2">
            📄 Flyers & QR Codes
          </TabsTrigger>
          <TabsTrigger value="calculator" className="flex items-center gap-2">
            <Calculator className="h-4 w-4" />
            Inventory Calculator
          </TabsTrigger>
          <TabsTrigger value="events" className="flex items-center gap-2">
            📅 Events Sheet
          </TabsTrigger>
          <TabsTrigger value="user-sheet" className="flex items-center gap-2">
            <LinkIcon className="h-4 w-4" />
            Historical Collections Record
          </TabsTrigger>
        </TabsList>

        {/* Event Toolkit Tab */}
        <TabsContent value="toolkit" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📦 Event Toolkit for Volunteers
              </CardTitle>
              <CardDescription>
                Everything volunteers need to plan and host a sandwich-making event - share this with anyone making sandwiches
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() => window.open(eventToolkitUrl, '_blank')}
                    className="bg-brand-orange hover:bg-orange-600 text-white font-semibold px-8 py-3 text-base flex-1"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Open Event Toolkit
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(eventToolkitUrl);
                        alert('Link copied to clipboard!');
                      } catch (error) {
                        logger.error('Failed to copy:', error);
                      }
                    }}
                    className="border-brand-orange text-brand-orange hover:bg-orange-50 px-6 py-3 font-medium"
                  >
                    📋 Copy Link
                  </Button>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="font-semibold text-blue-900 mb-2">Shareable Link:</h3>
                  <code className="text-sm bg-white px-3 py-2 rounded border border-blue-200 block break-all">
                    {eventToolkitUrl}
                  </code>
                  <p className="text-sm text-blue-700 mt-2">
                    Share this link with schools, churches, community groups, and individuals making sandwiches
                  </p>
                </div>

                {/* Embedded Toolkit */}
                <div className="border rounded-lg overflow-hidden flex-1">
                  <iframe
                    src={eventToolkitUrl}
                    className="w-full h-full border-0"
                    style={{
                      minHeight: '800px',
                      height: '100%',
                    }}
                    title="Event Toolkit"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flyers & QR Codes Tab */}
        <TabsContent value="flyers" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                📄 Flyers & Promotional Materials
              </CardTitle>
              <CardDescription>
                {selectedFlyer.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1 flex flex-col">
                {/* Flyer Selector - Only show if multiple flyers available */}
                {flyers.length > 1 && (
                  <div className="bg-gradient-to-r from-[#236383]/10 to-[#47B3CB]/10 border border-[#47B3CB]/30 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-[#236383] mb-2">
                      Select Flyer:
                    </label>
                    <select
                      value={selectedFlyerId}
                      onChange={(e) => setSelectedFlyerId(e.target.value)}
                      className="w-full px-4 py-2 border border-[#47B3CB] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#236383] bg-white"
                    >
                      {flyers.map((flyer) => (
                        <option key={flyer.id} value={flyer.id}>
                          {flyer.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() => window.open(selectedFlyer.url, '_blank')}
                    className="bg-gradient-to-r from-[#FBAD3F] to-yellow-500 hover:from-[#FBAD3F]/90 hover:to-yellow-500/90 text-white font-semibold px-8 py-3 text-base flex-1"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    Open Flyer Page
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(selectedFlyer.url);
                        alert('Link copied to clipboard!');
                      } catch (error) {
                        logger.error('Failed to copy:', error);
                      }
                    }}
                    className="border-[#FBAD3F] text-[#FBAD3F] hover:bg-yellow-50 px-6 py-3 font-medium"
                  >
                    📋 Copy Link
                  </Button>
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <h3 className="font-semibold text-yellow-900 mb-2">Shareable Link:</h3>
                  <code className="text-sm bg-white px-3 py-2 rounded border border-yellow-200 block break-all">
                    {selectedFlyer.url}
                  </code>
                  <p className="text-sm text-yellow-700 mt-2">
                    Share this flyer to promote The Sandwich Project
                  </p>
                </div>

                {/* Flyer-specific content info - only show for NCL flyer */}
                {selectedFlyer.id === 'ncl' && (
                  <div className="grid grid-cols-2 gap-4 p-4 bg-gradient-to-br from-blue-50 to-yellow-50 rounded-lg border">
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 mb-1">✅ Social Media QR Codes</p>
                      <p className="text-xs text-gray-600">Facebook, Instagram, LinkedIn</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 mb-1">📧 Newsletter Signup</p>
                      <p className="text-xs text-gray-600">QR code for newsletter</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 mb-1">🎁 Amazon Wishlist</p>
                      <p className="text-xs text-gray-600">QR code for supply donations</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-semibold text-gray-700 mb-1">🌐 Website Link</p>
                      <p className="text-xs text-gray-600">www.thesandwichproject.org</p>
                    </div>
                  </div>
                )}

                {/* Embedded Flyers */}
                <div className="border rounded-lg overflow-hidden flex-1">
                  <iframe
                    key={selectedFlyer.id}
                    src={selectedFlyer.url}
                    className="w-full h-full border-0"
                    style={{
                      minHeight: '800px',
                      height: '100%',
                    }}
                    title={selectedFlyer.name}
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Inventory Calculator Tab */}
        <TabsContent value="calculator" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="h-5 w-5 text-brand-primary" />
                Inventory Calculator
              </CardTitle>
              <CardDescription>
                Interactive tool for calculating sandwich inventory and planning
                quantities for collections
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col">
              <div className="space-y-4 flex-1 flex flex-col">
                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() =>
                      window.open(inventoryCalculatorUrl, '_blank')
                    }
                    className="bg-brand-primary hover:bg-brand-teal text-white font-semibold px-8 py-3 text-base flex-1"
                  >
                    <Calculator className="w-5 h-5 mr-2" />
                    Open Calculator
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() =>
                      window.open(inventoryCalculatorUrl, '_blank')
                    }
                    className="border-brand-primary text-brand-primary hover:bg-brand-primary/5 px-6 py-3 font-medium"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    New Tab
                  </Button>
                </div>

                <div className="flex gap-3">
                  <Button
                    size="lg"
                    onClick={() =>
                      window.open(eventEstimatorUrl, '_blank')
                    }
                    className="bg-brand-teal hover:bg-brand-primary text-white font-semibold px-8 py-3 text-base flex-1"
                  >
                    <Calculator className="w-5 h-5 mr-2" />
                    Event Estimator
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    onClick={() =>
                      window.open(eventEstimatorUrl, '_blank')
                    }
                    className="border-brand-teal text-brand-teal hover:bg-brand-teal/5 px-6 py-3 font-medium"
                  >
                    <ExternalLink className="w-5 h-5 mr-2" />
                    New Tab
                  </Button>
                </div>

                {/* Embedded Calculator */}
                {/* Embedded Calculator - FIXED HEIGHT */}
                <div className="border rounded-lg overflow-hidden flex-1">
                  <iframe
                    src={inventoryCalculatorUrl}
                    className="w-full h-full border-0"
                    style={{
                      minHeight: '800px',
                      height: '100%',
                    }}
                    title="Inventory Calculator"
                    loading="eager"
                    referrerPolicy="no-referrer"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Events Google Sheet Tab */}
        <TabsContent value="events" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between mb-3">
                <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  📅 Events Calendar Sheet
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshEvents}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(eventsFullViewUrl, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in New Tab
                  </Button>
                </div>
              </div>

              {/* Zoom Controls for Events */}
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEventsZoomOut}
                    disabled={eventsZoomLevel <= 50}
                    className="h-8 w-8 p-0"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEventsZoomIn}
                    disabled={eventsZoomLevel >= 150}
                    className="h-8 w-8 p-0"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleEventsResetZoom}
                    className="h-8 w-8 p-0"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Zoom:
                  </span>
                  <Slider
                    value={[eventsZoomLevel]}
                    onValueChange={handleEventsZoomChange}
                    max={150}
                    min={50}
                    step={5}
                    className="flex-1 max-w-32"
                  />
                  <span className="text-sm font-medium text-gray-900 min-w-[3rem]">
                    {eventsZoomLevel}%
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1">
              <div
                className="w-full relative overflow-hidden"
                style={{ height: 'calc(100vh - 320px)', minHeight: '700px' }}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-gray-600">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Loading...
                    </div>
                  </div>
                )}

                <iframe
                  id="events-spreadsheet"
                  src={eventsEmbedUrl}
                  className="border-0 rounded-b-lg"
                  style={{
                    transform: `scale(${eventsZoomLevel / 100})`,
                    transformOrigin: 'top left',
                    width: `${100 / (eventsZoomLevel / 100)}%`,
                    height: `${100 / (eventsZoomLevel / 100)}%`,
                    minWidth: '1200px',
                    minHeight: '800px',
                  }}
                  title="Events Calendar"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* User's Custom Google Sheet Tab */}
        <TabsContent value="user-sheet" className="flex-1 flex flex-col">
          <Card className="flex-1 flex flex-col">
            <CardHeader className="pb-1">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-brand-primary" />
                    Historical Collections Record
                  </CardTitle>
                  <CardDescription>
                    Historical collections tracking spreadsheet - available as
                    link and embedded view
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRefreshUserSheet}
                    disabled={isLoading}
                    className="flex items-center gap-2"
                  >
                    <RefreshCw
                      className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                    />
                    Refresh
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(userSheetUrl, '_blank')}
                    className="flex items-center gap-2"
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open in New Tab
                  </Button>
                </div>
              </div>

              {/* Direct Link Section */}
              <div className="mb-4 p-3 bg-brand-primary-lighter rounded-lg border border-brand-primary-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-brand-primary-darker">
                      Direct Link Access
                    </p>
                    <p className="text-xs text-brand-primary truncate max-w-md">
                      {userSheetUrl}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => window.open(userSheetUrl, '_blank')}
                    className="bg-brand-primary hover:bg-brand-teal text-white"
                  >
                    <ExternalLink className="h-4 w-4 mr-1" />
                    Open Link
                  </Button>
                </div>
              </div>

              {/* Zoom Controls for User Sheet */}
              <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserSheetZoomOut}
                    disabled={userSheetZoomLevel <= 50}
                    className="h-8 w-8 p-0"
                    title="Zoom Out"
                  >
                    <ZoomOut className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserSheetZoomIn}
                    disabled={userSheetZoomLevel >= 150}
                    className="h-8 w-8 p-0"
                    title="Zoom In"
                  >
                    <ZoomIn className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleUserSheetResetZoom}
                    className="h-8 w-8 p-0"
                    title="Reset Zoom"
                  >
                    <RotateCcw className="h-3 w-3" />
                  </Button>
                </div>

                <div className="flex items-center gap-3 flex-1">
                  <span className="text-sm font-medium text-gray-700 whitespace-nowrap">
                    Zoom:
                  </span>
                  <Slider
                    value={[userSheetZoomLevel]}
                    onValueChange={handleUserSheetZoomChange}
                    max={150}
                    min={50}
                    step={5}
                    className="flex-1 max-w-32"
                  />
                  <span className="text-sm font-medium text-gray-900 min-w-[3rem]">
                    {userSheetZoomLevel}%
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0 flex-1">
              <div
                className="w-full relative overflow-hidden"
                style={{ height: 'calc(100vh - 180px)', minHeight: '800px' }}
              >
                {isLoading && (
                  <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                    <div className="flex items-center gap-2 text-gray-600">
                      <RefreshCw className="h-5 w-5 animate-spin" />
                      Loading...
                    </div>
                  </div>
                )}

                <iframe
                  id="user-spreadsheet"
                  src={userSheetEmbedUrl}
                  className="border-0 rounded-b-lg"
                  style={{
                    transform: `scale(${userSheetZoomLevel / 100})`,
                    transformOrigin: 'top left',
                    width: `${100 / (userSheetZoomLevel / 100)}%`,
                    height: `${100 / (userSheetZoomLevel / 100)}%`,
                    minWidth: '1200px',
                    minHeight: '800px',
                  }}
                  title="Historical Collections Record"
                  loading="lazy"
                  sandbox="allow-scripts allow-same-origin allow-forms"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
