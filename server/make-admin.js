// Run this script to make a user an admin:
// node server/make-admin.js YOUR_USERNAME

const { initDatabase, prepare } = require('./db');

async function makeAdmin() {
  const username = process.argv[2];

  if (!username) {
    console.log('Usage: node server/make-admin.js <username>');
    process.exit(1);
  }

  await initDatabase();

  const user = prepare('SELECT id, username FROM users WHERE username = ?').get(username);
  if (!user) {
    console.log(`User "${username}" not found`);
    process.exit(1);
  }

  prepare('UPDATE users SET is_admin = 1 WHERE id = ?').run(user.id);
  console.log(`✓ User "${username}" is now an admin!`);
  console.log(`  Go to /admin.html to access the admin panel`);
  process.exit(0);
}

makeAdmin().catch(console.error);
