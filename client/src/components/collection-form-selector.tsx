import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Users, FormInput, HelpCircle } from "lucide-react";
import CompactCollectionForm from "./compact-collection-form";
import CollectionWalkthrough from "./collection-walkthrough";
import { useAuth } from "@/hooks/useAuth";
import { PERMISSIONS, hasPermission } from "@shared/auth-utils";

interface CollectionFormSelectorProps {
  onSuccess?: () => void;
  onCancel?: () => void;
}

export default function CollectionFormSelector({ onSuccess, onCancel }: CollectionFormSelectorProps) {
  const [selectedMethod, setSelectedMethod] = useState<"standard" | "walkthrough" | null>(null);
  const { user } = useAuth();
  
  // Check if user has walkthrough permission
  const canUseWalkthrough = user && hasPermission(user, PERMISSIONS.USE_COLLECTION_WALKTHROUGH);
  const canCreateCollections = user && hasPermission(user, PERMISSIONS.CREATE_COLLECTIONS);

  // If user can't create collections at all, show error
  if (!canCreateCollections) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <p className="text-gray-600">You don't have permission to submit collection data.</p>
          <p className="text-sm text-gray-500 mt-2">Contact an administrator if you need access.</p>
        </CardContent>
      </Card>
    );
  }

  if (selectedMethod === "standard") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Standard Collection Form</h2>
          {canUseWalkthrough && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setSelectedMethod(null)}
            >
              Change Method
            </Button>
          )}
        </div>
        <CompactCollectionForm onSuccess={onSuccess} />
      </div>
    );
  }

  if (selectedMethod === "walkthrough") {
    return (
      <CollectionWalkthrough 
        onComplete={onSuccess}
        onCancel={() => setSelectedMethod(null)}
      />
    );
  }

  // If user doesn't have walkthrough permission, show only standard form
  if (!canUseWalkthrough) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Collection Form</h2>
          {onCancel && (
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
        <CompactCollectionForm onSuccess={onSuccess} />
      </div>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
        <CardTitle className="flex items-center justify-between">
          <span>Submit Collection Data</span>
          {onCancel && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onCancel}
              className="text-white hover:bg-white/20"
            >
              Cancel
            </Button>
          )}
        </CardTitle>
        <p className="text-white/90">Choose how you'd like to enter your collection data</p>
      </CardHeader>
      
      <CardContent className="p-8">
        <div className="grid gap-6 md:grid-cols-2">
          {/* Standard Form Option */}
          <Card 
            className="cursor-pointer border-2 hover:border-[#236383] transition-colors"
            onClick={() => setSelectedMethod("standard")}
          >
            <CardHeader className="text-center">
              <FormInput className="w-12 h-12 mx-auto text-[#236383] mb-3" />
              <CardTitle className="text-lg">Standard Form</CardTitle>
              <Badge variant="outline" className="mx-auto">Quick Entry</Badge>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-gray-600">
                Fill out all fields at once if you're comfortable with forms and have all your data ready.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div>✓ All fields visible at once</div>
                <div>✓ Faster for experienced users</div>
                <div>✓ Good for multiple group entries</div>
              </div>
              <Button 
                className="w-full bg-[#236383] hover:bg-[#1a4d66]"
                onClick={() => setSelectedMethod("standard")}
              >
                Use Standard Form
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Walkthrough Option */}
          <Card 
            className="cursor-pointer border-2 hover:border-[#007E8C] transition-colors"
            onClick={() => setSelectedMethod("walkthrough")}
          >
            <CardHeader className="text-center">
              <Users className="w-12 h-12 mx-auto text-[#007E8C] mb-3" />
              <CardTitle className="text-lg">Step-by-Step Guide</CardTitle>
              <Badge variant="outline" className="mx-auto bg-blue-50 text-blue-700">Recommended</Badge>
            </CardHeader>
            <CardContent className="text-center space-y-3">
              <p className="text-gray-600">
                Get guided through each question one at a time, with automatic date calculations.
              </p>
              <div className="space-y-2 text-sm text-gray-500">
                <div>✓ One question at a time</div>
                <div>✓ Automatic Thursday calculation</div>
                <div>✓ Clear instructions for each step</div>
              </div>
              <Button 
                className="w-full bg-[#007E8C] hover:bg-[#006B75]"
                onClick={() => setSelectedMethod("walkthrough")}
              >
                Start Walkthrough
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-3">
            <HelpCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-800">
              <strong>Important:</strong> Both methods will ask you for the <em>actual date you collected the sandwiches</em>, not today's date. 
              We automatically track when you submit the form for our records.
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}