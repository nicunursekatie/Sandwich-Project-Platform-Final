const request = require('supertest');

const API_BASE = 'http://localhost:5000';

describe('Meeting Management Integration Tests', () => {
  let adminCookie, christineCookie, volunteerCookie;
  let testProjectId;

  beforeAll(async () => {
    // Login test users using the real users from the system
    const adminLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({ email: 'admin@sandwich.project', password: 'password123' });
    expect(adminLogin.status).toBe(200);
    adminCookie = adminLogin.headers['set-cookie'][0];

    const christineLogin = await request(API_BASE)
      .post('/api/auth/login') 
      .send({ email: 'christine@thesandwichproject.org', password: 'password123' });
    expect(christineLogin.status).toBe(200);
    christineCookie = christineLogin.headers['set-cookie'][0];

    const volunteerLogin = await request(API_BASE)
      .post('/api/auth/login')
      .send({ email: 'juliet@thesandwichproject.org', password: 'password123' });
    expect(volunteerLogin.status).toBe(200);
    volunteerCookie = volunteerLogin.headers['set-cookie'][0];
  });

  test('Admin can complete full meeting workflow', async () => {
    // 1. Create a test project
    const projectResponse = await request(API_BASE)
      .post('/api/projects')
      .set('Cookie', adminCookie)
      .send({
        title: 'Integration Test Project',
        description: 'Test project for permission testing',
        status: 'planning'
      });
    
    expect(projectResponse.status).toBe(201);
    testProjectId = projectResponse.body.id;

    // 2. Send to agenda
    const agendaResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', adminCookie)
      .send({ reviewInNextMeeting: true });
    
    expect(agendaResponse.status).toBe(200);
    expect(agendaResponse.body.reviewInNextMeeting).toBe(true);

    // 3. View projects for review
    const reviewResponse = await request(API_BASE)
      .get('/api/projects/for-review')
      .set('Cookie', adminCookie);
    
    expect(reviewResponse.status).toBe(200);
    expect(reviewResponse.body.some(p => p.id === testProjectId)).toBe(true);

    // 4. Remove from agenda
    const removeResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', adminCookie)
      .send({ reviewInNextMeeting: false });
    
    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.reviewInNextMeeting).toBe(false);
  });

  test('Christine can use Send to Agenda with MEETINGS_MANAGE permission', async () => {
    // Christine should be able to send projects to agenda
    const agendaResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', christineCookie)
      .send({ reviewInNextMeeting: true });
    
    expect(agendaResponse.status).toBe(200);
    expect(agendaResponse.body.reviewInNextMeeting).toBe(true);

    // And remove from agenda
    const removeResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', christineCookie)
      .send({ reviewInNextMeeting: false });
    
    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.reviewInNextMeeting).toBe(false);
  });

  test('Volunteer user cannot send projects to agenda without permission', async () => {
    // Volunteer user should not be able to send to agenda (lacks MEETINGS_MANAGE)
    const agendaResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', volunteerCookie)
      .send({ reviewInNextMeeting: true });
    
    expect(agendaResponse.status).toBe(403);
    expect(agendaResponse.body.message).toContain('meeting management permissions');
  });

  test('Permission separation: agenda vs edit permissions work correctly', async () => {
    // Test that Send to Agenda uses MEETINGS_MANAGE (Christine has this)
    const agendaResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', christineCookie)
      .send({ reviewInNextMeeting: true });
    
    expect(agendaResponse.status).toBe(200);

    // Test that project editing uses different permissions
    const editResponse = await request(API_BASE)
      .patch(`/api/projects/${testProjectId}`)
      .set('Cookie', christineCookie)
      .send({ title: 'Updated Title', description: 'Updated Description' });
    
    // Christine should also be able to edit since she has MANAGE_ALL_PROJECTS
    expect(editResponse.status).toBe(200);
  });

  afterAll(async () => {
    // Clean up test project
    if (testProjectId) {
      await request(API_BASE)
        .delete(`/api/projects/${testProjectId}`)
        .set('Cookie', adminCookie);
    }
  });
});