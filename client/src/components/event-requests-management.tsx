The error starts when:

You press a key in your event requests management component (onKeyDown event)
This triggers handleAssignmentUpdate
Which calls a mutation that makes an API request
The API request fails at line 22 of queryClient.ts