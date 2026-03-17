const { initDB } = require('./src/config/database');
initDB().then(() => { 
  console.log('Schema updated successfully'); 
  process.exit(0); 
}).catch(e => { 
  console.error(e); 
  process.exit(1); 
});
