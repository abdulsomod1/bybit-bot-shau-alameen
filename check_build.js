const fs = require('fs');
const db = fs.readFileSync('c:/bot/dist/main/main/services/database.js', 'utf8');
const m = db.match(/function saveCredentials[\s\S]{0,300}/);
fs.writeFileSync('c:/bot/check_db.txt', m ? m[0] : 'NOT FOUND');
console.log('done');
