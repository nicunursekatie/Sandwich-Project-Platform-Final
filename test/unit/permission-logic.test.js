const request = require('supertest');

const API_BASE = 'http://localhost:5000';

describe('Permission Logic Unit Tests', () => {
  let adminCookie, christineCookie, volunteerCookie;

  beforeAll(async () => {
    adminCookie = await global.loginUser('admin@sandwich.project', 'password123');
    christineCookie = await global.loginUser('christine@thesandwichproject.org', 'password123');
    volunteerCookie = await global.loginUser('juliet@thesandwichproject.org', 'password123');
  });

  describe('Send to Agenda Permission Logic', () => {
    test('Christine (core_team) can send projects to agenda', async () => {
      const response = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', christineCookie)
        .send({ reviewInNextMeeting: true });
      
      expect(response.status).toBe(200);
      expect(response.body.reviewInNextMeeting).toBe(true);
    });

    test('Volunteer cannot send projects to agenda', async () => {
      const response = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', volunteerCookie)
        .send({ reviewInNextMeeting: true });
      
      expect(response.status).toBe(403);
      expect(response.body.message).toContain('meeting management permissions');
    });

    test('Send to Agenda is treated differently from regular project edits', async () => {
      // First, test agenda update (should work for Christine)
      const agendaResponse = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', christineCookie)
        .send({ reviewInNextMeeting: true });
      
      expect(agendaResponse.status).toBe(200);

      // Test that only reviewInNextMeeting is treated as agenda action
      const multiUpdateResponse = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', christineCookie)
        .send({ 
          reviewInNextMeeting: false, 
          title: 'Updated Title' 
        });
      
      // This should use regular project edit permissions (not agenda permissions)
      expect(multiUpdateResponse.status).toBe(200);
    });
  });

  describe('Permission Separation Verification', () => {
    test('Agenda-only update uses MEETINGS_MANAGE permission', async () => {
      // This should succeed because it only changes reviewInNextMeeting
      const response = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', christineCookie)
        .send({ reviewInNextMeeting: true });
      
      expect(response.status).toBe(200);
    });

    test('Mixed updates use regular project permissions', async () => {
      // This should also succeed because Christine has MANAGE_ALL_PROJECTS
      const response = await request(API_BASE)
        .patch('/api/projects/49')
        .set('Cookie', christineCookie)
        .send({ 
          reviewInNextMeeting: false,
          description: 'Updated description'
        });
      
      expect(response.status).toBe(200);
    });
  });
});