const request = require('supertest');
const express = require('express');
const { initDB, getDB } = require('../config/database');
const { generateToken } = require('../utils/auth');

const authRoutes = require('../routes/authRoutes');
const contentRoutes = require('../routes/contentRoutes');
const supportRoutes = require('../routes/supportRoutes');
const contactRoutes = require('../routes/contactRoutes');
const teacherRoutes = require('../routes/teacherRoutes');
const studentRoutes = require('../routes/studentRoutes');
const schoolRoutes = require('../routes/schoolRoutes');
const kbRoutes = require('../routes/knowledgeBaseRoutes');

const app = express();
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/support', supportRoutes);
app.use('/api/contact', contactRoutes);
app.use('/api/teachers', teacherRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/kb', kbRoutes);

describe('Global Roles Hardening & RBAC Tests', () => {
    let superAdminToken, supportOfficerToken, contentManagerToken, schoolAdminToken;

    beforeAll(async () => {
        await initDB();
        const db = getDB();
        const ts = Date.now();

        // Create test users for global roles
        const saRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role) VALUES ('Super Admin', $1, 'hash', 'SuperAdmin') RETURNING id`,
            [`sa_test_${ts}@eduman.com`]
        );
        const soRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role) VALUES ('Support Officer', $1, 'hash', 'SupportOfficer') RETURNING id`,
            [`so_test_${ts}@eduman.com`]
        );
        const cmRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role) VALUES ('Content Manager', $1, 'hash', 'ContentManager') RETURNING id`,
            [`cm_test_${ts}@eduman.com`]
        );
        const adminRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role) VALUES ('School Admin', $1, 'hash', 'SchoolAdmin') RETURNING id`,
            [`admin_test_${ts}@eduman.com`]
        );

        superAdminToken = generateToken({ id: saRes.lastID || 1, name: 'Super Admin', email: `sa_test_${ts}@eduman.com`, role: 'SuperAdmin' });
        supportOfficerToken = generateToken({ id: soRes.lastID || 2, name: 'Support Officer', email: `so_test_${ts}@eduman.com`, role: 'SupportOfficer' });
        contentManagerToken = generateToken({ id: cmRes.lastID || 3, name: 'Content Manager', email: `cm_test_${ts}@eduman.com`, role: 'ContentManager' });
        schoolAdminToken = generateToken({ id: adminRes.lastID || 4, name: 'School Admin', email: `admin_test_${ts}@eduman.com`, role: 'SchoolAdmin' }, 1);
    }, 30000);

    describe('ContentManager RBAC Isolation', () => {
        test('ContentManager can access global content analytics', async () => {
            const res = await request(app)
                .get('/api/content/analytics')
                .set('Authorization', `Bearer ${contentManagerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('total_global_resources');
        });

        test('ContentManager is forbidden from accessing teachers list', async () => {
            const res = await request(app)
                .get('/api/teachers')
                .set('Authorization', `Bearer ${contentManagerToken}`);
            expect(res.statusCode).toBe(403);
        });

        test('ContentManager is forbidden from creating schools', async () => {
            const res = await request(app)
                .post('/api/schools')
                .set('Authorization', `Bearer ${contentManagerToken}`)
                .send({ name: 'Unauthorized School', admin_name: 'Test', admin_email: 'test@school.com', admin_password: 'pass' });
            expect(res.statusCode).toBe(403);
        });
    });

    describe('SupportOfficer RBAC Isolation', () => {
        test('SupportOfficer can access support analytics', async () => {
            const res = await request(app)
                .get('/api/support/analytics')
                .set('Authorization', `Bearer ${supportOfficerToken}`);
            expect(res.statusCode).toBe(200);
        });

        test('SupportOfficer can access contact inquiries list', async () => {
            const res = await request(app)
                .get('/api/contact/inquiries')
                .set('Authorization', `Bearer ${supportOfficerToken}`);
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('inquiries');
        });

        test('SupportOfficer is forbidden from viewing all schools list', async () => {
            const res = await request(app)
                .get('/api/schools/all')
                .set('Authorization', `Bearer ${supportOfficerToken}`);
            expect(res.statusCode).toBe(403);
        });

        test('SupportOfficer is forbidden from creating teachers', async () => {
            const res = await request(app)
                .post('/api/teachers')
                .set('Authorization', `Bearer ${supportOfficerToken}`)
                .send({ first_name: 'Test', last_name: 'Teacher', email: 'tt@school.com', gender: 'Male', phone: '123', password: 'pass', school_id: 1 });
            expect(res.statusCode).toBe(403);
        });
    });

    describe('Contact Inquiries & Ticket Conversion', () => {
        let inquiryId;

        test('Public user can submit contact form', async () => {
            const res = await request(app)
                .post('/api/contact')
                .send({
                    name: 'Jane Doe',
                    email: 'jane@example.com',
                    subject: 'Demonstration Request',
                    message: 'I would like a demo of EduMan for my school.'
                });
            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('inquiry_number');
        });

        test('SupportOfficer can list contact inquiries and view details', async () => {
            const listRes = await request(app)
                .get('/api/contact/inquiries')
                .set('Authorization', `Bearer ${supportOfficerToken}`);
            expect(listRes.statusCode).toBe(200);
            expect(listRes.body.inquiries.length).toBeGreaterThan(0);

            inquiryId = listRes.body.inquiries[0].id;

            const detailRes = await request(app)
                .get(`/api/contact/inquiries/${inquiryId}`)
                .set('Authorization', `Bearer ${supportOfficerToken}`);
            expect(detailRes.statusCode).toBe(200);
            expect(detailRes.body).toHaveProperty('inquiry');
            expect(detailRes.body).toHaveProperty('messages');
        });

        test('SupportOfficer can convert contact inquiry to support ticket', async () => {
            const res = await request(app)
                .post(`/api/contact/inquiries/${inquiryId}/convert`)
                .set('Authorization', `Bearer ${supportOfficerToken}`)
                .send({ category: 'General', priority: 'MEDIUM' });

            expect(res.statusCode).toBe(200);
            expect(res.body).toHaveProperty('ticket_number');
            expect(res.body.ticket_number).toMatch(/^SUP-2026-/);
        });
    });
});
