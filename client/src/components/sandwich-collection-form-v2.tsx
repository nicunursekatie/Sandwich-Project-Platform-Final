import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Calendar, MapPin, Users, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface GroupCollection {
  id: string;
  name: string;
  count: number;
  deli?: number;
  pbj?: number;
  unspecified?: number;
}

interface Host {
  id: number;
  name: string;
  status: string;
}

interface SandwichCollectionFormProps {
  onSuccess?: () => void;
}

export default function SandwichCollectionFormV2({ onSuccess }: SandwichCollectionFormProps) {
  // Section 1: Date & Location State
  const [collectionDate, setCollectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [selectedHost, setSelectedHost] = useState('');
  const [customLocation, setCustomLocation] = useState('');

  // Section 2: Individual Contributions State
  const [useBreakdown, setUseBreakdown] = useState(false);
  const [individualTotal, setIndividualTotal] = useState('');
  const [individualDeli, setIndividualDeli] = useState('');
  const [individualPbj, setIndividualPbj] = useState('');
  const [individualUnspecified, setIndividualUnspecified] = useState('');

  // Section 3: Group Contributions State
  const [groups, setGroups] = useState<GroupCollection[]>([]);

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch active hosts
  const { data: hosts = [] } = useQuery<Host[]>({
    queryKey: ['/api/hosts'],
    select: (data: any) => data.filter((host: Host) => host.status === 'active'),
  });

  // Create new host mutation
  const createHostMutation = useMutation({
    mutationFn: async (hostName: string) => {
      const response = await fetch('/api/hosts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: hostName,
          status: 'active',
          email: '',
          phone: '',
          address: '',
          notes: `Created from collection form on ${new Date().toLocaleDateString()}`,
        }),
      });
      if (!response.ok) throw new Error('Failed to create host');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/hosts'] });
    },
  });

  // Submit collection mutation
  const submitMutation = useMutation({
    mutationFn: async (collectionData: any) => {
      const response = await fetch('/api/sandwich-collections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(collectionData),
      });
      if (!response.ok) throw new Error('Failed to submit collection');
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: 'Collection Submitted! 🥪',
        description: `Recorded ${calculateGrandTotal()} sandwiches successfully.`,
      });

      // Reset form
      setCollectionDate(new Date().toISOString().split('T')[0]);
      setSelectedHost('');
      setCustomLocation('');
      setIndividualTotal('');
      setIndividualDeli('');
      setIndividualPbj('');
      setIndividualUnspecified('');
      setGroups([]);
      setUseBreakdown(false);

      queryClient.invalidateQueries({ queryKey: ['/api/sandwich-collections'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sandwich-collections/stats'] });

      if (onSuccess) onSuccess();
    },
    onError: () => {
      toast({
        title: 'Submission Failed',
        description: 'Please try again or contact support.',
        variant: 'destructive',
      });
    },
  });

  // Calculate individual sandwich total
  const calculateIndividualTotal = (): number => {
    if (useBreakdown) {
      return (parseInt(individualDeli) || 0) + (parseInt(individualPbj) || 0) + (parseInt(individualUnspecified) || 0);
    }
    return parseInt(individualTotal) || 0;
  };

  // Calculate group total
  const calculateGroupTotal = (): number => {
    return groups.reduce((sum, group) => sum + (parseInt(group.count.toString()) || 0), 0);
  };

  // Calculate grand total
  const calculateGrandTotal = (): number => {
    return calculateIndividualTotal() + calculateGroupTotal();
  };

  // Auto-calculate individual total when using breakdown
  useEffect(() => {
    if (useBreakdown) {
      const total = (parseInt(individualDeli) || 0) + (parseInt(individualPbj) || 0) + (parseInt(individualUnspecified) || 0);
      setIndividualTotal(total.toString());
    }
  }, [useBreakdown, individualDeli, individualPbj, individualUnspecified]);

  // Add new group
  const addGroup = () => {
    setGroups([...groups, {
      id: Date.now().toString(),
      name: '',
      count: 0,
    }]);
  };

  // Update group
  const updateGroup = (id: string, field: keyof GroupCollection, value: any) => {
    setGroups(groups.map(g =>
      g.id === id ? { ...g, [field]: value } : g
    ));
  };

  // Remove group
  const removeGroup = (id: string) => {
    setGroups(groups.filter(g => g.id !== id));
  };

  // Form validation
  const isFormValid = (): boolean => {
    const hasLocation = selectedHost !== '' || customLocation.trim() !== '';
    const hasIndividual = calculateIndividualTotal() > 0;
    const hasGroups = groups.some(g => g.name.trim() && g.count > 0);
    const hasSandwiches = hasIndividual || hasGroups;

    return hasLocation && hasSandwiches;
  };

  // Handle form submission
  const handleSubmit = async () => {
    let finalLocation = selectedHost;

    // Create custom host if needed
    if (selectedHost === 'custom' && customLocation.trim()) {
      try {
        await createHostMutation.mutateAsync(customLocation.trim());
        finalLocation = customLocation.trim();
      } catch (error) {
        console.error('Failed to create host:', error);
        return;
      }
    }

    const collectionData = {
      collectionDate,
      hostName: finalLocation,
      individualSandwiches: calculateIndividualTotal(),
      individualDeli: useBreakdown ? (parseInt(individualDeli) || 0) : 0,
      individualPbj: useBreakdown ? (parseInt(individualPbj) || 0) : 0,
      // Note: individualUnspecified contributes to total but isn't broken down by type
      groupSandwiches: calculateGroupTotal(),
      groupCollections: groups
        .filter(g => g.name.trim() && g.count > 0)
        .map(g => ({
          name: g.name,
          count: g.count,
          deli: g.deli || 0,
          pbj: g.pbj || 0,
          // unspecified sandwiches contribute to count but aren't typed
        })),
      notes: `Submitted via form on ${new Date().toLocaleString()}`,
    };

    submitMutation.mutate(collectionData);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg shadow-sm border border-slate-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-[#236383] to-[#007E8C] px-6 py-4 rounded-t-lg">
        <h2 className="text-xl font-semibold text-white flex items-center gap-2">
          🥪 Submit Sandwich Collection
        </h2>
        <p className="text-white/90 text-sm mt-1">Record your sandwich contributions</p>
      </div>

      {/* Form Content */}
      <div className="p-6 space-y-6">
        {/* SECTION 1: Date & Location */}
        <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-5 w-5 text-[#236383]" />
            <h3 className="font-semibold text-slate-900">Date & Location</h3>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="collection-date">Collection Date</Label>
              <Input
                id="collection-date"
                type="date"
                value={collectionDate}
                onChange={(e) => setCollectionDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="host-location">Host/Location</Label>
              <Select value={selectedHost} onValueChange={setSelectedHost}>
                <SelectTrigger id="host-location" className="w-full">
                  <SelectValue placeholder="Select location..." />
                </SelectTrigger>
                <SelectContent>
                  {hosts.map((host) => (
                    <SelectItem key={host.id} value={host.name}>
                      {host.name}
                    </SelectItem>
                  ))}
                  <SelectItem value="custom">+ Add Custom Location</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedHost === 'custom' && (
            <div className="mt-4">
              <Label htmlFor="custom-location">Custom Location Name</Label>
              <Input
                id="custom-location"
                type="text"
                value={customLocation}
                onChange={(e) => setCustomLocation(e.target.value)}
                placeholder="Enter location name..."
                className="w-full mt-2"
              />
            </div>
          )}
        </div>

        {/* SECTION 2: Individual Contributions */}
        <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-[#236383]" />
              <h3 className="font-semibold text-slate-900">Individual Contributions</h3>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setUseBreakdown(!useBreakdown);
                if (!useBreakdown) {
                  // Switching to breakdown mode - clear total
                  setIndividualTotal('');
                  setIndividualDeli('');
                  setIndividualPbj('');
                  setIndividualUnspecified('');
                } else {
                  // Switching to total mode - clear breakdown
                  setIndividualDeli('');
                  setIndividualPbj('');
                  setIndividualUnspecified('');
                }
              }}
              className="text-xs"
            >
              {useBreakdown ? 'Use Total Only' : 'Specify Types'}
            </Button>
          </div>

          {!useBreakdown ? (
            // Simple total input
            <div className="space-y-2">
              <Label htmlFor="individual-total">Total Sandwiches</Label>
              <Input
                id="individual-total"
                type="number"
                min="0"
                value={individualTotal}
                onChange={(e) => setIndividualTotal(e.target.value)}
                placeholder="0"
                className="w-full text-lg font-semibold"
              />
            </div>
          ) : (
            // Type breakdown
            <div className="space-y-4">
              <p className="text-xs text-slate-600">Specify types for sandwiches where known. Use "Unspecified" for generic counts.</p>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="individual-deli" className="text-sm">Deli</Label>
                  <Input
                    id="individual-deli"
                    type="number"
                    min="0"
                    value={individualDeli}
                    onChange={(e) => setIndividualDeli(e.target.value)}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="individual-pbj" className="text-sm">PB&J</Label>
                  <Input
                    id="individual-pbj"
                    type="number"
                    min="0"
                    value={individualPbj}
                    onChange={(e) => setIndividualPbj(e.target.value)}
                    placeholder="0"
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="individual-unspecified" className="text-sm">Unspecified</Label>
                  <Input
                    id="individual-unspecified"
                    type="number"
                    min="0"
                    value={individualUnspecified}
                    onChange={(e) => setIndividualUnspecified(e.target.value)}
                    placeholder="0"
                    className="w-full"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 p-3 bg-[#236383]/10 rounded border border-[#236383]/20">
                <span className="text-sm font-medium text-slate-700">Total:</span>
                <span className="text-lg font-bold text-[#236383]">
                  {calculateIndividualTotal()}
                </span>
                {(calculateIndividualTotal() > 0) && (
                  <span className="text-xs text-slate-600 ml-2">
                    ({[
                      individualDeli && `${individualDeli} Deli`,
                      individualPbj && `${individualPbj} PBJ`,
                      individualUnspecified && `${individualUnspecified} Unspecified`
                    ].filter(Boolean).join(', ')})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: Group Contributions */}
        <div className="bg-slate-50 rounded-lg p-5 border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-[#236383]" />
              <h3 className="font-semibold text-slate-900">Group Contributions</h3>
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addGroup}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              Add Group
            </Button>
          </div>

          {groups.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
              <p className="text-sm">No group collections yet. Click "Add Group" to start.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group, index) => (
                <div key={group.id} className="bg-white p-4 rounded-lg border border-slate-200">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 space-y-3">
                      <Input
                        type="text"
                        value={group.name}
                        onChange={(e) => updateGroup(group.id, 'name', e.target.value)}
                        placeholder="Group name..."
                        className="w-full font-medium"
                      />

                      <div className="grid grid-cols-4 gap-2">
                        <Input
                          type="number"
                          min="0"
                          value={group.deli || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateGroup(group.id, 'deli', val);
                            updateGroup(group.id, 'count', val + (group.pbj || 0) + (group.unspecified || 0));
                          }}
                          placeholder="Deli"
                          className="w-full text-sm"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={group.pbj || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateGroup(group.id, 'pbj', val);
                            updateGroup(group.id, 'count', (group.deli || 0) + val + (group.unspecified || 0));
                          }}
                          placeholder="PBJ"
                          className="w-full text-sm"
                        />
                        <Input
                          type="number"
                          min="0"
                          value={group.unspecified || ''}
                          onChange={(e) => {
                            const val = parseInt(e.target.value) || 0;
                            updateGroup(group.id, 'unspecified', val);
                            updateGroup(group.id, 'count', (group.deli || 0) + (group.pbj || 0) + val);
                          }}
                          placeholder="Other"
                          className="w-full text-sm"
                        />
                        <div className="flex items-center justify-center px-2 bg-slate-100 rounded border border-slate-200">
                          <span className="text-sm font-semibold text-[#236383]">{group.count || 0}</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeGroup(group.id)}
                      className="text-red-600 hover:text-red-700 hover:bg-red-50 flex-shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div className="flex items-center gap-2 p-3 bg-[#236383]/10 rounded border border-[#236383]/20 mt-4">
              <span className="text-sm font-medium text-slate-700">Group Total:</span>
              <span className="text-lg font-bold text-[#236383]">
                {calculateGroupTotal()}
              </span>
            </div>
          )}
        </div>

        {/* SECTION 4: Review & Save */}
        <div className="bg-gradient-to-br from-[#F0FBFC] to-[#FDF6F8] rounded-lg p-5 border-2 border-[#236383]/20">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="h-5 w-5 text-[#236383]" />
            <h3 className="font-semibold text-slate-900">Review & Submit</h3>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-white/60 rounded">
              <span className="text-sm text-slate-600">Individual Sandwiches:</span>
              <span className="font-semibold text-slate-900">{calculateIndividualTotal()}</span>
            </div>

            <div className="flex justify-between items-center p-3 bg-white/60 rounded">
              <span className="text-sm text-slate-600">Group Sandwiches:</span>
              <span className="font-semibold text-slate-900">{calculateGroupTotal()}</span>
            </div>

            <div className="flex justify-between items-center p-4 bg-gradient-to-r from-[#236383] to-[#007E8C] rounded-lg">
              <span className="text-white font-semibold">Grand Total:</span>
              <span className="text-2xl font-bold text-white">{calculateGrandTotal()}</span>
            </div>

            <Button
              onClick={handleSubmit}
              disabled={!isFormValid() || submitMutation.isPending}
              className="w-full bg-[#FBAD3F] hover:bg-[#F7931E] text-white font-semibold py-6 text-lg mt-4"
            >
              {submitMutation.isPending ? 'Submitting...' : 'Submit Collection'}
            </Button>

            {!isFormValid() && (
              <p className="text-sm text-amber-600 text-center">
                Please fill in location and add at least some sandwiches to submit.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
