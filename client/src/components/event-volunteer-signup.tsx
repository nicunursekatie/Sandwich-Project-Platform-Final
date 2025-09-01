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
import { Textarea } from "@/components/ui/textarea";
import { 
  Users, 
  Plus, 
  UserPlus, 
  Car, 
  Mic, 
  Heart,
  Clock,
  CheckCircle,
  XCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";

interface EventVolunteerSignupProps {
  eventId: number;
  eventTitle: string;
  eventDate?: string;
}

interface EventVolunteer {
  id: number;
  eventRequestId: number;
  volunteerUserId: string;
  role: 'driver' | 'speaker' | 'general';
  status: 'pending' | 'confirmed' | 'cancelled';
  notes?: string;
  signedUpAt: Date;
  confirmedAt?: Date;
  eventRequest?: any;
}

const roleIcons = {
  driver: Car,
  speaker: Mic,
  general: Heart
};

const roleLabels = {
  driver: "Driver",
  speaker: "Speaker", 
  general: "General Volunteer"
};

const statusColors = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
  confirmed: "bg-green-100 text-green-800 border-green-200",
  cancelled: "bg-red-100 text-red-800 border-red-200"
};

export default function EventVolunteerSignup({ eventId, eventTitle, eventDate }: EventVolunteerSignupProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [showSignupDialog, setShowSignupDialog] = useState(false);
  const [selectedRole, setSelectedRole] = useState<'driver' | 'speaker' | 'general'>('general');
  const [notes, setNotes] = useState("");

  // Fetch volunteers for this event
  const { data: volunteers = [], isLoading } = useQuery({
    queryKey: ['/api/event-requests', eventId, 'volunteers'],
    queryFn: () => apiRequest('GET', `/api/event-requests/${eventId}/volunteers`)
  });

  // Check if current user is already signed up
  const userSignups = volunteers.filter((v: EventVolunteer) => v.volunteerUserId === user?.id);

  // Volunteer signup mutation
  const { mutate: signupVolunteer, isPending: isSigningUp } = useMutation({
    mutationFn: async (signupData: { role: string; notes?: string }) => {
      return apiRequest('POST', `/api/event-requests/${eventId}/volunteers`, signupData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests', eventId, 'volunteers'] });
      setShowSignupDialog(false);
      setSelectedRole('general');
      setNotes("");
      toast({
        title: "Success!",
        description: `You've signed up as a ${roleLabels[selectedRole]} for this event.`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Signup Failed",
        description: error?.message || "Failed to sign up for this event. Please try again.",
        variant: "destructive",
      });
    }
  });

  // Remove volunteer signup mutation
  const { mutate: removeSignup } = useMutation({
    mutationFn: async (volunteerId: number) => {
      return apiRequest('DELETE', `/api/event-requests/volunteers/${volunteerId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/event-requests', eventId, 'volunteers'] });
      toast({
        title: "Removed",
        description: "Your volunteer signup has been removed.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Removal Failed",
        description: error?.message || "Failed to remove signup. Please try again.",
        variant: "destructive",
      });
    }
  });

  const handleSignup = () => {
    if (!selectedRole) {
      toast({
        title: "Role Required",
        description: "Please select a volunteer role.",
        variant: "destructive",
      });
      return;
    }

    signupVolunteer({
      role: selectedRole,
      notes: notes.trim() || undefined
    });
  };

  // Group volunteers by role
  const volunteersByRole = volunteers.reduce((acc: any, volunteer: EventVolunteer) => {
    if (!acc[volunteer.role]) acc[volunteer.role] = [];
    acc[volunteer.role].push(volunteer);
    return acc;
  }, {});

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Event Volunteers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading volunteers...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Event Volunteers
        </CardTitle>
        {eventDate && (
          <p className="text-sm text-muted-foreground">
            Event Date: {format(new Date(eventDate + "T12:00:00"), "MMMM d, yyyy")}
          </p>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current User's Signups */}
        {userSignups.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-medium text-blue-900 mb-2">Your Volunteer Signups</h4>
            <div className="space-y-2">
              {userSignups.map((signup: EventVolunteer) => {
                const RoleIcon = roleIcons[signup.role];
                return (
                  <div key={signup.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <RoleIcon className="h-4 w-4 text-blue-600" />
                      <span className="font-medium">{roleLabels[signup.role]}</span>
                      <Badge className={statusColors[signup.status]}>
                        {signup.status}
                      </Badge>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeSignup(signup.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Signup Button */}
        <Dialog open={showSignupDialog} onOpenChange={setShowSignupDialog}>
          <DialogTrigger asChild>
            <Button className="w-full" variant="outline">
              <UserPlus className="h-4 w-4 mr-2" />
              Sign Up to Volunteer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Volunteer for Event</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <h4 className="font-medium mb-2">{eventTitle}</h4>
                {eventDate && (
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(eventDate + "T12:00:00"), "MMMM d, yyyy")}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label>Volunteer Role</Label>
                <Select value={selectedRole} onValueChange={(value: any) => setSelectedRole(value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">
                      <div className="flex items-center gap-2">
                        <Heart className="h-4 w-4" />
                        General Volunteer
                      </div>
                    </SelectItem>
                    <SelectItem value="driver">
                      <div className="flex items-center gap-2">
                        <Car className="h-4 w-4" />
                        Driver
                      </div>
                    </SelectItem>
                    <SelectItem value="speaker">
                      <div className="flex items-center gap-2">
                        <Mic className="h-4 w-4" />
                        Speaker
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Notes (Optional)</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Any special skills, availability, or notes..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowSignupDialog(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleSignup}
                disabled={isSigningUp || !selectedRole}
              >
                {isSigningUp ? "Signing Up..." : "Sign Up as Volunteer"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Display All Volunteers by Role */}
        {Object.keys(volunteersByRole).length > 0 && (
          <div className="space-y-4">
            <h4 className="font-medium">Current Volunteers</h4>
            {Object.entries(volunteersByRole).map(([role, roleVolunteers]: [string, any]) => {
              const RoleIcon = roleIcons[role as keyof typeof roleIcons];
              return (
                <div key={role} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <RoleIcon className="h-4 w-4" />
                    <span className="font-medium">{roleLabels[role as keyof typeof roleLabels]}</span>
                    <Badge variant="secondary">{roleVolunteers.length}</Badge>
                  </div>
                  <div className="grid gap-2">
                    {roleVolunteers.map((volunteer: EventVolunteer) => (
                      <div 
                        key={volunteer.id}
                        className="flex items-center justify-between p-2 bg-gray-50 rounded-lg"
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-teal-500"></div>
                          <span className="text-sm font-medium">
                            User {volunteer.volunteerUserId}
                          </span>
                          <Badge className={statusColors[volunteer.status]} variant="outline">
                            {volunteer.status}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1">
                          {volunteer.status === 'confirmed' && (
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          )}
                          <Clock className="h-4 w-4 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {format(new Date(volunteer.signedUpAt), "MMM d")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {volunteers.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            <Users className="h-8 w-8 mx-auto mb-2 text-gray-400" />
            <p>No volunteers signed up yet</p>
            <p className="text-sm">Be the first to volunteer for this event!</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}