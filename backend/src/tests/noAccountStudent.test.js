const request = require('supertest');
const app = require('../app');
const { initDB, closeDB } = require('../config/database');

let adminToken = '';
let teacherToken = '';
let schoolId = null;
let classId = null;
let rosterStudentId = null;
let rosterStudentAdm = '';

beforeAll(async () => {
  await initDB();
  
  // Log in as School Admin (Adebayo at Greenfield Academy)
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'adebayo@greenfield.edu.ng',
      password: 'password123'
    });
  adminToken = adminLogin.body.token;
  schoolId = adminLogin.body.user.school_id;

  // Log in as Teacher (Chidi at Greenfield Academy)
  const teacherLogin = await request(app)
    .post('/api/auth/login')
    .send({
      email: 'chidi@greenfield.edu.ng',
      password: 'password123'
    });
  teacherToken = teacherLogin.body.token;

  // Get a class ID
  const classRes = await request(app)
    .get('/api/classes/classes')
    .set('Authorization', `Bearer ${adminToken}`);
  if (classRes.body.classes && classRes.body.classes.length > 0) {
    classId = classRes.body.classes[0].id;
  }
});

afterAll(async () => {
  await closeDB();
});

describe('No-Phone / Roster-Only Student Infrastructure API', () => {
  it('should allow SchoolAdmin to create a student without an email/user_id', async () => {
    rosterStudentAdm = `GF-NOACC-${Date.now().toString().slice(-4)}`;
    const res = await request(app)
      .post('/api/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        admission_number: rosterStudentAdm,
        first_name: 'Tunde',
        last_name: 'NoPhoneStudent',
        gender: 'Male',
        class_id: classId,
        parent_name: 'Mr Bakare',
        parent_phone: '08099998888'
        // email is intentionally omitted
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body.id).toBeTruthy();
    expect(res.body.user_id).toBeNull();
    rosterStudentId = res.body.id;
  });

  it('should include roster-only students in class directory queries', async () => {
    const res = await request(app)
      .get('/api/students')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.statusCode).toEqual(200);
    const found = res.body.students.find(s => s.id === rosterStudentId);
    expect(found).toBeTruthy();
    expect(found.user_id).toBeNull();
  });

  it('should allow recording attendance for roster-only student', async () => {
    const today = new Date().toISOString().split('T')[0];
    const res = await request(app)
      .post('/api/attendance')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        class_id: classId,
        date: today,
        records: [
          { student_id: rosterStudentId, status: 'Present' }
        ]
      });

    expect(res.statusCode).toEqual(200);
  });

  it('should allow Parent self-registration auto-linking to roster-only student by Admission Number', async () => {
    // 1. Create Parent invite link
    const linkRes = await request(app)
      .post('/api/invite-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'Parent', max_uses: 5 });

    const inviteCode = linkRes.body.inviteLink.display_code;

    // 2. Register parent using rosterStudentAdm
    const parentEmail = `nophone.parent.${Date.now()}@test.local`;
    const regRes = await request(app)
      .post('/api/invite-links/register')
      .send({
        code: inviteCode,
        first_name: 'ParentOf',
        last_name: 'NoPhone',
        email: parentEmail,
        password: 'password123',
        student_admission_number: rosterStudentAdm
      });

    expect(regRes.statusCode).toEqual(201);
    expect(regRes.body.user.role).toEqual('Parent');

    // 3. Verify parent can fetch child profile
    const parentToken = regRes.body.token;
    const childrenRes = await request(app)
      .get('/api/parent/children')
      .set('Authorization', `Bearer ${parentToken}`);

    expect(childrenRes.statusCode).toEqual(200);
    expect(childrenRes.body.children.length).toBeGreaterThan(0);
    const child = childrenRes.body.children.find(c => c.admission_number === rosterStudentAdm);
    expect(child).toBeTruthy();
    expect(child.first_name).toEqual('Tunde');
  });
});
