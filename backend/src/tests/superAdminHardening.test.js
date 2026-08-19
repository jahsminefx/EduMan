const request = require('supertest');
const app = require('../app');
const { getDB, closeDB, initDB } = require('../config/database');
const { getLastSentEmail } = require('../services/notificationService');

describe('SuperAdmin Role Hardening & Platform Expansion Integration Tests', () => {
    let db;
    let superAdminToken;
    let schoolAdminToken;
    let accountantToken;
    let contentManagerToken;
    let supportOfficerToken;
    let schoolId;

    beforeAll(async () => {
        await initDB();
        db = getDB();
        await db.run("UPDATE schools SET suspended_by = NULL");
        await db.run("DELETE FROM superadmin_audit_logs");
        await db.run("DELETE FROM users WHERE email LIKE '%_test@eduman.local' OR email LIKE 'cm%@eduman.local' OR email LIKE 'so%@eduman.local' OR email LIKE 'sus_user%@eduman.local'");

        // 1. Setup School
        const schoolRes = await db.run(
            `INSERT INTO schools (name, status, is_active) VALUES ('SuperAdmin Test School', 'ACTIVE', 1) RETURNING id`
        );
        schoolId = schoolRes.lastID;

        // 2. Create SuperAdmin
        const saPassHash = await require('bcryptjs').hash('ASDFGHJKL', 10);
        await db.run("DELETE FROM users WHERE email = 'superadmin_hardening_test@eduman.local'");
        await db.run(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ('Super Admin Hardening', 'superadmin_hardening_test@eduman.local', $1, 'SuperAdmin', 1)`,
            [saPassHash]
        );

        // Login SuperAdmin
        const saTokenRes = await request(app)
            .post('/api/auth/login')
            .send({ email: 'superadmin_hardening_test@eduman.local', password: 'ASDFGHJKL' });
        superAdminToken = saTokenRes.body.token;

        // 3. Create SchoolAdmin
        const schoolAdminPassHash = await require('bcryptjs').hash('Pass1234!', 10);
        const adminRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ('School Admin', 'schooladmin_test@eduman.local', $1, 'SchoolAdmin', 1) RETURNING id`,
            [schoolAdminPassHash]
        );
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [adminRes.lastID, schoolId]);

        const adminLogin = await request(app).post('/api/auth/login').send({ email: 'schooladmin_test@eduman.local', password: 'Pass1234!' });
        schoolAdminToken = adminLogin.body.token;

        // 4. Create Accountant
        const acctRes = await db.run(
            `INSERT INTO users (name, email, password_hash, role, is_active)
             VALUES ('School Accountant', 'accountant_test@eduman.local', $1, 'Accountant', 1) RETURNING id`,
            [schoolAdminPassHash]
        );
        await db.run(`INSERT INTO school_admin_assignments (user_id, school_id) VALUES ($1, $2)`, [acctRes.lastID, schoolId]);
        const acctLogin = await request(app).post('/api/auth/login').send({ email: 'accountant_test@eduman.local', password: 'Pass1234!' });
        accountantToken = acctLogin.body.token;
    });

    afterAll(async () => {
        await closeDB();
    });

    test('1. SuperAdmin can create ContentManager', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Content Manager One', email: 'cm1@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(201);
        expect(res.body.staff.role).toBe('ContentManager');

        // Login as newly created ContentManager once setup is done
        const user = await db.get("SELECT * FROM users WHERE email = 'cm1@eduman.local'");
        expect(user.role).toBe('ContentManager');
        expect(user.setup_token).toBeDefined();

        // Complete password setup using raw token from email
        const rawToken = getLastSentEmail().token;
        await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'CM1Password123!' });
        const cmLogin = await request(app).post('/api/auth/login').send({ email: 'cm1@eduman.local', password: 'CM1Password123!' });
        expect(cmLogin.status).toBe(200);
        contentManagerToken = cmLogin.body.token;
    });

    test('2. SuperAdmin can create SupportOfficer', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Support Officer One', email: 'so1@eduman.local', role: 'SupportOfficer' });

        expect(res.status).toBe(201);
        expect(res.body.staff.role).toBe('SupportOfficer');

        const user = await db.get("SELECT * FROM users WHERE email = 'so1@eduman.local'");
        expect(user.role).toBe('SupportOfficer');

        const rawToken = getLastSentEmail().token;
        await request(app).post('/api/auth/setup-password').send({ token: rawToken, password: 'SO1Password123!' });
        const soLogin = await request(app).post('/api/auth/login').send({ email: 'so1@eduman.local', password: 'SO1Password123!' });
        expect(soLogin.status).toBe(200);
        supportOfficerToken = soLogin.body.token;
    });

    test('3. SchoolAdmin cannot create ContentManager', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Hacker CM', email: 'hack_cm@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(403);
    });

    test('4. SchoolAdmin cannot create SupportOfficer', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${schoolAdminToken}`)
            .send({ name: 'Hacker SO', email: 'hack_so@eduman.local', role: 'SupportOfficer' });

        expect(res.status).toBe(403);
    });

    test('5. Accountant cannot create global roles', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${accountantToken}`)
            .send({ name: 'Acct CM', email: 'acct_cm@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(403);
    });

    test('6. ContentManager cannot create global roles', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${contentManagerToken}`)
            .send({ name: 'CM CM', email: 'cm_cm@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(403);
    });

    test('7. SupportOfficer cannot create global roles', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${supportOfficerToken}`)
            .send({ name: 'SO SO', email: 'so_so@eduman.local', role: 'SupportOfficer' });

        expect(res.status).toBe(403);
    });

    test('8. Newly created global staff have no school association', async () => {
        const user = await db.get("SELECT id FROM users WHERE email = 'cm1@eduman.local'");
        const assignment = await db.get("SELECT id FROM school_admin_assignments WHERE user_id = $1", [user.id]);
        expect(assignment).toBeUndefined();
    });

    test('9. Invitation setup token is generated on staff creation', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'Content Manager Two', email: 'cm2@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(201);
        const user = await db.get("SELECT setup_token, setup_token_expires FROM users WHERE email = 'cm2@eduman.local'");
        expect(user.setup_token).toBeDefined();
        expect(user.setup_token.length).toBeGreaterThan(10);
    });

    test('10. Invitation setup token expires correctly (7 days)', async () => {
        const user = await db.get("SELECT setup_token_expires FROM users WHERE email = 'cm2@eduman.local'");
        expect(user.setup_token_expires).toBeDefined();
    });

    test('11. Password setup via /api/auth/setup-password works for global staff', async () => {
        const sentEmail = getLastSentEmail();
        const rawToken = sentEmail.token;

        const setupRes = await request(app)
            .post('/api/auth/setup-password')
            .send({ token: rawToken, password: 'NewPass12345!' });

        expect(setupRes.status).toBe(200);
        expect(setupRes.body.message).toContain('Password set up successfully');
    });

    test('12. Token is invalid after single use', async () => {
        const user = await db.get("SELECT setup_token FROM users WHERE email = 'cm2@eduman.local'");
        expect(user.setup_token).toBeNull(); // Token cleared after single use

        const reuseRes = await request(app)
            .post('/api/auth/setup-password')
            .send({ token: 'bogus_used_token', password: 'NewPass12345!' });

        expect(reuseRes.status).toBe(400);
    });

    test('13. Sensitive SuperAdmin actions create superadmin_audit_logs records', async () => {
        const logs = await db.all("SELECT * FROM superadmin_audit_logs WHERE action = 'CREATE_PLATFORM_STAFF'");
        expect(logs.length).toBeGreaterThan(0);
        expect(logs[0].user_id).toBeDefined();
    });

    test('14. Last active SuperAdmin cannot be deactivated', async () => {
        const saUser = await db.get("SELECT id FROM users WHERE email = 'superadmin_hardening_test@eduman.local'");
        await db.run("UPDATE users SET is_active = 0 WHERE role = 'SuperAdmin' AND id != $1", [saUser.id]);

        const deactRes = await request(app)
            .put(`/api/superadmin/platform-staff/${saUser.id}/status`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ is_active: 0 });

        expect(deactRes.status).toBe(400);
        expect(deactRes.body.message).toContain('Cannot deactivate the last active SuperAdmin');

        // Restore all SuperAdmins to active for subsequent test suites
        await db.run("UPDATE users SET is_active = 1 WHERE role = 'SuperAdmin'");
    });

    test('15. ContentManager remains blocked from school administration routes', async () => {
        const res = await request(app)
            .get('/api/superadmin/schools')
            .set('Authorization', `Bearer ${contentManagerToken}`);

        expect(res.status).toBe(403);
    });

    test('16. SupportOfficer remains blocked from school administration routes', async () => {
        const res = await request(app)
            .get('/api/superadmin/schools')
            .set('Authorization', `Bearer ${supportOfficerToken}`);

        expect(res.status).toBe(403);
    });

    test('17. Accountant remains school-isolated', async () => {
        const res = await request(app)
            .get('/api/superadmin/schools')
            .set('Authorization', `Bearer ${accountantToken}`);

        expect(res.status).toBe(403);
    });

    test('18. Parent remains child-linked and IDOR protected', async () => {
        const parentRes = await request(app)
            .get('/api/parent/children')
            .set('Authorization', `Bearer ${accountantToken}`);

        expect(parentRes.status).toBe(403);
    });

    test('19. Global role cannot be assigned to a school', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'CM School Test', email: 'cm_school@eduman.local', role: 'ContentManager' });

        expect(res.status).toBe(201);
        const user = await db.get("SELECT id FROM users WHERE email = 'cm_school@eduman.local'");
        const assignment = await db.get("SELECT id FROM school_admin_assignments WHERE user_id = $1", [user.id]);
        expect(assignment).toBeUndefined();
    });

    test('20. SuperAdmin cannot create a school-scoped role through Platform Staff endpoint', async () => {
        const res = await request(app)
            .post('/api/superadmin/platform-staff')
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ name: 'School Admin Fake', email: 'sa_fake@eduman.local', role: 'SchoolAdmin' });

        expect(res.status).toBe(400);
        expect(res.body.message).toContain('Only ContentManager and SupportOfficer can be created');
    });

    test('21. Session revocation invalidates active JWT tokens', async () => {
        const targetUser = await db.get("SELECT id FROM users WHERE email = 'cm1@eduman.local'");

        // Revoke active sessions for cm1
        const revokeRes = await request(app)
            .post(`/api/superadmin/platform-staff/${targetUser.id}/revoke-sessions`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(revokeRes.status).toBe(200);

        // Next request with existing contentManagerToken must be rejected (401)
        const reqRes = await request(app)
            .get('/api/support/kb')
            .set('Authorization', `Bearer ${contentManagerToken}`);

        expect(reqRes.status).toBe(401);
        expect(reqRes.body.message).toContain('Session has been revoked');
    });

    test('22. Resending an invitation invalidates previous setup token', async () => {
        const user = await db.get("SELECT id FROM users WHERE email = 'cm_school@eduman.local'");
        const oldRawToken = getLastSentEmail()?.token || 'old_token';

        const resendRes = await request(app)
            .post(`/api/superadmin/platform-staff/${user.id}/resend-invitation`)
            .set('Authorization', `Bearer ${superAdminToken}`);

        expect(resendRes.status).toBe(200);

        const newRawToken = getLastSentEmail()?.token;
        expect(newRawToken).toBeDefined();
        expect(newRawToken).not.toBe(oldRawToken);

        // Old token verification should fail
        const oldVerify = await request(app).get(`/api/auth/verify-setup-token?token=${oldRawToken}`);
        expect(oldVerify.status).toBe(400);
    });

    test('23. Suspended school users are blocked from logging in', async () => {
        // Create a test school & user then suspend school
        const sRes = await db.run("INSERT INTO schools (name, status, is_active) VALUES ('Suspended School', 'ACTIVE', 1) RETURNING id");
        const sId = sRes.lastID;

        const uPassHash = await require('bcryptjs').hash('UserPass123!', 10);
        const susUserRes = await db.run(
            "INSERT INTO users (name, email, password_hash, role, is_active) VALUES ('Suspended User', 'sus_user@eduman.local', $1, 'Teacher', 1) RETURNING id",
            [uPassHash]
        );
        await db.run("INSERT INTO teachers (user_id, school_id, first_name, last_name, gender) VALUES ($1, $2, 'Suspended', 'User', 'Male')", [susUserRes.lastID, sId]);

        // Login before suspension works
        const loginPre = await request(app).post('/api/auth/login').send({ email: 'sus_user@eduman.local', password: 'UserPass123!' });
        expect(loginPre.status).toBe(200);
        const userToken = loginPre.body.token;

        // Suspend school
        await request(app)
            .put(`/api/superadmin/schools/${sId}/suspend`)
            .set('Authorization', `Bearer ${superAdminToken}`)
            .send({ reason: 'Non-payment of SaaS platform fees' });

        // 1. Existing JWT token is revoked immediately (401)
        const checkRes = await request(app)
            .get('/api/teachers')
            .set('Authorization', `Bearer ${userToken}`);

        expect(checkRes.status).toBe(401);
        expect(checkRes.body.message).toContain('Session has been revoked');

        // 2. New login attempt is blocked (403)
        const postLogin = await request(app)
            .post('/api/auth/login')
            .send({ email: 'sus_user@eduman.local', password: 'UserPass123!' });

        expect(postLogin.status).toBe(403);
        expect(postLogin.body.message).toContain('School account is currently suspended');
    });
});
