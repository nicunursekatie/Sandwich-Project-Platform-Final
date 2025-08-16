import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { RefreshCw, ZoomIn, ZoomOut, RotateCcw, ExternalLink } from "lucide-react";

export default function SignUpGeniusViewer() {
  const [isLoading, setIsLoading] = useState(true);
  const [zoomLevel, setZoomLevel] = useState(() => {
    const saved = localStorage.getItem('signupgenius-zoom-level');
    return saved ? parseInt(saved) : 85;
  });

  const embedUrl = "https://www.signupgenius.com/go/5080A4BA5AA22A7F94-50444894-thesandwich#/";

  useEffect(() => {
    const timer = setTimeout(() => setIsLoading(false), 2000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('signupgenius-zoom-level', zoomLevel.toString());
  }, [zoomLevel]);

  const handleZoomChange = (value: number[]) => {
    setZoomLevel(value[0]);
  };

  const handleZoomIn = () => {
    const newZoom = Math.min(150, zoomLevel + 10);
    setZoomLevel(newZoom);
  };

  const handleZoomOut = () => {
    const newZoom = Math.max(50, zoomLevel - 10);
    setZoomLevel(newZoom);
  };

  const handleResetZoom = () => {
    setZoomLevel(85);
  };

  const handleOpenExternal = () => {
    window.open(embedUrl, '_blank');
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Card className="flex-1 flex flex-col h-full">
        <CardHeader className="pb-1 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <CardTitle className="text-lg font-bold text-gray-900 flex items-center gap-2">
              📋 SignUp Genius
            </CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleOpenExternal}
                className="flex items-center gap-1"
              >
                <ExternalLink className="h-4 w-4" />
                Open Full View
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
              >
                <ZoomOut className="h-3 w-3" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleZoomIn}
                disabled={zoomLevel >= 150}
                className="h-8 w-8 p-0"
              >
                <ZoomIn className="h-3 w-3" />
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={handleResetZoom}
                className="h-8 px-2 text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset
              </Button>
            </div>
            
            <div className="flex items-center gap-3 flex-1">
              <span className="text-sm font-medium text-gray-600 whitespace-nowrap">Zoom:</span>
              <div className="flex-1 max-w-32">
                <Slider
                  value={[zoomLevel]}
                  onValueChange={handleZoomChange}
                  max={150}
                  min={50}
                  step={5}
                  className="w-full"
                />
              </div>
              <span className="text-sm font-medium text-gray-800 min-w-[3rem] text-right">
                {zoomLevel}%
              </span>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-0 h-full">
          <div className="w-full h-full relative overflow-hidden">
            {isLoading && (
              <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center z-10">
                <div className="flex items-center gap-2 text-gray-600">
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  Loading SignUp Genius...
                </div>
              </div>
            )}
            
            <iframe
              id="signupgenius-iframe"
              src={embedUrl}
              className="border-0 rounded-b-lg"
              style={{ 
                height: 'calc(100vh - 180px)',
                minHeight: '800px',
                width: `${100 / (zoomLevel / 100)}%`,
                transform: `scale(${zoomLevel / 100})`,
                transformOrigin: 'top left'
              }}
              title="SignUp Genius"
              loading="lazy"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox"
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}