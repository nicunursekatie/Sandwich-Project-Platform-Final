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
  const [groupCollections, setGroupCollections] = useState<
    Array<{ name: string; count: number; deli?: number; turkey?: number; ham?: number; pbj?: number; other?: number }>
  >([]);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupCount, setNewGroupCount] = useState(0);

  // Dual mode sandwich tracking - ALWAYS VISIBLE
  const [totalMode, setTotalMode] = useState<'simple' | 'detailed'>('simple');
  const [simpleTotal, setSimpleTotal] = useState('');
  const [details, setDetails] = useState({
    ham: '',
    turkey: '',
    deli: '',
    pbj: '',
    other: ''
  });

  // Group breakdown state
  const [showGroupBreakdown, setShowGroupBreakdown] = useState(false);
  const [newGroupDeli, setNewGroupDeli] = useState(0);
  const [newGroupTurkey, setNewGroupTurkey] = useState(0);
  const [newGroupHam, setNewGroupHam] = useState(0);
  const [newGroupPbj, setNewGroupPbj] = useState(0);
  const [newGroupOther, setNewGroupOther] = useState(0);

  // Calculator state
  const [showCalculator, setShowCalculator] = useState(false);
  const [calcDisplay, setCalcDisplay] = useState('');

  // Validation state
  const [groupBreakdownError, setGroupBreakdownError] = useState<string>('');

  const { toast} = useToast();
  const queryClient = useQueryClient();

  const { data: allHosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
  });

  // Filter to only show active hosts
  const hosts = allHosts.filter((host: any) => host.status === 'active');

  // Calculate individual total based on active mode
  const getIndividualTotal = () => {
    if (totalMode === 'simple') {
      return parseInt(simpleTotal) || 0;
    } else {
      return Object.values(details).reduce((sum, val) => sum + (parseInt(val) || 0), 0);
    }
  };

  // Check if any detail fields have values
  const hasDetails = Object.values(details).some(v => v && v !== '0');

  // Auto-switch to detailed mode if user starts typing in detail fields
  const handleDetailChange = (type: keyof typeof details, value: string) => {
    setDetails(prev => ({ ...prev, [type]: value }));
    if (value && totalMode === 'simple') {
      setTotalMode('detailed');
      setSimpleTotal(''); // Clear simple total when switching
    }
  };

  // Handle simple total change
  const handleSimpleTotalChange = (value: string) => {
    setSimpleTotal(value);
    if (value && totalMode === 'detailed') {
      setTotalMode('simple');
      setDetails({ ham: '', turkey: '', deli: '', pbj: '', other: '' }); // Clear details
    }
  };

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
      setSimpleTotal('');
      setDetails({ ham: '', turkey: '', deli: '', pbj: '', other: '' });
      setTotalMode('simple');
      setGroupCollections([]);
      setLocation('');
    },
    onError: () => {
      toast({ title: 'Failed to submit collection', variant: 'destructive' });
    },
  });

  const totalSandwiches =
    getIndividualTotal() +
    groupCollections.reduce((sum, group) => sum + group.count, 0);

  // Calculate breakdown sum for groups
  const groupBreakdownSum = newGroupDeli + newGroupTurkey + newGroupHam + newGroupPbj + newGroupOther;

  // Validation for group breakdown
  useEffect(() => {
    if (!showGroupBreakdown) {
      setGroupBreakdownError('');
      return;
    }

    const hasAnyValue = newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0 || newGroupOther > 0;

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
  }, [showGroupBreakdown, newGroupDeli, newGroupTurkey, newGroupHam, newGroupPbj, newGroupOther, newGroupCount, groupBreakdownSum]);

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
      const newGroup: { name: string; count: number; deli?: number; turkey?: number; ham?: number; pbj?: number; other?: number } = {
        name: newGroupName,
        count: Number(newGroupCount),
      };

      // Only include breakdown if provided
      if (showGroupBreakdown && (newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0 || newGroupOther > 0)) {
        newGroup.deli = newGroupDeli;
        newGroup.turkey = newGroupTurkey;
        newGroup.ham = newGroupHam;
        newGroup.pbj = newGroupPbj;
        newGroup.other = newGroupOther;
      }

      setGroupCollections([...groupCollections, newGroup]);
      setNewGroupName('');
      setNewGroupCount(0);
      setNewGroupDeli(0);
      setNewGroupTurkey(0);
      setNewGroupHam(0);
      setNewGroupPbj(0);
      setNewGroupOther(0);
      setShowGroupBreakdown(false);
    }
  };

  const handleSubmit = () => {
    if (!location) {
      toast({ title: 'Please select a location', variant: 'destructive' });
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
      individualSandwiches: getIndividualTotal(),
      submissionMethod: 'standard', // Track that this was submitted via standard form
    };

    // Include individual sandwich type breakdown if provided (detailed mode)
    if (totalMode === 'detailed' && hasDetails) {
      if (details.deli) submissionData.individualDeli = parseInt(details.deli);
      if (details.turkey) submissionData.individualTurkey = parseInt(details.turkey);
      if (details.ham) submissionData.individualHam = parseInt(details.ham);
      if (details.pbj) submissionData.individualPbj = parseInt(details.pbj);
      if (details.other) submissionData.individualOther = parseInt(details.other);
    }

    // Include ALL groups in the submission (unlimited groups)
    if (groupCollections.length > 0) {
      submissionData.groupCollections = groupCollections;
    }

    submitMutation.mutate(submissionData);
  };

  // Secure math parser to replace eval()
  const safeMathEvaluator = (expression: string): number => {
    // Remove spaces and validate characters
    const cleaned = expression.replace(/\s/g, '');

    // Only allow numbers, operators, and decimal points
    if (!/^[0-9+\-*/.()]*$/.test(cleaned)) {
      throw new Error('Invalid characters');
    }

    // Simple tokenizer
    const tokens: (number | string)[] = [];
    let current = '';

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if ('+-*/()'.includes(char)) {
        if (current) {
          const num = parseFloat(current);
          if (isNaN(num)) throw new Error('Invalid number');
          tokens.push(num);
          current = '';
        }
        tokens.push(char);
      } else {
        current += char;
      }
    }

    if (current) {
      const num = parseFloat(current);
      if (isNaN(num)) throw new Error('Invalid number');
      tokens.push(num);
    }

    if (tokens.length === 0) return 0;

    // Evaluate expression with proper order of operations
    const evaluateTokens = (tokens: (number | string)[]): number => {
      // Handle parentheses first
      while (tokens.includes('(')) {
        let openIndex = -1;
        let closeIndex = -1;

        for (let i = 0; i < tokens.length; i++) {
          if (tokens[i] === '(') openIndex = i;
          if (tokens[i] === ')') {
            closeIndex = i;
            break;
          }
        }

        if (openIndex === -1 || closeIndex === -1) {
          throw new Error('Mismatched parentheses');
        }

        const subTokens = tokens.slice(openIndex + 1, closeIndex);
        const result = evaluateTokens(subTokens);
        tokens.splice(openIndex, closeIndex - openIndex + 1, result);
      }

      // Handle multiplication and division
      for (let i = 1; i < tokens.length; i += 2) {
        if (tokens[i] === '*' || tokens[i] === '/') {
          const left = tokens[i - 1] as number;
          const right = tokens[i + 1] as number;
          const operator = tokens[i] as string;

          if (operator === '/' && right === 0) {
            throw new Error('Division by zero');
          }

          const result = operator === '*' ? left * right : left / right;
          tokens.splice(i - 1, 3, result);
          i -= 2;
        }
      }

      // Handle addition and subtraction
      for (let i = 1; i < tokens.length; i += 2) {
        if (tokens[i] === '+' || tokens[i] === '-') {
          const left = tokens[i - 1] as number;
          const right = tokens[i + 1] as number;
          const operator = tokens[i] as string;

          const result = operator === '+' ? left + right : left - right;
          tokens.splice(i - 1, 3, result);
          i -= 2;
        }
      }

      if (tokens.length !== 1 || typeof tokens[0] !== 'number') {
        throw new Error('Invalid expression');
      }

      return tokens[0];
    };

    return evaluateTokens([...tokens]);
  };

  // Calculator functions
  const handleCalcInput = (value: string) => {
    if (value === '=') {
      try {
        const result = safeMathEvaluator(calcDisplay);
        // Round to 2 decimal places to avoid floating point issues
        const rounded = Math.round(result * 100) / 100;
        setCalcDisplay(rounded.toString());
      } catch {
        setCalcDisplay('Error');
      }
    } else if (value === 'C') {
      setCalcDisplay('');
    } else if (value === '←') {
      setCalcDisplay(calcDisplay.slice(0, -1));
    } else {
      setCalcDisplay(calcDisplay + value);
    }
  };

  const useCalcResult = () => {
    if (calcDisplay && !isNaN(Number(calcDisplay))) {
      handleSimpleTotalChange(calcDisplay);
      setShowCalculator(false);
      setCalcDisplay('');
    }
  };

  return (
    <TooltipProvider>
      <div className="max-w-3xl mx-auto bg-white rounded-lg shadow-sm">
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

          {/* Individual sandwiches - DUAL MODE (always visible) */}
          <div className="bg-gray-50 rounded-lg p-5">
            <div className="flex items-center gap-1 mb-4">
              <h3 className="text-base font-semibold text-brand-primary uppercase tracking-wide">
                Individual Sandwiches
              </h3>
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

            {/* Simple Total Input - Always Visible */}
            <div className={`transition-opacity ${totalMode === 'detailed' ? 'opacity-40 pointer-events-none' : ''}`}>
              <div className="flex items-center justify-center gap-3">
                <Input
                  type="number"
                  value={simpleTotal}
                  onChange={(e) => handleSimpleTotalChange(e.target.value)}
                  placeholder="0"
                  className={`w-32 h-14 text-2xl font-semibold text-center ${totalMode === 'simple' && simpleTotal ? 'border-brand-primary bg-brand-primary/5' : ''}`}
                  disabled={totalMode === 'detailed'}
                />
                <span className="text-gray-600 font-medium">total sandwiches</span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setShowCalculator(true)}
                      disabled={totalMode === 'detailed'}
                    >
                      <Calculator className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Need help counting? Use this calculator</p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </div>

            {/* OR Divider */}
            <div className="relative text-center my-5">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-300"></div>
              </div>
              <span className="relative bg-gray-50 px-4 text-xs font-medium text-gray-500 uppercase tracking-wider">
                or break down by type
              </span>
            </div>

            {/* Detailed Input - Always Visible */}
            <div className={`transition-opacity ${totalMode === 'simple' && !hasDetails ? 'opacity-60' : ''}`}>
              <div className="flex flex-wrap justify-center items-center gap-3">
                {[
                  { key: 'ham' as const, label: 'Ham', color: 'focus:border-red-400' },
                  { key: 'turkey' as const, label: 'Turkey', color: 'focus:border-amber-400' },
                  { key: 'deli' as const, label: 'Deli', color: 'focus:border-green-400' },
                  { key: 'pbj' as const, label: 'PB&J', color: 'focus:border-purple-400' },
                  { key: 'other' as const, label: 'Other', color: 'focus:border-gray-400' }
                ].map(({ key, label, color }) => (
                  <div key={key} className="flex flex-col items-center">
                    <label className="text-xs text-gray-600 mb-1 font-medium">{label}</label>
                    <Input
                      type="number"
                      value={details[key]}
                      onChange={(e) => handleDetailChange(key, e.target.value)}
                      placeholder="0"
                      className={`w-20 h-12 text-center border rounded-lg ${color} ${totalMode === 'detailed' && details[key] ? 'border-brand-primary bg-brand-primary/5' : ''}`}
                    />
                  </div>
                ))}
              </div>

              {/* Sum display for detailed mode */}
              {totalMode === 'detailed' && hasDetails && (
                <div className="text-center mt-3">
                  <span className="text-sm font-semibold text-brand-primary">
                    Total: {getIndividualTotal()} sandwiches
                  </span>
                </div>
              )}
            </div>

            {/* Mode indicator */}
            <div className="text-center mt-4">
              <span className="text-xs text-gray-500">
                {totalMode === 'simple'
                  ? hasDetails
                    ? "Start typing in any box above to switch modes"
                    : "Using simple total"
                  : `Using breakdown (${Object.entries(details).filter(([_, v]) => v).length} types)`
                }
              </span>
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
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-700">Deli</label>
                      <Input
                        type="number"
                        value={newGroupDeli || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupDeli(value);
                          // Auto-calculate total
                          setNewGroupCount(value + newGroupTurkey + newGroupHam + newGroupPbj + newGroupOther);
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
                          setNewGroupCount(newGroupDeli + value + newGroupHam + newGroupPbj + newGroupOther);
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
                          setNewGroupCount(newGroupDeli + newGroupTurkey + value + newGroupPbj + newGroupOther);
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
                          setNewGroupCount(newGroupDeli + newGroupTurkey + newGroupHam + value + newGroupOther);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-700">Other</label>
                      <Input
                        type="number"
                        value={newGroupOther || ''}
                        onChange={(e) => {
                          const value = parseInt(e.target.value) || 0;
                          setNewGroupOther(value);
                          // Auto-calculate total
                          setNewGroupCount(newGroupDeli + newGroupTurkey + newGroupHam + newGroupPbj + value);
                        }}
                        className="h-10 text-base"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  {(newGroupDeli > 0 || newGroupTurkey > 0 || newGroupHam > 0 || newGroupPbj > 0 || newGroupOther > 0) && (
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
                        setNewGroupOther(0);
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
                    {(group.deli || group.turkey || group.ham || group.pbj || group.other) && (
                      <div className="text-xs text-gray-600 mt-1">
                        {[
                          group.deli && `Deli: ${group.deli}`,
                          group.turkey && `Turkey: ${group.turkey}`,
                          group.ham && `Ham: ${group.ham}`,
                          group.pbj && `PBJ: ${group.pbj}`,
                          group.other && `Other: ${group.other}`
                        ].filter(Boolean).join(' • ')}
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
              disabled={submitMutation.isPending}
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

        {/* Calculator Modal */}
        {showCalculator && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowCalculator(false)}
          >
            <div
              className="bg-white rounded-lg p-5 shadow-xl w-60"
              onClick={(e) => e.stopPropagation()}
            >
              <h4 className="text-base font-semibold text-brand-primary mb-3">
                Calculator Helper
              </h4>
              <p className="text-sm text-gray-600 mb-3">
                Calculate your individual count (e.g., 150 - 25 - 30 = 95)
              </p>

              <input
                type="text"
                value={calcDisplay}
                readOnly
                className="w-full h-10 px-3 border border-gray-200 rounded text-right mb-3 bg-gray-50"
                placeholder="Enter calculation..."
              />

              <div className="grid grid-cols-4 gap-2 mb-3">
                <button
                  className="h-11 border rounded bg-brand-primary text-white font-semibold hover:bg-brand-primary/90"
                  onClick={() => handleCalcInput('C')}
                >
                  C
                </button>
                <button
                  className="h-11 border rounded bg-brand-primary text-white font-semibold hover:bg-brand-primary/90"
                  onClick={() => handleCalcInput('←')}
                >
                  ←
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('/')}
                >
                  /
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('*')}
                >
                  ×
                </button>

                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('7')}
                >
                  7
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('8')}
                >
                  8
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('9')}
                >
                  9
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('-')}
                >
                  -
                </button>

                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('4')}
                >
                  4
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('5')}
                >
                  5
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('6')}
                >
                  6
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('+')}
                >
                  +
                </button>

                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('1')}
                >
                  1
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('2')}
                >
                  2
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('3')}
                >
                  3
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50 row-span-2"
                  onClick={() => handleCalcInput('=')}
                >
                  =
                </button>

                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50 col-span-2"
                  onClick={() => handleCalcInput('0')}
                >
                  0
                </button>
                <button
                  className="h-11 border rounded bg-white hover:bg-gray-50"
                  onClick={() => handleCalcInput('.')}
                >
                  .
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  className="flex-1 h-11 bg-brand-orange text-white rounded font-semibold hover:bg-brand-orange/90"
                  onClick={useCalcResult}
                >
                  Use Result
                </button>
                <button
                  className="flex-1 h-11 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                  onClick={() => setShowCalculator(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
}
