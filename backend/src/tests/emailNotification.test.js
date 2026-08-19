const request = require('supertest');
const app = require('../app');
const { 
    sendEmailNotification, 
    sendInvitationEmail, 
    sendWelcomeEmail, 
    getSentEmails, 
    clearSentEmails, 
    getLastSentEmail 
} = require('../services/notificationService');
const { initDB, getDB, closeDB } = require('../config/database');
const { hashToken } = require('../utils/tokenUtils');
const crypto = require('crypto');

describe('EduMan Invitation System Hardening & Security Audit Suite', () => {
    let db;
    let superAdminToken;
    let schoolAdminToken;

    beforeAll(async () => {
        await initDB();
        db = getDB();

        // 1. Create SuperAdmin user & token
        await db.run("DELETE FROM users WHERE email = 'inv_sa_test@eduman.local'");
        const saRes = await db.get(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ('Inv SA', 'inv_sa_test@eduman.local', '$2a$10$abcdefghijklmnopqrstuuu', 'SuperAdmin', 1) RETURNING id`
        );
        const { generateToken } = require('../utils/auth');
        superAdminToken = generateToken({ id: saRes.id, name: 'Inv SA', email: 'inv_sa_test@eduman.local', role: 'SuperAdmin' });

        // 2. Create SchoolAdmin user & token
        await db.run("DELETE FROM users WHERE email = 'inv_admin_test@eduman.local'");
        const adminRes = await db.get(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ('Inv Admin', 'inv_admin_test@eduman.local', '$2a$10$abcdefghijklmnopqrstuuu', 'SchoolAdmin', 1) RETURNING id`
        );
        schoolAdminToken = generateToken({ id: adminRes.id, name: 'Inv Admin', email: 'inv_admin_test@eduman.local', role: 'SchoolAdmin' }, 1);
    });

    beforeEach(() => {
        clearSentEmails();
    });

    test('1. Raw setup token is NEVER stored in the database', async () => {
        clearSentEmails();
        const email = `raw_token_test_${Date.now()}@eduman.local`;
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Raw Token Test', email, role: 'ContentManager' });

        expect(res.status).toBe(201);
        const sentEmail = getLastSentEmail();
        expect(sentEmail).not.toBeNull();

        const rawToken = sentEmail.token;
        expect(rawToken).toBeDefined();

        const dbUser = await db.get("SELECT setup_token FROM users WHERE email = $1", [email]);
        expect(dbUser.setup_token).not.toBe(rawToken); // Plaintext raw token NEVER in DB
        expect(dbUser.setup_token).toBe(hashToken(rawToken)); // SHA-256 hash stored at rest
    });

    test('2. Correct token verifies via /api/auth/verify-setup-token', async () => {
        clearSentEmails();
        const email = `correct_verify_${Date.now()}@eduman.local`;
        await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Verify Test', email, role: 'SupportOfficer' });

        const rawToken = getLastSentEmail().token;

        const verifyRes = await request(app).get(`/api/auth/verify-setup-token?token=${rawToken}`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.valid).toBe(true);
        expect(verifyRes.body.user.email).toBe(email);
        expect(verifyRes.body.user.role).toBe('SupportOfficer');
        // Ensure sensitive DB columns are omitted
        expect(verifyRes.body.user.setup_token).toBeUndefined();
        expect(verifyRes.body.user.password_hash).toBeUndefined();
    });

    test('3. Incorrect token fails verification with generic response', async () => {
        const verifyRes = await request(app).get('/api/auth/verify-setup-token?token=completely_bogus_token_12345');
        expect(verifyRes.status).toBe(400);
        expect(verifyRes.body.message).toBe('Invalid or expired invitation.');
    });

    test('4. Expired setup token fails verification and setup', async () => {
        clearSentEmails();
        const email = `expired_token_${Date.now()}@eduman.local`;
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = hashToken(rawToken);

        // Insert user with expired setup token (expires in the past)
        await db.run(
            `INSERT INTO users (name, email, password_hash, role, setup_token, setup_token_expires, is_active)
             VALUES ('Expired User', $1, '$2a$10$abcdef', 'SupportOfficer', $2, CURRENT_TIMESTAMP - INTERVAL '1 hour', 0)`,
            [email, tokenHash]
        );

        const verifyRes = await request(app).get(`/api/auth/verify-setup-token?token=${rawToken}`);
        expect(verifyRes.status).toBe(400);
        expect(verifyRes.body.message).toBe('Invalid or expired invitation.');

        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'NewSecurePass123!' });
        expect(setupRes.status).toBe(400);
        expect(setupRes.body.message).toBe('Invalid or expired invitation.');
    });

    test('5. Token works only once (single-use enforcement)', async () => {
        clearSentEmails();
        const email = `single_use_${Date.now()}@eduman.local`;
        await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Single Use User', email, role: 'ContentManager' });

        const rawToken = getLastSentEmail().token;

        // First password setup succeeds
        const setupRes1 = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'NewPass123456!' });
        expect(setupRes1.status).toBe(200);

        // Verify DB token cleared
        const user = await db.get("SELECT setup_token, setup_token_expires, is_active FROM users WHERE email = $1", [email]);
        expect(user.setup_token).toBeNull();
        expect(user.setup_token_expires).toBeNull();
        expect(user.is_active).toBe(1);

        // Second password setup attempt fails immediately
        const setupRes2 = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'NewPass123456!' });
        expect(setupRes2.status).toBe(400);
        expect(setupRes2.body.message).toBe('Invalid or expired invitation.');
    });

    test('6. Resending invitation invalidates old token', async () => {
        clearSentEmails();
        const email = `resend_inval_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Resend Inval User', email, role: 'SupportOfficer' });

        const oldRawToken = getLastSentEmail().token;
        const staffId = staffRes.body.staff.id;

        clearSentEmails();
        // Resend invitation
        const resendRes = await request(app)
            .post(`/api/superadmin/platform-staff/${staffId}/resend-invitation`)
            .set('Authorization', `Bearer ${superAdminToken}`);
        expect(resendRes.status).toBe(200);

        const newRawToken = getLastSentEmail().token;
        expect(newRawToken).not.toBe(oldRawToken);

        // Old token verification must fail
        const oldVerify = await request(app).get(`/api/auth/verify-setup-token?token=${oldRawToken}`);
        expect(oldVerify.status).toBe(400);

        // New token verification succeeds
        const newVerify = await request(app).get(`/api/auth/verify-setup-token?token=${newRawToken}`);
        expect(newVerify.status).toBe(200);
        expect(newVerify.body.valid).toBe(true);
    });

    test('7. Resending invitation generates new valid setup link', async () => {
        clearSentEmails();
        const email = `resend_valid_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Resend Valid Staff', email, role: 'ContentManager' });

        const staffId = staffRes.body.staff.id;

        clearSentEmails();
        await request(app)
            .post(`/api/superadmin/platform-staff/${staffId}/resend-invitation`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        const newRawToken = getLastSentEmail().token;
        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: newRawToken, password: 'BrandNewPass123!' });
        expect(setupRes.status).toBe(200);
    });

    test('8. INVITATION_CREATED audit log event is recorded', async () => {
        clearSentEmails();
        const email = `audit_create_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Audit Create Staff', email, role: 'ContentManager' });

        const targetId = staffRes.body.staff.id;
        const auditLog = await db.get(
            "SELECT * FROM superadmin_audit_logs WHERE action = 'INVITATION_CREATED' AND target_id = $1",
            [targetId]
        );

        expect(auditLog).toBeDefined();
        expect(auditLog.details).toContain('Role: ContentManager');
    });

    test('9. INVITATION_ACCEPTED audit log event is recorded upon setup', async () => {
        clearSentEmails();
        const email = `audit_accept_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Audit Accept Staff', email, role: 'SupportOfficer' });

        const rawToken = getLastSentEmail().token;
        const targetId = staffRes.body.staff.id;

        await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'AcceptedPass123!' });

        const auditLog = await db.get(
            "SELECT * FROM superadmin_audit_logs WHERE action = 'INVITATION_ACCEPTED' AND target_id = $1",
            [targetId]
        );

        expect(auditLog).toBeDefined();
        expect(auditLog.action).toBe('INVITATION_ACCEPTED');
    });

    test('10. Production logs never expose raw tokens or passwords', async () => {
        const spyLog = jest.spyOn(console, 'log');
        const spyErr = jest.spyOn(console, 'error');

        await sendInvitationEmail({
            email: 'log_safety@example.com',
            name: 'Safety User',
            role: 'Student',
            schoolName: 'Safety School',
            token: 'super_secret_raw_token_xyz999'
        });

        // Verify console logs do not contain raw token
        const allLogs = [...spyLog.mock.calls, ...spyErr.mock.calls].map(c => c.join(' ')).join(' ');
        expect(allLogs).not.toContain('super_secret_raw_token_xyz999');

        spyLog.mockRestore();
        spyErr.mockRestore();
    });

    test('11. SuperAdmin can resend invitation', async () => {
        clearSentEmails();
        const email = `sa_resend_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'SA Resend Target', email, role: 'ContentManager' });

        const res = await request(app)
            .post(`/api/superadmin/platform-staff/${staffRes.body.staff.id}/resend-invitation`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('resent');
    });

    test('12. Non-SuperAdmin cannot resend platform staff invitation', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff/1/resend-invitation')
            .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
    });

    test('13. SuperAdmin can reset global staff access', async () => {
        clearSentEmails();
        const email = `sa_reset_${Date.now()}@eduman.local`;
        const staffRes = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'SA Reset Target', email, role: 'SupportOfficer' });

        const staffId = staffRes.body.staff.id;
        const res = await request(app)
            .post(`/api/superadmin/platform-staff/${staffId}/reset-access`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('Access reset successfully');

        // Check token_version incremented
        const user = await db.get("SELECT token_version FROM users WHERE id = $1", [staffId]);
        expect(user.token_version).toBeGreaterThan(1);
    });

    test('14. Non-SuperAdmin cannot reset global staff access', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff/1/reset-access')
            .set('Authorization', `Bearer ${schoolAdminToken}`);

        expect(res.status).toBe(403);
    });

    test('15. Rate limiting is active on setup-password endpoint', async () => {
        const verifyRes = await request(app).get('/api/auth/verify-setup-token?token=invalid_test_rate_limit');
        expect(verifyRes.status).toBe(400);
    });

    test('16. Parent invitation flow works end-to-end', async () => {
        clearSentEmails();
        const parentEmail = `parent_e2e_${Date.now()}@eduman.local`;
        const schoolObj = await db.get("SELECT id FROM schools LIMIT 1");

        const studentEmail = `student_for_parent_${Date.now()}@eduman.local`;
        const studentRes = await request(app)
            .post('/api/students')
            .set('Authorization', `Bearer ${schoolAdminToken}`)
            .send({
                admission_number: `ADM_P_${Date.now()}`,
                first_name: 'ParentChild',
                last_name: 'Test',
                gender: 'Male',
                email: studentEmail,
                parent_action: 'CREATE_NEW',
                parent_name: 'New Parent User',
                parent_email: parentEmail
            });

        expect(studentRes.status).toBe(200);

        const emails = getSentEmails();
        const parentMail = emails.find(e => e.to && e.to.toLowerCase() === parentEmail.toLowerCase());
        expect(parentMail).toBeDefined();

        const rawToken = parentMail.token;
        const verifyRes = await request(app).get(`/api/auth/verify-setup-token?token=${rawToken}`);
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.user.role).toBe('Parent');

        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'ParentPass123!' });
        expect(setupRes.status).toBe(200);
    });

    test('17. Accountant invitation flow works end-to-end', async () => {
        clearSentEmails();
        const accEmail = `acc_e2e_${Date.now()}@eduman.local`;

        const createRes = await request(app)
            .post('/api/finance/accountants')
            .set('Authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'E2E Accountant', email: accEmail });

        expect(createRes.status).toBe(201);
        const rawToken = getLastSentEmail().token;

        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'AccountantPass123!' });
        expect(setupRes.status).toBe(200);
    });

    test('18. Student invitation flow works end-to-end', async () => {
        clearSentEmails();
        const studentEmail = `student_e2e_${Date.now()}@eduman.local`;

        await request(app)
            .post('/api/students')
            .set('Authorization', `Bearer ${schoolAdminToken}`)
            .send({
                admission_number: `ADM_S_${Date.now()}`,
                first_name: 'StudentE2E',
                last_name: 'User',
                gender: 'Female',
                email: studentEmail,
                parent_action: 'NONE'
            });

        const emails = getSentEmails();
        const studentMail = emails.find(e => e.to === studentEmail);
        expect(studentMail).toBeDefined();

        const rawToken = studentMail.token;
        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'StudentPass123!' });
        expect(setupRes.status).toBe(200);
    });

    test('19. ContentManager invitation flow works end-to-end', async () => {
        clearSentEmails();
        const cmEmail = `cm_e2e_${Date.now()}@eduman.local`;

        await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'CM E2E', email: cmEmail, role: 'ContentManager' });

        const rawToken = getLastSentEmail().token;
        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'CMPassword123!' });
        expect(setupRes.status).toBe(200);
    });

    test('20. SupportOfficer invitation flow works end-to-end', async () => {
        clearSentEmails();
        const soEmail = `so_e2e_${Date.now()}@eduman.local`;

        await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'SO E2E', email: soEmail, role: 'SupportOfficer' });

        const rawToken = getLastSentEmail().token;
        const setupRes = await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'SOPassword123!' });
        expect(setupRes.status).toBe(200);
    });
});
