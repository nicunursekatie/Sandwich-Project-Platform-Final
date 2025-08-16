import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { ExternalLink, RefreshCw, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

export default function EventsViewer() {
  const [isLoading, setIsLoading] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(85); // Default zoom level (85%)
  
  // Convert the Google Sheets URL to an embed URL
  const spreadsheetId = "1HxPIt3jCx1Y4LuKOh9WzAlM5RMr2fkUlXCI1Yn1hx7w";
  const embedUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing&rm=minimal`;
  const fullViewUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

  // Load user's saved zoom preference
  useEffect(() => {
    const savedZoom = localStorage.getItem('events-spreadsheet-zoom');
    if (savedZoom) {
      setZoomLevel(parseInt(savedZoom));
    }
  }, []);

  // Save zoom preference when changed
  const handleZoomChange = (newZoom: number[]) => {
    const zoom = newZoom[0];
    setZoomLevel(zoom);
    localStorage.setItem('events-spreadsheet-zoom', zoom.toString());
  };

  const handleRefresh = () => {
    setIsLoading(true);
    // Reload the iframe by changing its key
    const iframe = document.getElementById('events-spreadsheet') as HTMLIFrameElement;
    if (iframe) {
      iframe.src = iframe.src;
    }
    setTimeout(() => setIsLoading(false), 1000);
  };

  const handleOpenInNewTab = () => {
    window.open(fullViewUrl, '_blank');
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(zoomLevel + 10, 150);
    handleZoomChange([newZoom]);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(zoomLevel - 10, 50);
    handleZoomChange([newZoom]);
  };

  const handleResetZoom = () => {
    handleZoomChange([85]);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Card className="flex-1 flex flex-col h-full">
        <CardHeader className="pb-1 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              🗓️ Events Calendar
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleOpenInNewTab}
                className="flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                Open in New Tab
              </Button>
            </div>
          </div>

          {/* Zoom Controls */}
          <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomOut}
                disabled={zoomLevel <= 50}
                className="h-8 w-8 p-0"
                title="Zoom Out"
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 150}
                className="h-8 w-8 p-0"
                title="Zoom In"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="h-8 w-8 p-0"
                title="Reset Zoom"
              >
                <RotateCcw className="h-3 w-3" />
              </Button>
            </div>
            
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-medium text-gray-700 whitespace-nowrap">Zoom:</span>
              <Slider
                value={[zoomLevel]}
                onValueChange={handleZoomChange}
                max={150}
                min={50}
                step={5}
                className="flex-1 max-w-32"
              />
              <span className="text-sm font-medium text-gray-900 min-w-[3rem]">{zoomLevel}%</span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 h-full">
          <div className="w-full h-full relative overflow-hidden">
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
              src={embedUrl}
              className="border-0 rounded-b-lg"
              style={{ 
                height: 'calc(100vh - 180px)',
                minHeight: '800px',
                width: `${100 / (zoomLevel / 100)}%`,
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top left'
              }}
              title="Events Calendar"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}