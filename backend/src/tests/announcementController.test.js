const announcementController = require('../controllers/announcementController');
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

describe('announcement controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('lists all statuses for SchoolAdmin management when status is not provided', async () => {
    const db = {
      all: jest.fn().mockResolvedValue([
        {
          id: 1,
          school_id: 1,
          author_id: 10,
          title: 'Published bulletin',
          status: 'Published',
          can_edit: 1
        }
      ])
    };
    getDB.mockReturnValue(db);

    const req = {
      query: {},
      user: { id: 10, role: 'SchoolAdmin', school_id: 1 }
    };
    const res = createResponse();

    await announcementController.listAnnouncements(req, res);

    expect(db.all).toHaveBeenCalledTimes(1);
    const [query, params] = db.all.mock.calls[0];
    expect(query).not.toContain('a.status = $2');
    expect(params).toEqual([1, 'SchoolAdmin', 10]);
    expect(res.json).toHaveBeenCalledWith({
      announcements: [
        expect.objectContaining({
          id: 1,
          status: 'Published',
          can_edit: true
        })
      ]
    });
  });

  it('allows a SchoolAdmin to delete a published announcement in their school', async () => {
    const db = {
      get: jest.fn().mockResolvedValue({
        id: 2,
        school_id: 1,
        author_id: 11,
        status: 'Published',
        title: 'Published bulletin'
      }),
      run: jest.fn().mockResolvedValue({ changes: 1 })
    };
    getDB.mockReturnValue(db);

    const req = {
      params: { id: 2 },
      user: { id: 10, role: 'SchoolAdmin', school_id: 1 }
    };
    const res = createResponse();

    await announcementController.deleteAnnouncement(req, res);

    expect(db.run).toHaveBeenCalledWith(
      'DELETE FROM announcements WHERE id = $1 AND school_id = $2',
      [2, 1]
    );
    expect(res.json).toHaveBeenCalledWith({ message: 'Announcement deleted successfully.' });
  });
});
