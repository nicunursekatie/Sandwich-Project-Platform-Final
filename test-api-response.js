// Test script to check API response structure after our changes
const testAuditLogTransformation = () => {
  // Simulate the audit log data we saw in the database
  const rawLog = {
    id: 508,
    action: 'EVENT_REQUEST_UPDATED',
    recordId: '577',
    userId: 'user_1756855307041_by1nnrlif',
    newData: JSON.stringify({
      id: 577,
      organizationName: "Marist School",
      firstName: "Mary",
      lastName: "Ujda",
      assignedVolunteerIds: ["custom-1758599094227-Madeline-Hill", "user_1756855307041_by1nnrlif"],
      actionContext: {
        organizationName: "Marist School",
        contactName: "Mary Ujda",
        fieldsUpdated: ["assignedVolunteerIds", "volunteerDetails", "volunteerAssignments"]
      },
      performedBy: "ross.kimberly.a@gmail.com"
    }),
    oldData: JSON.stringify({
      id: 577,
      organizationName: "Marist School",
      firstName: "Mary",
      lastName: "Ujda",
      assignedVolunteerIds: ["custom-1758599094227-Madeline-Hill"]
    })
  };

  // Simulate our new API transformation logic
  const recordId = String(rawLog.recordId);
  const userId = String(rawLog.userId);

  let newData = null;
  let oldData = null;
  try {
    newData = JSON.parse(rawLog.newData);
    oldData = JSON.parse(rawLog.oldData);
  } catch {}

  // Extract follow-up context and audit metadata from newData or oldData
  let followUpMethod = null;
  let followUpAction = null;
  let notes = null;
  let actionDescription = '';
  let changeDescription = '';
  let statusChange = null;

  // Try to extract follow-up context from newData first, then oldData
  const dataWithContext = newData || oldData;
  if (dataWithContext) {
    // Extract follow-up context fields
    followUpMethod = dataWithContext.followUpMethod || dataWithContext._auditMetadata?.followUpMethod || null;
    followUpAction = dataWithContext.followUpAction || dataWithContext._auditMetadata?.followUpAction || null;
    notes = dataWithContext.notes || dataWithContext._auditMetadata?.notes || null;
    
    // Extract action descriptions
    actionDescription = dataWithContext._auditMetadata?.actionDescription || 
                       dataWithContext.actionDescription || 
                       rawLog.action || '';
    
    changeDescription = dataWithContext._auditMetadata?.changeDescription || 
                       dataWithContext.changeDescription || '';
    
    // Extract status change information
    statusChange = dataWithContext._auditMetadata?.statusChange || 
                  dataWithContext.statusChange || null;

    // If we have both old and new data, try to determine status change
    if (newData && oldData && newData.status !== oldData.status) {
      statusChange = `${oldData.status || 'unknown'} → ${newData.status || 'unknown'}`;
    }
  }

  const transformedResponse = {
    id: rawLog.id,
    action: rawLog.action,
    eventId: recordId,
    userId,
    organizationName: newData?.organizationName || oldData?.organizationName || 'Unknown',
    contactName: `${newData?.firstName || oldData?.firstName} ${newData?.lastName || oldData?.lastName}`,
    // CRITICAL: Expose oldData/newData at top level
    oldData,
    newData,
    // CRITICAL: Expose follow-up context fields
    followUpMethod,
    followUpAction,
    notes,
    actionDescription,
    changeDescription,
    statusChange,
    // Keep details for backward compatibility
    details: { oldData, newData },
  };

  console.log('=== API TRANSFORMATION TEST ===');
  console.log('Original Raw Log:');
  console.log(JSON.stringify(rawLog, null, 2));
  console.log('\n=== TRANSFORMED RESPONSE ===');
  console.log(JSON.stringify(transformedResponse, null, 2));
  
  // Test what frontend would see
  console.log('\n=== FRONTEND ACCESS TEST ===');
  console.log('Can access newData directly:', !!transformedResponse.newData);
  console.log('Can access oldData directly:', !!transformedResponse.oldData);
  console.log('ActionContext available:', !!transformedResponse.newData?.actionContext);
  console.log('FieldsUpdated available:', !!transformedResponse.newData?.actionContext?.fieldsUpdated);
  console.log('Action description:', transformedResponse.actionDescription);
  
  return transformedResponse;
};

testAuditLogTransformation();