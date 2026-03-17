require('dotenv').config();
const app = require('./src/app');
const { initDB } = require('./src/config/database');

const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    // Initialize Database
    await initDB();
    console.log('Database initialized successfully.');

    // Start listening
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
