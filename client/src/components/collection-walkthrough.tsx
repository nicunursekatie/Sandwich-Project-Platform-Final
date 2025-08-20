import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, Calendar, Users, User, AlertCircle, MapPin, Plus } from "lucide-react";
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
  const [actualCollectionDate, setActualCollectionDate] = useState(""); // The Wednesday closest to their input
  const [useExactDate, setUseExactDate] = useState(false); // Allow override of Wednesday calculation
  const [hostName, setHostName] = useState("");
  const [individualCount, setIndividualCount] = useState<number | null>(null);
  const [hasGroups, setHasGroups] = useState<boolean | null>(null);
  const [groupInputs, setGroupInputs] = useState<GroupCollection[]>([{ name: "", count: 0 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const walkthroughRef = useRef<HTMLDivElement>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: allHosts = [] } = useQuery<any[]>({
    queryKey: ["/api/hosts"],
  });

  // Filter to only show active hosts
  const hosts = allHosts.filter((host: any) => host.status === 'active');

  // Function to find the most recent Wednesday that has already passed
  const findMostRecentWednesday = (inputDate: string): string => {
    if (!inputDate) return "";
    
    const date = new Date(inputDate + "T12:00:00"); // Add time to avoid timezone issues
    const today = new Date();
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ..., 3 = Wednesday, 6 = Saturday
    
    let daysToWednesday;
    if (day === 3) {
      // If it's Wednesday, use that Wednesday (unless it's in the future)
      daysToWednesday = 0;
    } else if (day < 3) {
      // If it's Sunday-Tuesday, go to the previous Wednesday
      daysToWednesday = day - 3; // This will be negative
    } else {
      // If it's Thursday-Saturday, go to the Wednesday of that week (which already passed)
      daysToWednesday = day - 3; // This will be positive (1-3 days ago)
    }
    
    const wednesday = new Date(date);
    wednesday.setDate(date.getDate() - Math.abs(daysToWednesday));
    
    // If the calculated Wednesday is in the future, go back one more week
    if (wednesday > today) {
      wednesday.setDate(wednesday.getDate() - 7);
    }
    
    return wednesday.toISOString().split('T')[0];
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
      const wednesday = findMostRecentWednesday(date);
      setActualCollectionDate(wednesday);
    }
  };

  // Initialize with today's date on component mount
  const initializeDate = () => {
    const today = new Date().toISOString().split('T')[0];
    setCollectionDate(today);
    const wednesday = findMostRecentWednesday(today);
    setActualCollectionDate(wednesday);
  };

  // Initialize date on first render
  if (!collectionDate) {
    initializeDate();
  }

  const addGroupRow = () => {
    setGroupInputs([...groupInputs, { name: "", count: 0 }]);
  };

  const removeGroupRow = (index: number) => {
    if (groupInputs.length > 1) {
      setGroupInputs(groupInputs.filter((_, i) => i !== index));
    }
  };

  const updateGroupInput = (index: number, field: 'name' | 'count', value: string | number) => {
    const updated = [...groupInputs];
    updated[index] = { ...updated[index], [field]: value };
    setGroupInputs(updated);
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

    // Add group data from input rows that have meaningful data
    const validGroups = groupInputs.filter(group => group.name.trim() || group.count > 0);
    if (validGroups.length > 0) {
      submissionData.group1Name = validGroups[0].name.trim() || "";
      submissionData.group1Count = validGroups[0].count || 0;
      
      if (validGroups.length > 1) {
        submissionData.group2Name = validGroups[1].name.trim() || "";
        submissionData.group2Count = validGroups[1].count || 0;
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
      case 5:
        // Group details step - allow if user has meaningful group data or wants to skip
        return true;
      default: return false;
    }
  };

  const getTotalSandwiches = () => {
    const individual = individualCount || 0;
    const validGroups = groupInputs.filter(group => group.name.trim() || group.count > 0);
    const groupTotal = validGroups.reduce((sum, group) => sum + group.count, 0);
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

  // Scroll management for mobile
  useEffect(() => {
    const scrollToWalkthrough = () => {
      if (walkthroughRef.current && window.innerWidth <= 768) {
        // Small delay to let content render first
        setTimeout(() => {
          walkthroughRef.current?.scrollIntoView({
            behavior: 'smooth',
            block: 'center',
            inline: 'nearest'
          });
        }, 100);
      }
    };

    scrollToWalkthrough();
  }, [currentStep]);

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <Calendar className="w-10 h-10 sm:w-12 sm:h-12 mx-auto text-[#236383]" />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900">When did you collect the sandwiches?</h3>
              <p className="text-sm sm:text-base text-gray-600 px-2">Enter the actual date you collected the sandwiches, not today's submission date</p>
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
                      `Wednesday, ${new Date(actualCollectionDate + "T12:00:00").toLocaleDateString('en-US', { 
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}`
                    }
                  </p>
                  {!useExactDate && (
                    <p className="text-xs text-blue-600 mt-1">
                      We automatically assign collections to the Wednesday of that week for consistent reporting.
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
                          const wednesday = findMostRecentWednesday(collectionDate);
                          setActualCollectionDate(wednesday);
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
                  onClick={() => {
                    setHostName(host.name);
                    // Auto-advance when host is selected
                    setTimeout(() => {
                      setCurrentStep(3);
                    }, 300);
                  }}
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
                onClick={() => {
                  setHasGroups(true);
                  // Auto-advance when Yes is selected
                  setTimeout(() => {
                    setCurrentStep(5);
                  }, 300);
                }}
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
                onClick={() => {
                  setHasGroups(false);
                  // Auto-advance when No is selected - skip to summary since no groups to add
                  setTimeout(() => {
                    setCurrentStep(6);
                  }, 300);
                }}
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
            
            <div className="space-y-3 sm:space-y-4">
              {groupInputs.map((group, index) => (
                <div key={index} className="border rounded-lg p-3 sm:p-4 bg-gray-50">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="font-medium text-gray-900 text-sm sm:text-base">
                      Group {index + 1}
                    </h4>
                    {groupInputs.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeGroupRow(index)}
                        className="text-red-600 hover:text-red-800 text-xs sm:text-sm p-1"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Input
                      placeholder="e.g., The Weber School"
                      value={group.name}
                      onChange={(e) => updateGroupInput(index, 'name', e.target.value)}
                      className="h-10 sm:h-auto text-sm sm:text-base"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Number of sandwiches"
                      value={group.count || ""}
                      onChange={(e) => updateGroupInput(index, 'count', parseInt(e.target.value) || 0)}
                      className="h-10 sm:h-auto text-sm sm:text-base"
                    />
                  </div>
                </div>
              ))}
              
              <Button
                onClick={addGroupRow}
                className="w-full h-10 sm:h-auto text-sm sm:text-base touch-manipulation border-dashed"
                variant="outline"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Another Group
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
            
            <div className="space-y-4">
              {/* Collection Date Section */}
              <div className="bg-white border-l-4 border-[#236383] rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-[#236383]" />
                  <span className="font-semibold text-[#236383] text-sm sm:text-base">Collection Date</span>
                </div>
                <div className="text-base sm:text-lg font-medium text-gray-900">
                  {new Date(actualCollectionDate + "T12:00:00").toLocaleDateString('en-US', { 
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </div>
              </div>

              {/* Location Section */}
              <div className="bg-white border-l-4 border-[#236383] rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <MapPin className="w-4 h-4 text-[#236383]" />
                  <span className="font-semibold text-[#236383] text-sm sm:text-base">Location</span>
                </div>
                <div className="text-base sm:text-lg font-medium text-gray-900">{hostName}</div>
              </div>

              {/* Individual/Family Section */}
              <div className="bg-white border-l-4 border-[#236383] rounded-lg p-4 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <User className="w-4 h-4 text-[#236383]" />
                  <span className="font-semibold text-[#236383] text-sm sm:text-base">Individual & Family</span>
                </div>
                <div className="text-base sm:text-lg font-medium text-gray-900">
                  {individualCount || 0} sandwiches
                </div>
              </div>

              {/* Groups Section */}
              {(() => {
                const validGroups = groupInputs.filter(group => group.name.trim() || group.count > 0);
                return validGroups.length > 0 && (
                  <div className="bg-white border-l-4 border-[#236383] rounded-lg p-4 shadow-sm">
                    <div className="flex items-center gap-2 mb-3">
                      <Users className="w-4 h-4 text-[#236383]" />
                      <span className="font-semibold text-[#236383] text-sm sm:text-base">Groups</span>
                    </div>
                    <div className="space-y-2">
                      {validGroups.map((group, index) => (
                        <div key={index} className="bg-gray-50 rounded-md p-2 sm:p-3">
                          <div className="flex justify-between items-center">
                            <span className="font-medium text-sm sm:text-base text-gray-900 truncate max-w-[60%]">
                              {group.name.trim() || "Unnamed Group"}
                            </span>
                            <span className="text-sm sm:text-base font-semibold text-[#236383]">
                              {group.count} sandwiches
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* Total Section */}
              <div className="bg-gradient-to-r from-[#236383] to-[#007E8C] text-white rounded-lg p-4 shadow-md">
                <div className="flex items-center gap-2 mb-2">
                  <Check className="w-5 h-5" />
                  <span className="font-semibold text-base sm:text-lg">Total Collection</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold">
                  {getTotalSandwiches()} sandwiches
                </div>
                <div className="text-sm opacity-90 mt-1">
                  Form submitted: Today, {new Date().toLocaleDateString()}
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Card ref={walkthroughRef} className="max-w-2xl mx-auto m-2 sm:m-4">
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