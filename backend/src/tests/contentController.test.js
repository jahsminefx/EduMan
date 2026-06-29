const fs = require('fs');
const contentController = require('../controllers/contentController');
const { getDB } = require('../config/database');

jest.mock('../config/database', () => ({
  getDB: jest.fn()
}));

function createResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
}

describe('content controller deletion permissions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(fs, 'unlink').mockImplementation((filePath, callback) => callback(null));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('allows a teacher to delete content they uploaded in their school', async () => {
    const db = {
      get: jest.fn().mockResolvedValue({
        id: 7,
        school_id: 1,
        uploaded_by: 12,
        file_path: '/uploads/content_7.pdf'
      }),
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };
    getDB.mockReturnValue(db);

    const req = {
      params: { id: 7 },
      user: { id: 12, role: 'Teacher', school_id: 1 }
    };
    const res = createResponse();

    await contentController.deleteContent(req, res);

    expect(db.run).toHaveBeenCalledWith('DELETE FROM learning_contents WHERE id = $1', [7]);
    expect(res.json).toHaveBeenCalledWith({ message: 'Content deleted successfully' });
  });

  it('prevents a teacher from deleting another teacher’s content', async () => {
    const db = {
      get: jest.fn().mockResolvedValue({
        id: 8,
        school_id: 1,
        uploaded_by: 99,
        file_path: '/uploads/content_8.pdf'
      }),
      run: jest.fn()
    };
    getDB.mockReturnValue(db);

    const req = {
      params: { id: 8 },
      user: { id: 12, role: 'Teacher', school_id: 1 }
    };
    const res = createResponse();

    await contentController.deleteContent(req, res);

    expect(db.run).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      message: 'Teachers can only delete content they uploaded.'
    });
  });

  it('prevents a School Admin from deleting global content', async () => {
    const db = {
      get: jest.fn().mockResolvedValue({
        id: 9,
        school_id: null,
        uploaded_by: 4,
        file_path: '/uploads/global.pdf'
      }),
      run: jest.fn()
    };
    getDB.mockReturnValue(db);

    const req = {
      params: { id: 9 },
      user: { id: 2, role: 'SchoolAdmin', school_id: 1 }
    };
    const res = createResponse();

    await contentController.deleteContent(req, res);

    expect(db.run).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
