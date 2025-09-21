import { useQuery } from '@tanstack/react-query';

export const useEventQueries = () => {
  // Fetch users for resolving user IDs to names
  const { data: users = [] } = useQuery<any[]>({
    queryKey: ['/api/users'],
  });

  // Fetch users specifically for assignments
  const { data: usersForAssignments = [] } = useQuery<any[]>({
    queryKey: ['/api/users/for-assignments'],
  });

  // Fetch drivers, hosts, and volunteers for assignment modal
  const { data: drivers = [] } = useQuery<any[]>({
    queryKey: ['/api/drivers'],
  });

  const { data: hosts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts'],
  });

  const { data: hostsWithContacts = [] } = useQuery<any[]>({
    queryKey: ['/api/hosts-with-contacts'],
  });

  const { data: volunteers = [] } = useQuery<any[]>({
    queryKey: ['/api/volunteers'],
  });

  // Fetch recipients for sandwich destination dropdown
  const { data: recipients = [] } = useQuery<any[]>({
    queryKey: ['/api/recipients'],
  });

  return {
    users,
    usersForAssignments,
    drivers,
    hosts,
    hostsWithContacts,
    volunteers,
    recipients,
  };
};