import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MapPin, Route, Clock, CheckCircle, AlertCircle, Navigation } from "lucide-react";

export default function RouteTracking() {
  const [activeRoutes] = useState([
    {
      id: 1,
      driverName: "Sarah Johnson",
      hostName: "Community Center North",
      recipientName: "Food Bank Downtown",
      status: "en_route",
      startTime: "2:30 PM",
      estimatedArrival: "3:15 PM",
      sandwichCount: 125,
      route: "Pickup → Delivery",
      distance: "4.2 miles"
    },
    {
      id: 2,
      driverName: "Mike Chen",
      hostName: "Riverside Church",
      recipientName: "Homeless Shelter",
      status: "pickup_complete",
      startTime: "2:45 PM",
      estimatedArrival: "3:30 PM",
      sandwichCount: 89,
      route: "Pickup → Delivery",
      distance: "2.8 miles"
    },
    {
      id: 3,
      driverName: "Lisa Rodriguez",
      hostName: "Methodist Church",
      recipientName: "Senior Center",
      status: "delivered",
      startTime: "1:30 PM",
      completedTime: "2:20 PM",
      sandwichCount: 76,
      route: "Pickup → Delivery",
      distance: "3.1 miles"
    }
  ]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "en_route": return "bg-blue-100 text-blue-800";
      case "pickup_complete": return "bg-orange-100 text-orange-800";
      case "delivered": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "en_route": return <Navigation className="h-4 w-4" />;
      case "pickup_complete": return <AlertCircle className="h-4 w-4" />;
      case "delivered": return <CheckCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "en_route": return "En Route to Pickup";
      case "pickup_complete": return "Heading to Delivery";
      case "delivered": return "Delivery Complete";
      default: return "Unknown Status";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Route className="h-6 w-6 text-[#236383]" />
            Route Tracking
          </h1>
          <p className="text-gray-600 mt-1">
            Track host→recipient sandwich deliveries in real-time
          </p>
        </div>
        <Button className="bg-[#236383] hover:bg-[#1d5470]">
          Add New Route
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Navigation className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Active Routes</p>
                <p className="text-xl font-semibold">2</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Completed Today</p>
                <p className="text-xl font-semibold">1</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Total Distance</p>
                <p className="text-xl font-semibold">10.1 mi</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Route className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Sandwiches in Transit</p>
                <p className="text-xl font-semibold">214</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Active Routes */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Active Routes</h2>
        <div className="grid gap-4">
          {activeRoutes.map((route) => (
            <Card key={route.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge 
                        className={`${getStatusColor(route.status)} flex items-center gap-1`}
                      >
                        {getStatusIcon(route.status)}
                        {getStatusLabel(route.status)}
                      </Badge>
                      <span className="text-sm text-gray-500">#{route.id}</span>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm font-medium text-gray-900">Driver</p>
                        <p className="text-sm text-gray-600">{route.driverName}</p>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-900">Route</p>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <MapPin className="h-3 w-3" />
                          <span className="truncate">{route.hostName}</span>
                          <span>→</span>
                          <span className="truncate">{route.recipientName}</span>
                        </div>
                      </div>
                      
                      <div>
                        <p className="text-sm font-medium text-gray-900">Sandwiches</p>
                        <p className="text-sm text-gray-600">{route.sandwichCount} sandwiches</p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2 border-t border-gray-100">
                      <div>
                        <p className="text-xs text-gray-500">Start Time</p>
                        <p className="text-sm text-gray-700">{route.startTime}</p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500">
                          {route.status === 'delivered' ? 'Completed' : 'Est. Arrival'}
                        </p>
                        <p className="text-sm text-gray-700">
                          {route.status === 'delivered' ? route.completedTime : route.estimatedArrival}
                        </p>
                      </div>
                      
                      <div>
                        <p className="text-xs text-gray-500">Distance</p>
                        <p className="text-sm text-gray-700">{route.distance}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex flex-col gap-2">
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                    {route.status !== 'delivered' && (
                      <Button size="sm" className="bg-[#236383] hover:bg-[#1d5470]">
                        Update Status
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}