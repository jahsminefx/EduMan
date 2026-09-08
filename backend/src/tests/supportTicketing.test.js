const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

let adminToken = '';
let teacherToken = '';
let createdTicketId = null;
let createdTicketNumber = null;

beforeAll(async () => {
  await initDB();

  // Log in as School Admin
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'adebayo@greenfield.edu.ng',
      password: 'password123'
    });
  adminToken = adminLogin.body.token;

  // Log in as Teacher
  const teacherLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'chidi@greenfield.edu.ng',
      password: 'password123'
    });
  teacherToken = teacherLogin.body.token;
  expect(adminToken).toBeTruthy();
  expect(teacherToken).toBeTruthy();
});

afterAll(async () => {
  await closeDB();
});

describe('Support Ticketing System Tests', () => {
  it('should create a support ticket successfully', async () => {
    const res = await request(app)
      .post('/api/support/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        subject: 'Cannot upload term results PDF',
        category: 'Results',
        priority: 'HIGH',
        message: 'I received a timeout error when attempting to bulk export term 2 report cards.'
      });

    expect(res.statusCode).toBe(201);
    expect(res.body).toHaveProperty('thread');
    expect(res.body.thread).toHaveProperty('id');
    expect(res.body.thread).toHaveProperty('ticketNumber');

    createdTicketId = res.body.thread.id;
    createdTicketNumber = res.body.thread.ticketNumber;
    expect(createdTicketNumber).toMatch(/^SUP-\d{4}-\d{6}$/);
  });

  it('should fetch ticket details by numeric ID', async () => {
    const res = await request(app)
      .get(`/api/support/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('thread');
    expect(res.body.thread.id).toBe(createdTicketId);
    expect(res.body.thread.ticket_number).toBe(createdTicketNumber);
    expect(Array.isArray(res.body.messages)).toBe(true);
    expect(res.body.messages.length).toBeGreaterThanOrEqual(1);
  });

  it('should fetch ticket details by ticket number string without integer syntax error', async () => {
    const res = await request(app)
      .get(`/api/support/tickets/${createdTicketNumber}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('thread');
    expect(res.body.thread.ticket_number).toBe(createdTicketNumber);
    expect(res.body.thread.id).toBe(createdTicketId);
  });

  it('should allow posting a reply to the ticket', async () => {
    const res = await request(app)
      .post(`/api/support/tickets/${createdTicketId}/messages`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        message: 'Update: issue resolved after clearing cache.'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('reply');
    expect(res.body.reply.message).toBe('Update: issue resolved after clearing cache.');
  });

  it('should allow updating ticket status', async () => {
    const res = await request(app)
      .put(`/api/support/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'RESOLVED'
      });

    expect(res.statusCode).toBe(200);
    expect(res.body).toHaveProperty('thread');
    expect(res.body.thread.status).toBe('RESOLVED');
  });

  it('should enforce tenant isolation for non-creators', async () => {
    const res = await request(app)
      .get(`/api/support/tickets/${createdTicketId}`)
      .set('Authorization', `Bearer ${teacherToken}`);

    // Teacher johnson did not create this ticket and is not SchoolAdmin
    expect(res.statusCode).toBe(403);
  });
});
