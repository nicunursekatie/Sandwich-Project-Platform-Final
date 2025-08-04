import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useActivityTracker } from '@/hooks/useActivityTracker';

// Example component showing how to integrate activity tracking
export function ActivityTrackingExample() {
  const { 
    trackClick, 
    trackView, 
    trackFormSubmit, 
    trackSearch, 
    trackExport 
  } = useActivityTracker();

  React.useEffect(() => {
    // Track page/component view
    trackView('Activity Tracking Demo', 'Examples', 'Activity Tracker Demo');
  }, [trackView]);

  const handleButtonClick = () => {
    trackClick('Demo Button', 'Examples', 'Activity Tracker Demo', 'User clicked the demonstration button');
    // Your button logic here
  };

  const handleFormSubmit = () => {
    // Simulate form submission
    const success = Math.random() > 0.2; // 80% success rate for demo
    trackFormSubmit('Demo Form', 'Examples', 'Activity Tracker Demo', success);
    
    if (success) {
      alert('Form submitted successfully!');
    } else {
      alert('Form submission failed!');
    }
  };

  const handleSearch = () => {
    const query = 'sandwich collections';
    const resultsCount = Math.floor(Math.random() * 50) + 1;
    trackSearch(query, 'Examples', 'Activity Tracker Demo', resultsCount);
    alert(`Searched for "${query}" - found ${resultsCount} results`);
  };

  const handleExport = () => {
    const recordCount = 25;
    trackExport('PDF Report', 'Examples', 'Activity Tracker Demo', recordCount);
    alert(`Exported PDF with ${recordCount} records`);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>Activity Tracking Demo</CardTitle>
        <CardDescription>
          This component demonstrates how to integrate granular activity tracking throughout the application.
          All user interactions are logged with specific context.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Button 
            onClick={handleButtonClick}
            className="w-full"
          >
            Track Button Click
          </Button>
          
          <Button 
            onClick={handleFormSubmit}
            variant="outline"
            className="w-full"
          >
            Track Form Submit
          </Button>
          
          <Button 
            onClick={handleSearch}
            variant="secondary"
            className="w-full"
          >
            Track Search Action
          </Button>
          
          <Button 
            onClick={handleExport}
            variant="destructive"
            className="w-full"
          >
            Track Export Action
          </Button>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h4 className="font-semibold mb-2">What gets tracked:</h4>
          <ul className="text-sm space-y-1 text-gray-600 dark:text-gray-300">
            <li>• Specific action type (Click, Submit, Search, Export, etc.)</li>
            <li>• Section of the application (Dashboard, Collections, etc.)</li>
            <li>• Feature being used (Data Entry, Analytics, etc.)</li>
            <li>• Detailed context and metadata</li>
            <li>• Timestamp and user information</li>
          </ul>
        </div>
        
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h4 className="font-semibold mb-2 text-blue-800 dark:text-blue-200">
            Implementation Guide:
          </h4>
          <div className="text-sm space-y-1 text-blue-700 dark:text-blue-300">
            <p>1. Import the useActivityTracker hook</p>
            <p>2. Call tracking functions on user interactions</p>
            <p>3. Provide meaningful context (section, feature, details)</p>
            <p>4. View detailed analytics in the dashboard</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}