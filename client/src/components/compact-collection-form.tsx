import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calculator, Plus, HelpCircle, AlertCircle, CheckCircle } from 'lucide-react';
import sandwichLogo from '@assets/LOGOS/sandwich logo.png';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface CompactCollectionFormProps {
  onSuccess?: () => void;
}

export default function CompactCollectionForm({
  onSuccess,
}: CompactCollectionFormProps) {
  // Get today's date in user's local timezone
  const today = new Date();
  const localDate = new Date(
    today.getTime() - today.getTimezoneOffset() * 60000
  );
  const [date, setDate] = useState(localDate.toISOString().split('T')[0]);
  const [location, setLocation] = useState('');
  const [individualCount, setIndividualCount] = useState(0);
  const [groupCollections, setGroupCollections] = useState<
    Array<{ name: string; count: number; deli?: number; turkey?: number; ham?: number; pbj?: number }>
  >([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCount, setNewGroupCount] = useState(0);

  // Optional sandwich type breakdown
  const [showIndividualBreakdown, setShowIndividualBreakdown] = useState(false);
  const [individualDeli, setIndividualDeli] = useState(0);
  const [individualTurkey, setIndividualTurkey] = useState(0);
  const [individualHam, setIndividualHam] = useState(0);
  const [individualPbj, setIndividualPbj] = useState(0);
  const [showGroupBreakdown, setShowGroupBreakdown] = useState(false);
  const [newGroupDeli, setNewGroupDeli] = useState(0);
  const [newGroupTurkey, setNewGroupTurkey] = useState(0);
  const [newGroupHam, setNewGroupHam] = useState(0);
  const [newGroupPbj, setNewGroupPbj] = useState(0);

  // Validation state
  const [individualBreakdownError, setIndividualBreakdownError] = useState<string>('');
  const [groupBreakdownError, setGroupBreakdownError] = useState<string>('');

  const { toast} = useToast();
  const queryClient = useQueryClient();

  const { data: allHosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
  });

  // Filter to only show active hosts
  const hosts = allHosts.filter((host: any) => host.status === 'active');

  const submitMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/sandwich-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to submit');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Collection submitted successfully!' });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections'],
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/sandwich-collections/stats'],
      });
      onSuccess?.();
      // Reset form
      setIndividualCount(0);
      setIndividualDeli(0);
      setIndividualTurkey(0);
      setIndividualHam(0);
      setIndividualPbj(0);
      setShowIndividualBreakdown(false);
      setGroupCollections([]);
      setLocation('');
    },
    onError: () => {
      toast({ title: 'Failed to submit collection', variant: 'destructive' });
    },
  });

  const totalSandwiches =
    individualCount +
    groupCollections.reduce((sum, group) => sum + group.count, 0);

  // Calculate breakdown sums
  const individualBreakdownSum = individualDeli + individualTurkey + individualHam + individualPbj;
  const groupBreakdownSum = newGroupDeli + newGroupTurkey + newGroupHam + newGroupPbj;

  // Validation for individual sandwich breakdown
  useEffect(() => {
    if (!showIndividualBreakdown) {
      setIndividualBreakdownError('');
      return;
    }

    const hasAnyValue = individualDeli > 0 || individualTurkey > 0 || individualHam > 0 || individualPbj > 0;
    
    if (!hasAnyValue) {
      // Allow empty breakdown (optional)
      setIndividualBreakdownError('');
      return;
    }

    // If any value is entered, enforce sum validation
    if (individualBreakdownSum !== individualCount) {
      setIndividualBreakdownError(`Type breakdown (${individualBreakdownSum}) must equal total individual sandwiches (${individualCount})`);
    } else {
      setIndividualBreakdownError('');
    }
  }, [showIndividualBreakdown, individualDeli, individualTurkey, individualHam, individualPbj, individualCount, individualBreakdownSum]);

  // Validation for group breakdown
  useEffect(() => {
    if (!showGroupBreakdown) {
      setGroupBreakdownError('');
      return;
    }

    const hasAnyValue = newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0;
    
    if (!hasAnyValue) {
      // Allow empty breakdown (optional)
      setGroupBreakdownError('');
      return;
    }

    // If any value is entered, enforce sum validation
    if (groupBreakdownSum !== newGroupCount) {
      setGroupBreakdownError(`Group type breakdown (${groupBreakdownSum}) must equal group total (${newGroupCount})`);
    } else {
      setGroupBreakdownError('');
    }
  }, [showGroupBreakdown, newGroupDeli, newGroupTurkey, newGroupHam, newGroupPbj, newGroupCount, groupBreakdownSum]);

  const addGroup = () => {
    // Prevent adding if there's a validation error
    if (groupBreakdownError) {
      toast({ 
        title: 'Invalid breakdown', 
        description: groupBreakdownError,
        variant: 'destructive' 
      });
      return;
    }

    if (newGroupName && newGroupCount > 0) {
      const newGroup: { name: string; count: number; deli?: number; turkey?: number; ham?: number; pbj?: number } = {
        name: newGroupName,
        count: Number(newGroupCount),
      };

      // Only include breakdown if provided
      if (showGroupBreakdown && (newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0)) {
        newGroup.deli = newGroupDeli;
        newGroup.turkey = newGroupTurkey;
        newGroup.ham = newGroupHam;
        newGroup.pbj = newGroupPbj;
      }

      setGroupCollections([...groupCollections, newGroup]);
      setNewGroupName('');
      setNewGroupCount(0);
      setNewGroupDeli(0);
      setNewGroupTurkey(0);
      setNewGroupHam(0);
      setNewGroupPbj(0);
      setShowGroupBreakdown(false);
    }
  };

  const handleSubmit = () => {
    if (!location) {
      toast({ title: 'Please select a location', variant: 'destructive' });
      return;
    }

    // Check for individual breakdown validation errors
    if (individualBreakdownError) {
      toast({ 
        title: 'Invalid individual breakdown', 
        description: individualBreakdownError,
        variant: 'destructive' 
      });
      return;
    }

    // Check for unsaved group entries - only warn if both fields have meaningful data
    if (newGroupName.trim() !== '' && newGroupCount > 0) {
      toast({
        title: 'Unsaved group entry',
        description:
          "Please click 'Add This Group' to save your group entry before submitting, or clear the fields if you don't want to add this group.",
        variant: 'destructive',
      });
      return;
    }

    const host = hosts.find((h: any) => h.name === location);
    const submissionData: any = {
      collectionDate: date,
      hostName: location,
      individualSandwiches: individualCount,
      submissionMethod: 'standard', // Track that this was submitted via standard form
    };

    // Include individual sandwich type breakdown if provided
    if (showIndividualBreakdown && (individualDeli > 0 || individualTurkey > 0 || individualHam > 0 || individualPbj > 0)) {
      submissionData.individualDeli = individualDeli;
      submissionData.individualTurkey = individualTurkey;
      submissionData.individualHam = individualHam;
      submissionData.individualPbj = individualPbj;
    }

    // Include ALL groups in the submission (unlimited groups)
    if (groupCollections.length > 0) {
      submissionData.groupCollections = groupCollections;
    }

    submitMutation.mutate(submissionData);
  };

  return (
    <TooltipProvider>
      <div className="max-w-sm mx-auto bg-white">
        {/* Compact header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-teal text-white text-center py-4 px-4">
          <h1 className="text-xl md:text-lg font-semibold mb-1">
            Submit Collection
          </h1>
          <p className="text-lg md:text-base opacity-90">
            Record a sandwich collection log
          </p>
        </div>

        {/* Compact form sections */}
        <div className="p-3 space-y-3">
          {/* Date and Location - stacked on mobile, side-by-side on larger screens */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-2">
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-base md:text-sm font-medium text-brand-primary">
                  Date Sandwiches Were Collected
                </label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm">
                      Enter the date you actually collected the sandwiches, not
                      today's date. We track when you submit the form
                      separately.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 md:h-10 text-lg md:text-base"
              />
            </div>
            <div>
              <div className="flex items-center gap-1 mb-1">
                <label className="text-base md:text-sm font-medium text-brand-primary">
                  Location
                </label>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      Select the location where you collected the sandwiches
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Select value={location} onValueChange={setLocation}>
                <SelectTrigger className="h-12 md:h-10 text-lg md:text-base">
                  <SelectValue placeholder="Choose location..." />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host: any) => (
                    <SelectItem key={host.id} value={host.name}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Individual sandwiches - compact row */}
          <div className="bg-gray-50 rounded p-2">
            <div className="flex items-center gap-1 mb-1">
              <label className="text-base md:text-sm font-medium text-brand-primary">
                Individual Sandwiches
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    Please subtract sandwiches made by a group from your total
                    count and report those along with the name of each group in
                    the section below.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
            {!showIndividualBreakdown ? (
              // Simple total count input when not using breakdown
              <>
                <div className="flex gap-2 items-center">
                  <Input
                    type="number"
                    value={individualCount}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setIndividualCount(value);
                    }}
                    className="h-12 md:h-10 text-lg md:text-base flex-1"
                    placeholder="0"
                  />
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-10 md:h-8 px-3 md:px-2"
                        onClick={() => window.open('https://nicunursekatie.github.io/sandwichinventory/inventorycalculator.html', '_blank')}
                      >
                        <Calculator className="h-4 w-4 md:h-3 md:w-3" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Need help counting? Use this calculator</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <p className="text-base md:text-sm text-gray-600 mt-1">
                  Don't include group totals
                </p>
              </>
            ) : (
              // Breakdown inputs when specifying sandwich types
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-sm font-medium text-gray-700">Deli</label>
                  <Input
                    type="number"
                    value={individualDeli || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setIndividualDeli(value);
                      // Auto-calculate total
                      setIndividualCount(value + individualTurkey + individualHam + individualPbj);
                    }}
                    className="h-12 md:h-10 text-lg md:text-base"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Turkey</label>
                  <Input
                    type="number"
                    value={individualTurkey || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setIndividualTurkey(value);
                      // Auto-calculate total
                      setIndividualCount(individualDeli + value + individualHam + individualPbj);
                    }}
                    className="h-12 md:h-10 text-lg md:text-base"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Ham</label>
                  <Input
                    type="number"
                    value={individualHam || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setIndividualHam(value);
                      // Auto-calculate total
                      setIndividualCount(individualDeli + individualTurkey + value + individualPbj);
                    }}
                    className="h-12 md:h-10 text-lg md:text-base"
                    placeholder="0"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">PBJ</label>
                  <Input
                    type="number"
                    value={individualPbj || ''}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      setIndividualPbj(value);
                      // Auto-calculate total
                      setIndividualCount(individualDeli + individualTurkey + individualHam + value);
                    }}
                    className="h-12 md:h-10 text-lg md:text-base"
                    placeholder="0"
                  />
                </div>
                {(individualDeli > 0 || individualTurkey > 0 || individualHam > 0 || individualPbj > 0) && (
                  <div className={`col-span-2 text-center text-sm rounded p-3 border-2 ${
                    individualBreakdownError 
                      ? 'bg-red-50 border-red-400 text-red-800' 
                      : 'bg-green-50 border-green-400 text-green-800'
                  }`}>
                    <div className="flex items-center justify-center gap-2">
                      {individualBreakdownError ? (
                        <AlertCircle className="h-4 w-4" />
                      ) : (
                        <CheckCircle className="h-4 w-4" />
                      )}
                      <span className="font-medium">
                        Breakdown Total: <span className="font-bold">{individualBreakdownSum}</span> 
                        {individualCount > 0 && ` / Expected: ${individualCount}`}
                      </span>
                    </div>
                  </div>
                )}
                {individualBreakdownError && (
                  <div className="col-span-2 bg-red-50 border border-red-400 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-red-800">
                        <p className="font-medium">{individualBreakdownError}</p>
                        <p className="text-xs mt-1">
                          Please adjust your sandwich type values so they add up to {individualCount}.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Toggle for sandwich type breakdown */}
            <div className="mt-3">
              <div className={`border rounded-lg p-3 ${showIndividualBreakdown ? 'bg-brand-primary-lighter border-brand-primary' : 'bg-gray-50 border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="individual-breakdown"
                    checked={showIndividualBreakdown}
                    onChange={(e) => {
                      setShowIndividualBreakdown(e.target.checked);
                      // Reset breakdown when hiding
                      if (!e.target.checked) {
                        setIndividualDeli(0);
                        setIndividualTurkey(0);
                        setIndividualHam(0);
                        setIndividualPbj(0);
                      }
                    }}
                    className="w-4 h-4 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="individual-breakdown" className="text-sm font-medium cursor-pointer">
                    Specify sandwich types (Deli/Turkey/Ham/PBJ) - Optional
                  </label>
                </div>
                <p className="text-xs text-gray-600 mt-1 ml-6">
                  Check this box if you know the breakdown of sandwich types
                </p>
              </div>
            </div>
          </div>

          {/* Group collections - redesigned with better flow */}
          <div className="bg-gray-50 rounded p-3">
            <div className="flex items-center gap-1 mb-3">
              <label className="text-base md:text-sm font-medium text-brand-primary">
                Group Collections
              </label>
              <Tooltip>
                <TooltipTrigger>
                  <HelpCircle className="h-5 w-5 md:h-4 md:w-4 text-gray-400" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    If any groups brought sandwiches to your location this week,
                    do not include their # in your individual sandwiches count.
                    Instead log them here, enter the name of each group and the
                    # of sandwiches they brought.
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>

            {/* Add group form - stacked layout */}
            <div className="space-y-2 mb-3">
              <Input
                placeholder="e.g. 'The Weber School'"
                value={newGroupName}
                onChange={(e) => setNewGroupName(e.target.value)}
                className="h-12 md:h-10 text-lg md:text-base"
              />

              {!showGroupBreakdown ? (
                // Simple total count input when not using breakdown
                <Input
                  type="number"
                  placeholder="Enter count (e.g. 25)"
                  value={newGroupCount || ''}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    setNewGroupCount(value);
                  }}
                  className="h-12 md:h-10 text-lg md:text-base"
                />
              ) : (
                // Breakdown inputs when specifying sandwich types
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Deli</label>
                      <Input
                        type="number"
                        value={newGroupDeli || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupDeli(value);
                          // Auto-calculate total
                          setNewGroupCount(value + newGroupTurkey + newGroupHam + newGroupPbj);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Turkey</label>
                      <Input
                        type="number"
                        value={newGroupTurkey || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupTurkey(value);
                          // Auto-calculate total
                          setNewGroupCount(newGroupDeli + value + newGroupHam + newGroupPbj);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Ham</label>
                      <Input
                        type="number"
                        value={newGroupHam || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupHam(value);
                          // Auto-calculate total
                          setNewGroupCount(newGroupDeli + newGroupTurkey + value + newGroupPbj);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">PBJ</label>
                      <Input
                        type="number"
                        value={newGroupPbj || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupPbj(value);
                          // Auto-calculate total
                          setNewGroupCount(newGroupDeli + newGroupTurkey + newGroupHam + value);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {(newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0) && (
                    <div className={`text-center text-xs rounded p-2 border-2 ${
                      groupBreakdownError 
                        ? 'bg-red-50 border-red-400 text-red-800' 
                        : 'bg-green-50 border-green-400 text-green-800'
                    }`}>
                      <div className="flex items-center justify-center gap-1">
                        {groupBreakdownError ? (
                          <AlertCircle className="h-3 w-3" />
                        ) : (
                          <CheckCircle className="h-3 w-3" />
                        )}
                        <span className="font-medium">
                          Breakdown Total: <span className="font-bold">{groupBreakdownSum}</span>
                          {newGroupCount > 0 && ` / Expected: ${newGroupCount}`}
                        </span>
                      </div>
                    </div>
                  )}
                  {groupBreakdownError && (
                    <div className="bg-red-50 border border-red-400 rounded-lg p-2">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                        <div className="text-xs text-red-800">
                          <p className="font-medium">{groupBreakdownError}</p>
                          <p className="text-xs mt-1">
                            Please adjust the values so they add up to {newGroupCount}.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Toggle for sandwich type breakdown for groups */}
              <div className={`border rounded p-2 ${showGroupBreakdown ? 'bg-brand-primary-lighter border-brand-primary' : 'bg-white border-gray-200'}`}>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="group-breakdown"
                    checked={showGroupBreakdown}
                    onChange={(e) => {
                      setShowGroupBreakdown(e.target.checked);
                      // Reset breakdown when hiding
                      if (!e.target.checked) {
                        setNewGroupDeli(0);
                        setNewGroupTurkey(0);
                        setNewGroupHam(0);
                        setNewGroupPbj(0);
                      }
                    }}
                    className="w-3 h-3 text-brand-primary focus:ring-brand-primary"
                  />
                  <label htmlFor="group-breakdown" className="text-xs font-medium cursor-pointer">
                    Specify sandwich types (Optional)
                  </label>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={addGroup}
                  disabled={!newGroupName || newGroupCount <= 0 || !!groupBreakdownError}
                  className="flex-1 h-12 md:h-10 text-lg md:text-base bg-brand-light-blue hover:bg-brand-primary"
                  data-testid="button-add-group"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add This Group
                </Button>
                {(newGroupName.trim() !== '' || newGroupCount > 0) && (
                  <Button
                    onClick={() => {
                      setNewGroupName('');
                      setNewGroupCount(0);
                    }}
                    variant="outline"
                    className="h-12 md:h-10 px-3 md:px-2"
                  >
                    Clear
                  </Button>
                )}
              </div>

              {/* Show warning if there are unsaved entries */}
              {(newGroupName.trim() !== '' || newGroupCount > 0) &&
                (!newGroupName || newGroupCount <= 0) && (
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-2">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div className="text-sm text-amber-800">
                        <p className="font-medium">
                          Group information incomplete
                        </p>
                        <p className="text-xs mt-1">
                          Please enter both group name and sandwich count before
                          adding.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
            </div>

            {/* Group list - card style with proper hierarchy */}
            {groupCollections.length === 0 ? (
              <p className="text-lg md:text-base text-gray-500 italic text-center py-2">
                No groups added
              </p>
            ) : (
              <div className="space-y-2">
                {groupCollections.map((group, index) => (
                  <div
                    key={index}
                    className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm"
                  >
                    <div className="text-lg md:text-base font-medium text-brand-primary mb-1">
                      {group.name}
                    </div>
                    <div className="text-3xl md:text-2xl font-bold text-gray-800">
                      {group.count}
                    </div>
                    {(group.deli || group.turkey || group.ham || group.pbj) && (
                      <div className="text-xs text-gray-600 mt-1">
                        {group.deli ? `Deli: ${group.deli}` : ''}{group.deli && (group.turkey || group.ham || group.pbj) ? ' • ' : ''}{group.turkey ? `Turkey: ${group.turkey}` : ''}{group.turkey && (group.ham || group.pbj) ? ' • ' : ''}{group.ham ? `Ham: ${group.ham}` : ''}{group.ham && group.pbj ? ' • ' : ''}{group.pbj ? `PBJ: ${group.pbj}` : ''}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Submit button - compact */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleSubmit}
              disabled={submitMutation.isPending || !!individualBreakdownError}
              className="flex-1 h-14 md:h-12 bg-gradient-to-r from-brand-orange to-[#e89b2e] hover:from-[#e89b2e] hover:to-brand-orange text-white font-semibold text-xl md:text-lg"
              data-testid="button-submit-collection"
            >
              {submitMutation.isPending ? 'Saving...' : 'Save My Collection'}
            </Button>
            <Tooltip>
              <TooltipTrigger>
                <HelpCircle className="h-6 w-6 md:h-4 md:w-4 text-gray-400" />
              </TooltipTrigger>
              <TooltipContent>
                <p>
                  Click to save your sandwich count. You can always edit or
                  delete it after saving or add another entry for more
                  sandwiches/more groups.
                </p>
              </TooltipContent>
            </Tooltip>
          </div>

          {/* Total counter moved to bottom */}
          <div className="mt-4 p-3 bg-gray-50 rounded-lg border">
            <div className="flex items-center justify-between">
              <span className="text-lg md:text-base font-medium text-brand-primary">
                Total Sandwiches:
              </span>
              <span className="text-3xl md:text-2xl font-bold text-brand-orange">
                {totalSandwiches}
              </span>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}
