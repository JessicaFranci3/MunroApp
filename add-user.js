const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const userName = 'Jessica'; // Put your name here
const walkhighlandsId = '262722'; // Whatever identifier you use

db.run(`INSERT INTO users (name, walkhighlands_id) VALUES (?, ?)`, [userName, walkhighlandsId], function(err) {
    if (err) {
        console.error('Error adding user:', err.message);
    } else {
        console.log(`Successfully added user "${userName}" with ID: ${this.lastID}`);
    }
    db.close();
});