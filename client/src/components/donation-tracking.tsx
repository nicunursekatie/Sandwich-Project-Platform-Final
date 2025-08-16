import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Route } from "lucide-react";

export default function DonationTracking() {
  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Route className="h-6 w-6 text-[#236383]" />
            Donation Tracking
          </h1>
          <p className="text-gray-600 mt-1">
            Track sandwich distributions from host locations to recipient organizations
          </p>
        </div>
        <Button className="bg-[#236383] hover:bg-[#1d5470]">
          Log New Distribution
        </Button>
      </div>

      {/* Empty State - Ready for Real Data */}
      <Card className="border-2 border-dashed border-gray-300">
        <CardContent className="p-12 text-center">
          <Route className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Donation Tracking System
          </h3>
          <p className="text-gray-600 mb-6 max-w-md mx-auto">
            Ready to track sandwich distributions from host locations to recipient organizations. 
            Connect to your actual distribution data to get started.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}