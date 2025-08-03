import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, Calendar, Users, User } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface CollectionWalkthroughProps {
  onComplete?: () => void;
  onCancel?: () => void;
}

interface GroupCollection {
  name: string;
  count: number;
}

export default function CollectionWalkthrough({ onComplete, onCancel }: CollectionWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [collectionDate, setCollectionDate] = useState("");
  const [actualCollectionDate, setActualCollectionDate] = useState(""); // The Thursday closest to their input
  const [hostName, setHostName] = useState("");
  const [individualCount, setIndividualCount] = useState<number | null>(null);
  const [hasGroups, setHasGroups] = useState<boolean | null>(null);
  const [groups, setGroups] = useState<GroupCollection[]>([]);
  const [currentGroupName, setCurrentGroupName] = useState("");
  const [currentGroupCount, setCurrentGroupCount] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allHosts = [] } = useQuery<any[]>({
    queryKey: ["/api/hosts"],
  });

  // Filter to only show active hosts
  const hosts = allHosts.filter((host: any) => host.status === 'active');

  // Function to find the closest Thursday to a given date
  const findClosestThursday = (inputDate: string): string => {
    if (!inputDate) return "";
    
    const date = new Date(inputDate + "T12:00:00"); // Add time to avoid timezone issues
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday, 6 = Saturday
    
    let daysToThursday;
    if (day <= 4) {
      // If it's Sunday-Thursday, go to the Thursday of that week
      daysToThursday = 4 - day;
    } else {
      // If it's Friday-Saturday, go to the next Thursday
      daysToThursday = 4 + (7 - day);
    }
    
    const thursday = new Date(date);
    thursday.setDate(date.getDate() + daysToThursday);
    
    return thursday.toISOString().split('T')[0];
  };

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch("/api/sandwich-collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error("Failed to submit collection");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Collection submitted successfully!" });
      queryClient.invalidateQueries({
        queryKey: ["/api/sandwich-collections"],
      });
      onComplete?.();
    },
    onError: () => {
      toast({ title: "Failed to submit collection", variant: "destructive" });
      setIsSubmitting(false);
    },
  });

  const handleDateInput = (date: string) => {
    setCollectionDate(date);
    const thursday = findClosestThursday(date);
    setActualCollectionDate(thursday);
  };

  const addGroup = () => {
    if (currentGroupName.trim() || (currentGroupCount !== null && currentGroupCount > 0)) {
      setGroups([...groups, { 
        name: currentGroupName.trim() || "", 
        count: currentGroupCount || 0 
      }]);
      setCurrentGroupName("");
      setCurrentGroupCount(null);
    }
  };

  const removeGroup = (index: number) => {
    setGroups(groups.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    
    const submissionData: any = {
      collectionDate: actualCollectionDate, // The actual Thursday they collected
      hostName,
      individualSandwiches: individualCount || 0,
      submissionMethod: "walkthrough"
      // submittedAt is automatically set by the database
    };

    // Add group data if any groups exist
    if (groups.length > 0) {
      submissionData.group1Name = groups[0].name;
      submissionData.group1Count = groups[0].count;
      
      if (groups.length > 1) {
        submissionData.group2Name = groups[1].name;
        submissionData.group2Count = groups[1].count;
      }
    }

    submitMutation.mutate(submissionData);
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1: return collectionDate && actualCollectionDate;
      case 2: return hostName;
      case 3: return individualCount !== null;
      case 4: return hasGroups !== null;
      case 5: return true; // Group entry is optional
      default: return false;
    }
  };

  const getTotalSandwiches = () => {
    const individual = individualCount || 0;
    const groupTotal = groups.reduce((sum, group) => sum + group.count, 0);
    return individual + groupTotal;
  };

  const nextStep = () => {
    if (currentStep === 4 && hasGroups === false) {
      // Skip group entry if they said no to groups
      setCurrentStep(6);
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep === 6 && hasGroups === false) {
      // Skip back over group entry if they said no to groups
      setCurrentStep(4);
    } else {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Calendar className="w-12 h-12 mx-auto text-[#236383]" />
              <h3 className="text-xl font-semibold text-gray-900">When did you collect the sandwiches?</h3>
              <p className="text-gray-600">Enter the date you actually collected the sandwiches (not today's date)</p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => handleDateInput(e.target.value)}
                className="text-center text-lg"
              />
              
              {actualCollectionDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Collection will be logged for:</strong> Thursday, {new Date(actualCollectionDate + "T12:00:00").toLocaleDateString('en-US', { 
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-blue-600 mt-1">
                    We automatically assign collections to the Thursday of that week for consistent reporting.
                  </p>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Users className="w-12 h-12 mx-auto text-[#236383]" />
              <h3 className="text-xl font-semibold text-gray-900">Where did you collect?</h3>
              <p className="text-gray-600">Select your host location</p>
            </div>
            
            <div className="space-y-3">
              {hosts.map((host) => (
                <Button
                  key={host.id}
                  variant={hostName === host.name ? "default" : "outline"}
                  className={`w-full justify-start h-auto p-4 ${
                    hostName === host.name 
                      ? "bg-[#236383] hover:bg-[#1a4d66]" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setHostName(host.name)}
                >
                  <div className="text-left">
                    <div className="font-medium">{host.name}</div>
                    {host.contactInfo && (
                      <div className="text-sm opacity-70">{host.contactInfo}</div>
                    )}
                  </div>
                </Button>
              ))}
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <User className="w-12 h-12 mx-auto text-[#236383]" />
              <h3 className="text-xl font-semibold text-gray-900">Individual & Family Sandwiches</h3>
              <p className="text-gray-600">How many sandwiches did you collect from individuals or families?</p>
              <p className="text-sm text-gray-500">(Enter 0 if none)</p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={individualCount !== null ? individualCount : ""}
                onChange={(e) => setIndividualCount(e.target.value ? parseInt(e.target.value) : null)}
                className="text-center text-2xl font-semibold h-16"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Users className="w-12 h-12 mx-auto text-[#236383]" />
              <h3 className="text-xl font-semibold text-gray-900">Group Collections</h3>
              <p className="text-gray-600">Did you have any groups collect sandwiches at your location this week?</p>
              <p className="text-sm text-gray-500">(Groups like schools, churches, businesses, etc.)</p>
            </div>
            
            <div className="flex gap-4">
              <Button
                variant={hasGroups === true ? "default" : "outline"}
                className={`flex-1 h-16 text-lg ${
                  hasGroups === true 
                    ? "bg-[#236383] hover:bg-[#1a4d66]" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setHasGroups(true)}
              >
                Yes
              </Button>
              <Button
                variant={hasGroups === false ? "default" : "outline"}
                className={`flex-1 h-16 text-lg ${
                  hasGroups === false 
                    ? "bg-[#236383] hover:bg-[#1a4d66]" 
                    : "hover:bg-gray-50"
                }`}
                onClick={() => setHasGroups(false)}
              >
                No
              </Button>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Users className="w-12 h-12 mx-auto text-[#236383]" />
              <h3 className="text-xl font-semibold text-gray-900">Group Details</h3>
              <p className="text-gray-600">Enter the groups that collected sandwiches</p>
              <p className="text-sm text-gray-500">(Group names are optional, but counts help us track impact)</p>
            </div>
            
            {groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Added Groups:</h4>
                {groups.map((group, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-3 rounded-lg">
                    <div>
                      <span className="font-medium">{group.name || "Unnamed Group"}</span>
                      <span className="text-gray-600 ml-2">({group.count} sandwiches)</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(index)}
                      className="text-red-600 hover:text-red-800"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-4 border-t pt-4">
              <Input
                placeholder="Group name (optional)"
                value={currentGroupName}
                onChange={(e) => setCurrentGroupName(e.target.value)}
              />
              <Input
                type="number"
                min="0"
                placeholder="Number of sandwiches"
                value={currentGroupCount !== null ? currentGroupCount : ""}
                onChange={(e) => setCurrentGroupCount(e.target.value ? parseInt(e.target.value) : null)}
              />
              <Button
                onClick={addGroup}
                disabled={!currentGroupName.trim() && (currentGroupCount === null || currentGroupCount === 0)}
                className="w-full"
                variant="outline"
              >
                Add Group
              </Button>
            </div>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Check className="w-12 h-12 mx-auto text-green-600" />
              <h3 className="text-xl font-semibold text-gray-900">Ready to Submit</h3>
              <p className="text-gray-600">Please review your collection details</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">Collection Date:</span>
                <span>{new Date(actualCollectionDate + "T12:00:00").toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Location:</span>
                <span>{hostName}</span>
              </div>
              <div className="flex justify-between">
                <span className="font-medium">Individual/Family:</span>
                <span>{individualCount || 0} sandwiches</span>
              </div>
              {groups.length > 0 && (
                <div>
                  <span className="font-medium">Groups:</span>
                  <div className="mt-2 space-y-1">
                    {groups.map((group, index) => (
                      <div key={index} className="flex justify-between pl-4">
                        <span>{group.name || "Unnamed Group"}:</span>
                        <span>{group.count} sandwiches</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold pt-2 border-t">
                <span>Total Sandwiches:</span>
                <span>{getTotalSandwiches()}</span>
              </div>
              <div className="flex justify-between text-sm text-gray-600">
                <span>Form Submitted:</span>
                <span>Today, {new Date().toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card className="max-w-2xl mx-auto">
      <CardHeader className="text-center bg-gradient-to-r from-[#236383] to-[#007E8C] text-white">
        <div className="flex items-center justify-between">
          <Badge variant="secondary" className="bg-white/20 text-white">
            Step {currentStep} of 6
          </Badge>
          <CardTitle className="flex-1">Sandwich Collection Walkthrough</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white hover:bg-white/20"
          >
            Cancel
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-8">
        {renderStep()}
        
        <div className="flex justify-between mt-8 pt-6 border-t">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          
          {currentStep < 6 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-[#236383] hover:bg-[#1a4d66]"
            >
              Next
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              {isSubmitting ? "Submitting..." : "Submit Collection"}
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}