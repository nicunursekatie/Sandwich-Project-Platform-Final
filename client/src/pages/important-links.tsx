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

export default function ImportantLinks() {
  const [isLoading, setIsLoading] = useState(false);
  const [eventsZoomLevel, setEventsZoomLevel] = useState(85);
  const [userSheetZoomLevel, setUserSheetZoomLevel] = useState(85);

  // URLs for all the important links
  const inventoryCalculatorUrl =
    'https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html';

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

      <Tabs defaultValue="calculator" className="flex-1 flex flex-col">
        <TabsList className="grid w-full grid-cols-3">
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
              <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-900">
                      Direct Link Access
                    </p>
                    <p className="text-xs text-blue-700 truncate max-w-md">
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
