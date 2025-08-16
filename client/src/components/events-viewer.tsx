import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, RefreshCw } from "lucide-react";

export default function EventsViewer() {
  const [isLoading, setIsLoading] = useState(false);
  
  // Convert the Google Sheets URL to an embed URL
  const spreadsheetId = "1HxPIt3jCx1Y4LuKOh9WzAlM5RMr2fkUlXCI1Yn1hx7w";
  const embedUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing&rm=minimal`;
  const fullViewUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit?usp=sharing`;

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

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Card className="flex-1 flex flex-col">
        <CardHeader className="pb-2 px-4 py-3">
          <div className="flex items-center justify-between">
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

        </CardHeader>
        
        <CardContent className="flex-1 p-0">
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
                minHeight: '750px',
                width: '110%',
                height: '110%',
                transform: 'scale(0.91)',
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