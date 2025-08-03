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
  const [useExactDate, setUseExactDate] = useState(false); // Allow override of Thursday calculation
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

  // Function to find the most recent Thursday that has already passed
  const findMostRecentThursday = (inputDate: string): string => {
    if (!inputDate) return "";
    
    const date = new Date(inputDate + "T12:00:00"); // Add time to avoid timezone issues
    const today = new Date();
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 4 = Thursday, 6 = Saturday
    
    let daysToThursday;
    if (day === 4) {
      // If it's Thursday, use that Thursday (unless it's in the future)
      daysToThursday = 0;
    } else if (day < 4) {
      // If it's Sunday-Wednesday, go to the previous Thursday
      daysToThursday = day - 4; // This will be negative
    } else {
      // If it's Friday-Saturday, go to the Thursday of that week (which already passed)
      daysToThursday = day - 4; // This will be positive (1-2 days ago)
    }
    
    const thursday = new Date(date);
    thursday.setDate(date.getDate() - Math.abs(daysToThursday));
    
    // If the calculated Thursday is in the future, go back one more week
    if (thursday > today) {
      thursday.setDate(thursday.getDate() - 7);
    }
    
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
    if (useExactDate) {
      setActualCollectionDate(date);
    } else {
      const thursday = findMostRecentThursday(date);
      setActualCollectionDate(thursday);
    }
  };

  // Initialize with today's date on component mount
  const initializeDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setCollectionDate(today);
    const thursday = findMostRecentThursday(today);
    setActualCollectionDate(thursday);
  };

  // Initialize date on first render
  if (!collectionDate) {
    initializeDate();
  }

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
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">When did you collect the sandwiches?</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Enter the date you actually collected the sandwiches (not today's date)</p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="date"
                value={collectionDate}
                onChange={(e) => handleDateInput(e.target.value)}
                className="text-center text-base sm:text-lg h-12 sm:h-auto"
              />
              
              {actualCollectionDate && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm text-blue-800">
                    <strong>Collection will be logged for:</strong> {useExactDate ? 
                      new Date(actualCollectionDate + "T12:00:00").toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      }) :
                      `Thursday, ${new Date(actualCollectionDate + "T12:00:00").toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}`
                    }
                  </p>
                  {!useExactDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      We automatically assign collections to the Thursday of that week for consistent reporting.
                    </p>
                  )}
                  
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-blue-200">
                    <input
                      type="checkbox"
                      id="useExactDate"
                      checked={useExactDate}
                      onChange={(e) => {
                        setUseExactDate(e.target.checked);
                        if (e.target.checked) {
                          setActualCollectionDate(collectionDate);
                        } else {
                          const thursday = findMostRecentThursday(collectionDate);
                          setActualCollectionDate(thursday);
                        }
                      }}
                      className="rounded border-blue-300 text-blue-600"
                    />
                    <label htmlFor="useExactDate" className="text-xs text-blue-700 cursor-pointer">
                      Use exact date (for entering old records)
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Where did you collect?</h3>
              <p className="text-sm sm:text-base text-gray-600">Select your host location</p>
            </div>
            
            <div className="space-y-3">
              {hosts.map((host) => (
                <Button
                  key={host.id}
                  variant={hostName === host.name ? "default" : "outline"}
                  className={`w-full justify-start h-auto p-3 sm:p-4 touch-manipulation ${
                    hostName === host.name 
                      ? "bg-[#236383] hover:bg-[#1a4d66]" 
                      : "hover:bg-gray-50"
                  }`}
                  onClick={() => setHostName(host.name)}
                >
                  <div className="text-left">
                    <div className="font-medium text-sm sm:text-base">{host.name}</div>
                    {host.contactInfo && (
                      <div className="text-xs sm:text-sm opacity-70">{host.contactInfo}</div>
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
              <User className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Individual & Family Sandwiches</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">How many sandwiches did you collect from individuals or families?</p>
              <p className="text-xs sm:text-sm text-gray-500">(Enter 0 if none)</p>
            </div>
            
            <div className="space-y-4">
              <Input
                type="number"
                min="0"
                placeholder="0"
                value={individualCount !== null ? individualCount : ""}
                onChange={(e) => setIndividualCount(e.target.value ? parseInt(e.target.value) : null)}
                className="text-center text-xl sm:text-2xl font-semibold h-12 sm:h-16"
              />
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Group Collections</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Did you have any groups collect sandwiches at your location this week?</p>
              <p className="text-xs sm:text-sm text-gray-500">(Groups like schools, churches, businesses, etc.)</p>
            </div>
            
            <div className="flex gap-3 sm:gap-4">
              <Button
                variant={hasGroups === true ? "default" : "outline"}
                className={`flex-1 h-12 sm:h-16 text-base sm:text-lg touch-manipulation ${
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
                className={`flex-1 h-12 sm:h-16 text-base sm:text-lg touch-manipulation ${
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
              <Users className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Group Details</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Enter the groups that collected sandwiches</p>
              <p className="text-xs sm:text-sm text-gray-500">(Group names are optional, but counts help us track impact)</p>
            </div>
            
            {groups.length > 0 && (
              <div className="space-y-2">
                <h4 className="font-medium text-gray-900">Added Groups:</h4>
                {groups.map((group, index) => (
                  <div key={index} className="flex items-center justify-between bg-gray-50 p-2 sm:p-3 rounded-lg">
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base truncate">{group.name || "Unnamed Group"}</div>
                      <div className="text-xs sm:text-sm text-gray-600">({group.count} sandwiches)</div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeGroup(index)}
                      className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0 text-xs sm:text-sm p-1 sm:p-2"
                    >
                      Remove
                    </Button>
                  </div>
                ))}
              </div>
            )}
            
            <div className="space-y-3 sm:space-y-4 border-t pt-4">
              <Input
                placeholder="e.g., The Weber School"
                value={currentGroupName}
                onChange={(e) => setCurrentGroupName(e.target.value)}
                className="h-10 sm:h-auto text-sm sm:text-base"
              />
              <Input
                type="number"
                min="0"
                placeholder="Number of sandwiches"
                value={currentGroupCount !== null ? currentGroupCount : ""}
                onChange={(e) => setCurrentGroupCount(e.target.value ? parseInt(e.target.value) : null)}
                className="h-10 sm:h-auto text-sm sm:text-base"
              />
              <Button
                onClick={addGroup}
                disabled={!currentGroupName.trim() && (currentGroupCount === null || currentGroupCount === 0)}
                className="w-full h-10 sm:h-auto text-sm sm:text-base touch-manipulation"
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
              <Check className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-green-600" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">Ready to Submit</h3>
              <p className="text-sm sm:text-base text-gray-600">Please review your collection details</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4 sm:p-6 space-y-3 sm:space-y-4">
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm sm:text-base">Collection Date:</span>
                <span className="text-sm sm:text-base text-right">{new Date(actualCollectionDate + "T12:00:00").toLocaleDateString()}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm sm:text-base">Location:</span>
                <span className="text-sm sm:text-base text-right truncate max-w-[60%]">{hostName}</span>
              </div>
              <div className="flex justify-between items-start">
                <span className="font-medium text-sm sm:text-base">Individual/Family:</span>
                <span className="text-sm sm:text-base">{individualCount || 0} sandwiches</span>
              </div>
              {groups.length > 0 && (
                <div>
                  <span className="font-medium text-sm sm:text-base">Groups:</span>
                  <div className="mt-2 space-y-1">
                    {groups.map((group, index) => (
                      <div key={index} className="flex justify-between pl-2 sm:pl-4 items-start">
                        <span className="text-sm sm:text-base truncate max-w-[60%]">{group.name || "Unnamed Group"}:</span>
                        <span className="text-sm sm:text-base">{group.count} sandwiches</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex justify-between text-base sm:text-lg font-semibold pt-2 border-t">
                <span>Total Sandwiches:</span>
                <span>{getTotalSandwiches()}</span>
              </div>
              <div className="flex justify-between text-xs sm:text-sm text-gray-600">
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
    <Card className="max-w-2xl mx-auto m-2 sm:m-4">
      <CardHeader className="text-center bg-gradient-to-r from-[#236383] to-[#007E8C] text-white p-3 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <Badge variant="secondary" className="bg-white/20 text-white text-xs sm:text-sm">
            Step {currentStep} of 6
          </Badge>
          <CardTitle className="flex-1 text-sm sm:text-lg font-medium sm:font-semibold">
            <span className="hidden sm:inline">Sandwich Collection Walkthrough</span>
            <span className="sm:hidden">Collection Walkthrough</span>
          </CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            className="text-white hover:bg-white/20 text-xs sm:text-sm p-1 sm:p-2"
          >
            Cancel
          </Button>
        </div>
      </CardHeader>
      
      <CardContent className="p-4 sm:p-8">
        {renderStep()}
        
        <div className="flex justify-between mt-6 sm:mt-8 pt-4 sm:pt-6 border-t gap-3">
          <Button
            variant="outline"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="flex items-center gap-2 h-10 sm:h-auto text-sm sm:text-base px-3 sm:px-4 touch-manipulation"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="hidden sm:inline">Back</span>
            <span className="sm:hidden">←</span>
          </Button>
          
          {currentStep < 6 ? (
            <Button
              onClick={nextStep}
              disabled={!canProceed()}
              className="flex items-center gap-2 bg-[#236383] hover:bg-[#1a4d66] h-10 sm:h-auto text-sm sm:text-base px-3 sm:px-4 touch-manipulation"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">→</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700 h-10 sm:h-auto text-sm sm:text-base px-3 sm:px-4 touch-manipulation"
            >
              <span className="hidden sm:inline">{isSubmitting ? "Submitting..." : "Submit Collection"}</span>
              <span className="sm:hidden">{isSubmitting ? "Submitting..." : "Submit"}</span>
              <Check className="w-4 h-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}