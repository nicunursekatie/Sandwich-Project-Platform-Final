import { Router } from "express";
import { storage } from "../storage-wrapper";

interface GroupsCatalogDependencies {
  isAuthenticated: any;
}

export function createGroupsCatalogRoutes(deps: GroupsCatalogDependencies) {
  const router = Router();

  // Groups Catalog: Complete directory of all organizations (current requests + historical hosts)
  router.get("/", deps.isAuthenticated, async (req, res) => {
    try {
      const user = req.user;
      
      // Get all event requests and aggregate by organization + department
      const allEventRequests = await storage.getAllEventRequests();
      
      // Get all historical host organizations from sandwich collections
      const allCollections = await storage.getAllSandwichCollections();
      
      // Create a map to aggregate data by organization and department
      const departmentsMap = new Map();
      
      allEventRequests.forEach(request => {
        const orgName = request.organizationName;
        const department = request.department || '';
        const contactName = request.firstName && request.lastName 
          ? `${request.firstName} ${request.lastName}`.trim()
          : request.firstName || request.lastName || '';
        const contactEmail = request.email;
        
        if (!orgName || !contactName) return;
        
        // Create a unique key for organization + department combination
        const departmentKey = `${orgName}|${department}`;
        
        // Track department-level aggregation
        if (!departmentsMap.has(departmentKey)) {
          departmentsMap.set(departmentKey, {
            organizationName: orgName,
            department: department,
            contacts: [],
            totalRequests: 0,
            latestStatus: 'new',
            latestRequestDate: request.createdAt || new Date(),
            hasHostedEvent: false,
            totalSandwiches: 0,
            eventDate: null
          });
        }
        
        const dept = departmentsMap.get(departmentKey);
        dept.totalRequests += 1;
        
        // Add contact if not already present
        const existingContact = dept.contacts.find(c => 
          c.name === contactName && c.email === contactEmail
        );
        
        if (!existingContact) {
          dept.contacts.push({
            name: contactName,
            email: contactEmail,
            phone: request.phone
          });
        }
        
        // Update department status based on most recent request
        const requestDate = new Date(request.createdAt || new Date());
        if (requestDate >= dept.latestRequestDate) {
          dept.latestRequestDate = requestDate;
          
          // Determine status: check if scheduled (future event) or completed/past
          if (request.status === 'completed' || request.status === 'contact_completed') {
            dept.latestStatus = request.status;
            dept.hasHostedEvent = true;
            // Add sandwich count for completed events
            if (request.estimatedSandwichCount) {
              dept.totalSandwiches += request.estimatedSandwichCount;
            }
          } else if (request.status === 'scheduled') {
            // Check if the scheduled event is in the future or past
            const eventDate = request.desiredEventDate ? new Date(request.desiredEventDate) : null;
            const now = new Date();
            if (eventDate && eventDate > now) {
              dept.latestStatus = 'scheduled'; // Upcoming event
              dept.eventDate = request.desiredEventDate;
            } else if (eventDate && eventDate <= now) {
              dept.latestStatus = 'past'; // Past scheduled event
              dept.hasHostedEvent = true;
              dept.eventDate = request.desiredEventDate;
            } else {
              dept.latestStatus = 'scheduled'; // Scheduled but no date specified
            }
          } else {
            dept.latestStatus = request.status || 'new';
          }
          
          // Update event date from most recent request
          if (request.desiredEventDate) {
            dept.eventDate = request.desiredEventDate;
          }
        }
      });
      
      // Add historical host organizations from sandwich collections
      const historicalGroups = new Set();
      allCollections.forEach(collection => {
        // Add group1_name if it exists and looks like an organization
        if (collection.group1Name && 
            collection.group1Name !== 'Group' && 
            collection.group1Name !== 'Groups' && 
            collection.group1Name !== 'Unnamed Groups' &&
            collection.group1Name.trim()) {
          historicalGroups.add(collection.group1Name.trim());
        }
        
        // Add group2_name if it exists and looks like an organization
        if (collection.group2Name && 
            collection.group2Name !== 'Group' && 
            collection.group2Name !== 'Groups' && 
            collection.group2Name !== 'Unnamed Groups' &&
            collection.group2Name.trim()) {
          historicalGroups.add(collection.group2Name.trim());
        }
      });
      
      // Add historical groups to departments map if not already present
      historicalGroups.forEach(groupName => {
        const departmentKey = `${groupName}|`; // Empty department for historical entries
        
        if (!departmentsMap.has(departmentKey)) {
          departmentsMap.set(departmentKey, {
            organizationName: groupName,
            department: '',
            contacts: [],
            totalRequests: 0,
            latestStatus: 'past',
            latestRequestDate: new Date('2020-01-01'), // Historical placeholder
            hasHostedEvent: true,
            totalSandwiches: 0,
            eventDate: null
          });
        } else {
          // Update existing entry to show it has hosted events
          const dept = departmentsMap.get(departmentKey);
          dept.hasHostedEvent = true;
        }
      });
      
      // Convert Map to array and group by organization
      const organizationsMap = new Map();
      
      departmentsMap.forEach((dept) => {
        const orgName = dept.organizationName;
        
        if (!organizationsMap.has(orgName)) {
          organizationsMap.set(orgName, {
            name: orgName,
            departments: []
          });
        }
        
        const org = organizationsMap.get(orgName);
        org.departments.push({
          organizationName: orgName,
          department: dept.department,
          contactName: dept.contacts[0]?.name || 'Historical Organization',
          email: dept.contacts[0]?.email || '',
          phone: dept.contacts[0]?.phone || '',
          allContacts: dept.contacts,
          status: dept.latestStatus,
          totalRequests: dept.totalRequests,
          hasHostedEvent: dept.hasHostedEvent,
          totalSandwiches: dept.totalSandwiches,
          eventDate: dept.eventDate,
          latestRequestDate: dept.latestRequestDate
        });
      });
      
      // Convert to final format and sort
      const organizations = Array.from(organizationsMap.entries()).map(([_, org]) => ({
        name: org.name,
        departments: org.departments.sort((a, b) => 
          new Date(b.latestRequestDate).getTime() - new Date(a.latestRequestDate).getTime()
        )
      }));
      
      // Sort organizations by most recent activity across all departments
      organizations.sort((a, b) => {
        const aLatest = Math.max(...a.departments.map(d => new Date(d.latestRequestDate).getTime()));
        const bLatest = Math.max(...b.departments.map(d => new Date(d.latestRequestDate).getTime()));
        return bLatest - aLatest;
      });
      
      res.json({ groups: organizations });
      
    } catch (error) {
      console.error("Error fetching organizations catalog:", error);
      res.status(500).json({ message: "Failed to fetch organizations catalog" });
    }
  });

  return router;
}

export default createGroupsCatalogRoutes;