// Quick test script for Christine's permissions
const request = require('supertest');

const API_BASE = 'http://localhost:5000';

async function testChristinePermissions() {
  console.log('🔍 Testing Christine\'s meeting discussion permissions...');
  
  try {
    // Login as Christine
    const loginResponse = await request(API_BASE)
      .post('/api/auth/login')
      .send({
        email: 'christine@thesandwichproject.org',
        password: 'password123'
      });
    
    if (loginResponse.status !== 200) {
      console.log('❌ Login failed:', loginResponse.status);
      return;
    }
    
    const cookies = loginResponse.headers['set-cookie'].join('; ');
    console.log('✅ Christine logged in successfully');
    
    // Test updating meeting discussion points (what she's trying to do)
    const discussionResponse = await request(API_BASE)
      .patch('/api/projects/49')
      .set('Cookie', cookies)
      .send({ meetingDiscussionPoints: 'Christine will test this functionality' });
    
    console.log('📝 Discussion Points Update Result:');
    console.log('   Status:', discussionResponse.status);
    console.log('   Response:', discussionResponse.body);
    
    if (discussionResponse.status === 200) {
      console.log('✅ Christine CAN update meeting discussion points!');
    } else {
      console.log('❌ Christine CANNOT update meeting discussion points');
      console.log('   Error:', discussionResponse.body);
    }
    
    // Test send to agenda (should work)
    const agendaResponse = await request(API_BASE)
      .patch('/api/projects/49')
      .set('Cookie', cookies)
      .send({ reviewInNextMeeting: true });
    
    console.log('\n📋 Send to Agenda Result:');
    console.log('   Status:', agendaResponse.status);
    console.log('   Response:', agendaResponse.body);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testChristinePermissions();