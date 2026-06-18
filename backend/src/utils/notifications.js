const db = require('../config/database');

const createNotification = async (userId, type, title, message, metadata = {}) => {
  try {
    await db.query(
      'INSERT INTO notifications (user_id, type, title, message, metadata) VALUES ($1, $2, $3, $4, $5)',
      [userId, type, title, message, JSON.stringify(metadata)]
    );
  } catch (err) {
    console.error('Notification creation failed:', err.message);
  }
};

const notifyAdmins = async (type, title, message, metadata = {}) => {
  try {
    const admins = await db.query(
      "SELECT id FROM users WHERE role IN ('admin', 'staff') AND is_active = TRUE"
    );
    await Promise.all(admins.rows.map((admin) =>
      createNotification(admin.id, type, title, message, metadata)
    ));
  } catch (err) {
    console.error('Admin notification failed:', err.message);
  }
};

module.exports = { createNotification, notifyAdmins };
