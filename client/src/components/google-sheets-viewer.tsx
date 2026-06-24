import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
} from 'lucide-react';

interface GoogleSheetsViewerProps {
  initialUrl?: string;
  title?: string;
  height?: number;
}

export function GoogleSheetsViewer({
  title = 'Google Sheets Viewer',
  height = 600,
}: GoogleSheetsViewerProps) {
  // Fixed URLs for the sandwich totals spreadsheet. This viewer is read-only:
  // it embeds the live Google Sheet directly (no backend), so there is nothing
  // to upload or proxy — admins edit the sheet in Google.
  const FIXED_SHEET_URL =
    'https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit?gid=1218710353#gid=1218710353';
  const FIXED_VIEWER_URL =
    'https://docs.google.com/spreadsheets/d/1mjx5o6boluo8mNx8tzAV76NBGS6tF0um2Rq9bIdxPo8/edit?usp=sharing&embedded=true';

  const [isLoading, setIsLoading] = useState(true);
  // Bump to force the iframe to reload the latest sheet contents.
  const [refreshKey, setRefreshKey] = useState(0);

  const handleRefresh = () => {
    setIsLoading(true);
    setRefreshKey((k) => k + 1);
  };

  const openInNewTab = () => {
    window.open(FIXED_SHEET_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {title}
          </CardTitle>
          <CardDescription>
            A read-only view of our sandwich totals spreadsheet, showing the
            complete collection data. Edits are made directly in Google Sheets.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between items-center">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-700">
                Sandwich Totals Spreadsheet
              </p>
              <p className="text-xs text-gray-500">
                Complete collection data from 2023-2025
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleRefresh}
                title="Reload the sheet"
              >
                <RefreshCw
                  className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
                />
                Refresh
              </Button>
              <Button
                variant="outline"
                onClick={openInNewTab}
                title="Open in Google Sheets"
              >
                <ExternalLink className="h-4 w-4" />
                Open
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span>Sandwich Totals Data Sheet</span>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span>Read-only view</span>
              {isLoading && <RefreshCw className="h-4 w-4 animate-spin" />}
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="border rounded-lg overflow-hidden relative"
            onWheel={(e) => {
              // Prevent parent scrolling when scrolling within the iframe container
              e.stopPropagation();
            }}
            onTouchMove={(e) => {
              // Prevent parent scrolling on mobile
              e.stopPropagation();
            }}
            style={{
              height: `${height}px`,
              overflow: 'hidden',
              isolation: 'isolate',
            }}
          >
            <iframe
              key={refreshKey}
              src={FIXED_VIEWER_URL}
              width="100%"
              height={height}
              style={{
                border: 'none',
                display: 'block',
                overflow: 'hidden',
              }}
              title="Sandwich Totals Data Sheet"
              onLoad={() => setIsLoading(false)}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default GoogleSheetsViewer;
