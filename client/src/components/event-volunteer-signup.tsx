import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger,
  DialogFooter 
} from "@/components/ui/dialog";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { 
  Users, 
  Plus, 
  UserPlus, 
  Car, 
  Mic, 
  Heart,
  X
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";

interface EventVolunteerSignupProps {
  eventId: number;
  eventTitle: string;
  driversNeeded: number;
  speakersNeeded: number;
}

interface EventVolunteer {
  id: number;
  eventRequestId: number;
  volunteerUserId?: string;
  volunteerName?: string;
  volunteerEmail?: string;
  role: 'driver' | 'speaker';
  status: 'pending' | 'confirmed' | 'cancelled';
  signedUpAt: Date;
}

const roleIcons = {
  driver: Car,
  speaker: Mic
};

const roleLabels = {
  driver: "Driver",
  speaker: "Speaker"
};

export default function EventVolunteerSignup({ 
  eventId, 
  eventTitle, 
  driversNeeded, 
  speakersNeeded 
}: EventVolunteerSignupProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [signupRole, setSignupRole] = useState<'driver' | 'speaker'>('driver');
  const [volunteerName, setVolunteerName] = useState((user as any)?.firstName && (user as any)?.lastName ? `${(user as any).firstName} ${(user as any).lastName}` : "");
  const [volunteerEmail, setVolunteerEmail] = useState((user as any)?.email || "");

  // Fetch existing volunteers for this event
  const { data: volunteers = [], isLoading } = useQuery({
    queryKey: ['/api/event-volunteers', eventId],
    queryFn: () => apiRequest('GET', `/api/event-volunteers/${eventId}`)
  });

  // Sign up mutation
  const signupMutation = useMutation({
    mutationFn: (data: any) => apiRequest('POST', '/api/event-volunteers', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-volunteers', eventId] });
      setShowSignupDialog(false);
      setVolunteerName((user as any)?.firstName && (user as any)?.lastName ? `${(user as any).firstName} ${(user as any).lastName}` : "");
      setVolunteerEmail((user as any)?.email || "");
      toast({ title: "Successfully signed up as volunteer!" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error signing up", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  // Remove volunteer mutation
  const removeMutation = useMutation({
    mutationFn: (volunteerId: number) => apiRequest('DELETE', `/api/event-volunteers/${volunteerId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-volunteers', eventId] });
      toast({ title: "Volunteer removed successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error removing volunteer", 
        description: error.message,
        variant: "destructive" 
      });
    }
  });

  if (isLoading) {
    return <div className="text-center py-4">Loading volunteers...</div>;
  }

  const driverVolunteers = (volunteers || []).filter((v: EventVolunteer) => v.role === 'driver' && v.status !== 'cancelled');
  const speakerVolunteers = (volunteers || []).filter((v: EventVolunteer) => v.role === 'speaker' && v.status !== 'cancelled');

  const availableDriverSpots = Math.max(0, driversNeeded - driverVolunteers.length);
  const availableSpeakerSpots = Math.max(0, speakersNeeded - speakerVolunteers.length);

  const handleSignup = () => {
    if (!volunteerName.trim()) {
      toast({ title: "Please enter your name", variant: "destructive" });
      return;
    }

    const data = {
      eventRequestId: eventId,
      role: signupRole,
      volunteerUserId: (user as any)?.id || null,
      volunteerName: volunteerName.trim(),
      volunteerEmail: volunteerEmail.trim() || null,
      status: 'confirmed'
    };

    signupMutation.mutate(data);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Volunteer Signup - {eventTitle}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        
        {/* Drivers Section */}
        {driversNeeded > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Car className="h-5 w-5" />
                Drivers ({driverVolunteers.length}/{driversNeeded})
              </h3>
              {availableDriverSpots > 0 && (
                <Badge variant="outline" className="bg-green-50">
                  {availableDriverSpots} spot{availableDriverSpots !== 1 ? 's' : ''} available
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              {driverVolunteers.map((volunteer: EventVolunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <span className="font-medium">{volunteer.volunteerName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-green-100">
                      {volunteer.status}
                    </Badge>
                    {((user as any)?.id === volunteer.volunteerUserId || (user as any)?.permissions && (user as any).permissions > 0) && (
                      <Button
                        size="sm" 
                        variant="ghost"
                        onClick={() => removeMutation.mutate(volunteer.id)}
                        disabled={removeMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {availableDriverSpots > 0 && (
                <Dialog open={showSignupDialog && signupRole === 'driver'} onOpenChange={(open) => {
                  if (open) {
                    setSignupRole('driver');
                    setShowSignupDialog(true);
                  } else {
                    setShowSignupDialog(false);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Sign Up as Driver
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sign Up as Driver</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="volunteerName">Your Name</Label>
                        <Input
                          id="volunteerName"
                          value={volunteerName}
                          onChange={(e) => setVolunteerName(e.target.value)}
                          placeholder="Enter your name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="volunteerEmail">Email (optional)</Label>
                        <Input
                          id="volunteerEmail"
                          type="email"
                          value={volunteerEmail}
                          onChange={(e) => setVolunteerEmail(e.target.value)}
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSignupDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSignup}
                        disabled={signupMutation.isPending}
                      >
                        {signupMutation.isPending ? "Signing up..." : "Sign Up"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        )}

        {/* Speakers Section */}
        {speakersNeeded > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Mic className="h-5 w-5" />
                Speakers ({speakerVolunteers.length}/{speakersNeeded})
              </h3>
              {availableSpeakerSpots > 0 && (
                <Badge variant="outline" className="bg-blue-50">
                  {availableSpeakerSpots} spot{availableSpeakerSpots !== 1 ? 's' : ''} available
                </Badge>
              )}
            </div>
            
            <div className="space-y-2">
              {speakerVolunteers.map((volunteer: EventVolunteer) => (
                <div key={volunteer.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                  <span className="font-medium">{volunteer.volunteerName}</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="bg-blue-100">
                      {volunteer.status}
                    </Badge>
                    {((user as any)?.id === volunteer.volunteerUserId || (user as any)?.permissions && (user as any).permissions > 0) && (
                      <Button
                        size="sm" 
                        variant="ghost"
                        onClick={() => removeMutation.mutate(volunteer.id)}
                        disabled={removeMutation.isPending}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              
              {availableSpeakerSpots > 0 && (
                <Dialog open={showSignupDialog && signupRole === 'speaker'} onOpenChange={(open) => {
                  if (open) {
                    setSignupRole('speaker');
                    setShowSignupDialog(true);
                  } else {
                    setShowSignupDialog(false);
                  }
                }}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full">
                      <Plus className="h-4 w-4 mr-2" />
                      Sign Up as Speaker
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Sign Up as Speaker</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="volunteerName">Your Name</Label>
                        <Input
                          id="volunteerName"
                          value={volunteerName}
                          onChange={(e) => setVolunteerName(e.target.value)}
                          placeholder="Enter your name"
                        />
                      </div>
                      <div>
                        <Label htmlFor="volunteerEmail">Email (optional)</Label>
                        <Input
                          id="volunteerEmail"
                          type="email"
                          value={volunteerEmail}
                          onChange={(e) => setVolunteerEmail(e.target.value)}
                          placeholder="Enter your email"
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setShowSignupDialog(false)}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={handleSignup}
                        disabled={signupMutation.isPending}
                      >
                        {signupMutation.isPending ? "Signing up..." : "Sign Up"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              )}
            </div>
          </div>
        )}

        {/* No volunteers needed */}
        {driversNeeded === 0 && speakersNeeded === 0 && (
          <div className="text-center py-4 text-gray-500">
            No drivers or speakers needed for this event.
          </div>
        )}
      </CardContent>
    </Card>
  );
}