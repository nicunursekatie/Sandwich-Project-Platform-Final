import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import ModernPermissionsEditor from '@/components/modern-permissions-editor';
import { Shield, Users, Settings } from 'lucide-react';

// Demo user data
const DEMO_USERS = [
  {
    id: 'demo-1',
    email: 'volunteer@example.com',
    firstName: 'Jane',
    lastName: 'Volunteer',
    role: 'volunteer',
    permissions: ['HOSTS_VIEW', 'COLLECTIONS_VIEW', 'CHAT_GENERAL', 'KUDOS_SEND'],
    isActive: true
  },
  {
    id: 'demo-2', 
    email: 'admin@example.com',
    firstName: 'John',
    lastName: 'Admin',
    role: 'admin',
    permissions: ['USERS_EDIT', 'ADMIN_ACCESS', 'EVENT_REQUESTS_EDIT', 'HOSTS_EDIT', 'COLLECTIONS_EDIT_ALL'],
    isActive: true
  },
  {
    id: 'demo-3',
    email: 'host@example.com', 
    firstName: 'Maria',
    lastName: 'Host',
    role: 'host',
    permissions: ['HOSTS_VIEW', 'COLLECTIONS_ADD', 'CHAT_HOST', 'ANALYTICS_VIEW'],
    isActive: true
  }
];

export default function PermissionsEditorDemo() {
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [showEditor, setShowEditor] = useState(false);

  const handleEditPermissions = (user: any) => {
    setSelectedUser(user);
    setShowEditor(true);
  };

  const handleSavePermissions = (userId: string, role: string, permissions: string[]) => {
    console.log('🔧 Permissions Updated:', { userId, role, permissions });
    // In real app, this would call your API
    alert(`✅ Permissions updated for ${selectedUser?.firstName}!\nRole: ${role}\nPermissions: ${permissions.length} selected`);
    setShowEditor(false);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          🎨 Modern Permissions Editor
        </h1>
        <p className="text-gray-600 max-w-2xl mx-auto">
          A beautiful, intuitive interface for managing user permissions with role templates, 
          search functionality, and comprehensive permission categorization.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {DEMO_USERS.map(user => (
          <Card key={user.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {user.firstName} {user.lastName}
              </CardTitle>
              <CardDescription>
                {user.email} • {user.role}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">
                    Current Permissions ({user.permissions.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {user.permissions.slice(0, 3).map(perm => (
                      <span 
                        key={perm}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                      >
                        {perm.replace('_', ' ')}
                      </span>
                    ))}
                    {user.permissions.length > 3 && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{user.permissions.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
                
                <Button 
                  onClick={() => handleEditPermissions(user)}
                  className="w-full"
                  variant="outline"
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Permissions
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-900">
            <Shield className="h-5 w-5" />
            Features Showcase
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">✨ Key Features:</h4>
              <ul className="space-y-1 text-blue-800">
                <li>• Role-based templates for quick setup</li>
                <li>• Categorized permissions with descriptions</li>
                <li>• Visual permission level indicators</li>
                <li>• Real-time search and filtering</li>
                <li>• Change tracking with unsaved indicator</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-blue-900 mb-2">🎯 Permission Categories:</h4>
              <ul className="space-y-1 text-blue-800">
                <li>• Core Access & Data Management</li>
                <li>• Event & Project Management</li>
                <li>• Communication & Chat Rooms</li>
                <li>• System Administration</li>
                <li>• Work Tracking & Community Features</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <ModernPermissionsEditor
        user={selectedUser}
        open={showEditor}
        onOpenChange={setShowEditor}
        onSave={handleSavePermissions}
      />
    </div>
  );
}
