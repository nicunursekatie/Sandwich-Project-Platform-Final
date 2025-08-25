// Test script to check Google authentication
import { GoogleAuth } from 'google-auth-library';

async function testGoogleAuth() {
  try {
    console.log('🔑 Testing Google Sheets authentication...');
    
    const clientEmail = process.env.GOOGLE_CLIENT_EMAIL;
    const privateKey = process.env.GOOGLE_PRIVATE_KEY;
    const projectId = process.env.GOOGLE_PROJECT_ID;
    
    console.log('✅ Client email:', clientEmail ? 'Found' : 'Missing');
    console.log('✅ Private key:', privateKey ? 'Found' : 'Missing');
    console.log('✅ Project ID:', projectId ? 'Found' : 'Missing');
    
    if (!clientEmail || !privateKey || !projectId) {
      console.log('❌ Missing required environment variables');
      return;
    }
    
    // Try to parse the private key
    console.log('🔍 Private key format test...');
    console.log('Key starts with:', privateKey.substring(0, 30));
    console.log('Key includes newlines:', privateKey.includes('\\n'));
    
    // Convert \\n to actual newlines
    const formattedKey = privateKey.replace(/\\n/g, '\n');
    console.log('🔧 After formatting - starts with:', formattedKey.substring(0, 30));
    
    const auth = new GoogleAuth({
      credentials: {
        client_email: clientEmail,
        private_key: formattedKey,
        project_id: projectId
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    });
    
    console.log('⏳ Attempting to get access token...');
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    console.log('✅ Successfully authenticated!');
    console.log('✅ Access token obtained:', token.token ? 'Yes' : 'No');
    
  } catch (error) {
    console.log('❌ Authentication failed:', error.message);
    if (error.message.includes('DECODER')) {
      console.log('💡 This is a private key format issue');
      console.log('💡 Try using the private key exactly as it appears in your JSON file');
    }
  }
}

testGoogleAuth();