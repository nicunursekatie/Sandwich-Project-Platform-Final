import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Calendar, Users, Clock, AlertCircle } from "lucide-react";

export default function SignUpGeniusViewer() {
  const signupUrl = "https://www.signupgenius.com/go/5080A4BA5AA22A7F94-50444894-thesandwich#/";
  const [iframeError, setIframeError] = useState(false);

  const handleOpenExternal = () => {
    window.open(signupUrl, '_blank');
  };

  const handleIframeError = () => {
    setIframeError(true);
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <Card className="flex-1 flex flex-col h-full">
        <CardHeader className="pb-4 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <CardTitle className="text-2xl font-bold text-gray-900 flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Users className="h-5 w-5 text-blue-600" />
              </div>
              SignUp Genius
            </CardTitle>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 p-6">
          {!iframeError ? (
            <div className="w-full h-full relative overflow-hidden rounded-lg border bg-white">
              <iframe
                id="signupgenius-iframe"
                src={signupUrl}
                className="w-full h-full border-0 rounded-lg"
                style={{ 
                  height: 'calc(100vh - 200px)',
                  minHeight: '600px'
                }}
                title="SignUp Genius"
                onError={handleIframeError}
                sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-top-navigation"
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="w-16 h-16 bg-orange-100 rounded-lg flex items-center justify-center mb-4">
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
              
              <h3 className="text-xl font-semibold text-gray-900 mb-2">
                Cannot Display SignUp Genius
              </h3>
              
              <p className="text-gray-600 text-center mb-6 max-w-md">
                SignUp Genius cannot be embedded due to security restrictions. 
                Click below to open the volunteer signup page in a new tab.
              </p>
              
              <Button
                onClick={handleOpenExternal}
                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                size="lg"
              >
                <ExternalLink className="h-5 w-5" />
                Open SignUp Genius
              </Button>
              
              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Calendar className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                  <div className="font-medium text-gray-900">Event Signup</div>
                  <div className="text-sm text-gray-600">Register for upcoming events</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Users className="h-6 w-6 text-green-600 mx-auto mb-2" />
                  <div className="font-medium text-gray-900">Volunteer Slots</div>
                  <div className="text-sm text-gray-600">Choose your preferred times</div>
                </div>
                
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <Clock className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                  <div className="font-medium text-gray-900">Time Tracking</div>
                  <div className="text-sm text-gray-600">Log volunteer hours</div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}