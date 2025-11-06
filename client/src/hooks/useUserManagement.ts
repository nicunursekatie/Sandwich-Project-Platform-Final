import { useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

export function useUserManagement() {
  const { toast } = useToast();

  const updateUserMutation = useMutation({
    mutationFn: async ({
      userId,
      role,
      permissions,
    }: {
      userId: string;
      role: string;
      permissions: string[];
    }) => {
      return apiRequest('PATCH', `/api/users/${userId}`, { role, permissions });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User Updated',
        description: 'User permissions have been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user permissions.',
        variant: 'destructive',
      });
    },
  });

  const toggleUserStatusMutation = useMutation({
    mutationFn: async ({
      userId,
      isActive,
    }: {
      userId: string;
      isActive: boolean;
    }) => {
      return apiRequest('PATCH', `/api/users/${userId}/status`, { isActive });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User Status Updated',
        description: 'User status has been successfully changed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user status.',
        variant: 'destructive',
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest('DELETE', `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User Deleted',
        description: 'User has been successfully removed.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Delete Failed',
        description: error.message || 'Failed to delete user.',
        variant: 'destructive',
      });
    },
  });

  const addUserMutation = useMutation({
    mutationFn: async (userData: {
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    }) => {
      return apiRequest('POST', '/api/users', userData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User Added',
        description: 'New user has been successfully added.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Add User Failed',
        description: error.message || 'Failed to add user.',
        variant: 'destructive',
      });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: async (data: {
      userId: string;
      email: string;
      firstName: string;
      lastName: string;
      phoneNumber?: string;
      preferredEmail?: string;
      role: string;
      isActive: boolean;
    }) => {
      return apiRequest('PATCH', `/api/users/${data.userId}/profile`, {
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        phoneNumber: data.phoneNumber,
        preferredEmail: data.preferredEmail,
        role: data.role,
        isActive: data.isActive,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'User Updated',
        description: 'User details have been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Update Failed',
        description: error.message || 'Failed to update user details.',
        variant: 'destructive',
      });
    },
  });

  const setPasswordMutation = useMutation({
    mutationFn: async ({
      userId,
      password,
    }: {
      userId: string;
      password: string;
    }) => {
      return apiRequest('PATCH', `/api/users/${userId}/password`, { password });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'Password Set',
        description: 'User password has been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Password Update Failed',
        description: error.message || 'Failed to update user password.',
        variant: 'destructive',
      });
    },
  });

  const updateSMSConsentMutation = useMutation({
    mutationFn: async ({
      userId,
      phoneNumber,
      enabled,
    }: {
      userId: string;
      phoneNumber?: string;
      enabled: boolean;
    }) => {
      const currentUsers = queryClient.getQueryData(['/api/users']) as any[];
      const currentUser = currentUsers?.find((u: any) => u.id === userId);

      if (!currentUser) {
        throw new Error('User not found');
      }

      const existingMetadata = currentUser.metadata || {};

      let smsConsent;
      if (enabled && phoneNumber) {
        smsConsent = {
          enabled: true,
          phoneNumber: phoneNumber.startsWith('+1')
            ? phoneNumber
            : `+1${phoneNumber.replace(/\D/g, '')}`,
          displayPhone: phoneNumber,
          optInDate: new Date().toISOString(),
          consent: true,
        };
      } else {
        smsConsent = {
          enabled: false,
          phoneNumber: null,
          displayPhone: null,
          optOutDate: new Date().toISOString(),
          consent: false,
        };
      }

      const updatedMetadata = {
        ...existingMetadata,
        smsConsent,
      };

      return apiRequest('PATCH', `/api/users/${userId}`, {
        role: currentUser.role,
        permissions: currentUser.permissions,
        metadata: updatedMetadata,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      toast({
        title: 'SMS Preferences Updated',
        description: 'User SMS preferences have been successfully updated.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'SMS Update Failed',
        description: error.message || 'Failed to update SMS preferences.',
        variant: 'destructive',
      });
    },
  });

  return {
    updateUserMutation,
    toggleUserStatusMutation,
    deleteUserMutation,
    addUserMutation,
    editUserMutation,
    setPasswordMutation,
    updateSMSConsentMutation,
  };
}
