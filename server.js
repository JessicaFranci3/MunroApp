const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const runScraper = require('./scraper');

const app = express();
const PORT = 2000;

// Serve static files from the 'public' folder
app.use(express.static('public'));
app.use(express.json());

// 1. Initialize our SQLite database (this creates a file named 'database.sqlite' in your folder)
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
    }
});

// CREATE DATABASE

// 1. Master list of all Munros and their areas
db.run(`CREATE TABLE IF NOT EXISTS munros (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    area TEXT,
    height INT,
    lat REAL,
    lng REAL
)`);

// 2. Users (you, friends, family, etc.)
db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    walkhighlands_id TEXT
)`);

// 3. Progress tracking junction table
db.run(`CREATE TABLE IF NOT EXISTS user_munros (
    user_id INTEGER,
    munro_id INTEGER,
    status TEXT,
    PRIMARY KEY (user_id, munro_id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (munro_id) REFERENCES munros(id)
)`);

// Route to trigger the scraper and save to DB
app.post('/scrape', async (req, res) => {
    try {
        console.log('Scraping started...');
        const titles = await runScraper();
        console.log('Scraping finished!', titles);

        // 3. Insert each title into our database
        const timestamp = new Date().toISOString();

        const stmt = db.prepare(`INSERT INTO articles (title, complete, date_scraped) VALUES (?, ?, ?)`);

        for (const item of titles) {
            stmt.run(item.name, item.complete, timestamp);
        }
        stmt.finalize();

        res.json({ 
            success: true, 
            message: `Successfully scraped and saved ${titles.length} articles!`,
            data: titles 
        });
    } catch (error) {
        console.error('Error during scraping:', error);
        res.status(500).json({ success: false, error: 'Scraping failed' });
    }
});

app.get('/articles', (req, res) => {
    // Grab all rows (ordered alphabetically or by id)
    db.all(`SELECT * FROM articles ORDER BY id ASC`, [], (err, rows) => {
        if (err) {
            console.error('Error fetching articles:', err.message);
            res.status(500).json({ success: false, error: 'Failed to fetch articles' });
            return;
        }
        res.json({ success: true, data: rows });
    });
});

// Get aggregated progress for multiple selected users (with head-to-head breakdown for 2 users)
app.get('/users/compare', (req, res) => {
    const userIdsParam = req.query.ids;
    if (!userIdsParam) {
        return res.status(400).json({ success: false, error: 'No user IDs provided' });
    }

    const userIds = userIdsParam.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
    if (userIds.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid user IDs' });
    }

    // HEAD-TO-HEAD MODE (Exactly 2 users selected)
    if (userIds.length === 2) {
        const [u1, u2] = userIds;
        const query = `
            SELECT m.id, m.name, m.area, m.lat, m.lng,
                   MAX(CASE WHEN um.user_id = ? AND um.status = 'Yes' THEN 1 ELSE 0 END) AS u1_done,
                   MAX(CASE WHEN um.user_id = ? AND um.status = 'Yes' THEN 1 ELSE 0 END) AS u2_done
            FROM munros m
            LEFT JOIN user_munros um ON m.id = um.munro_id AND um.user_id IN (?, ?)
            GROUP BY m.id
        `;

        db.all(query, [u1, u2, u1, u2], (err, rows) => {
            if (err) {
                console.error('Error in head-to-head comparison:', err.message);
                return res.status(500).json({ success: false, error: 'Database error' });
            }

            const formattedRows = rows.map(row => {
                let status = 'neither';
                if (row.u1_done && row.u2_done) status = 'both';
                else if (row.u1_done && !row.u2_done) status = 'u1_only';
                else if (!row.u1_done && row.u2_done) status = 'u2_only';

                return {
                    id: row.id,
                    name: row.name,
                    area: row.area,
                    lat: row.lat,
                    lng: row.lng,
                    status: status
                };
            });

            return res.json({ success: true, mode: 'head-to-head', userIds, data: formattedRows });
        });
        return;
    }

    // MULTI-USER GROUP MODE (1 or 3+ users selected)
    const placeholders = userIds.map(() => '?').join(',');
    const totalSelected = userIds.length;

    const query = `
        SELECT m.id, m.name, m.area, m.lat, m.lng,
               COUNT(CASE WHEN um.status = 'Yes' THEN 1 END) AS completed_by_count
        FROM munros m
        LEFT JOIN user_munros um 
               ON m.id = um.munro_id 
              AND um.user_id IN (${placeholders})
        GROUP BY m.id
    `;

    db.all(query, userIds, (err, rows) => {
        if (err) {
            console.error('Error comparing users:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }

        const formattedRows = rows.map(row => {
            let status = 'none';
            if (row.completed_by_count === totalSelected) {
                status = 'all';
            } else if (row.completed_by_count > 0) {
                status = 'some';
            }

            return {
                id: row.id,
                name: row.name,
                area: row.area,
                lat: row.lat,
                lng: row.lng,
                completedByCount: row.completed_by_count,
                status: status
            };
        });

        res.json({ success: true, mode: 'group', totalSelected, data: formattedRows });
    });
});

// POST endpoint to create a new user
app.post('/users', (req, res) => {
    const { name, walkhighlands_id } = req.body;

    if (!name || !walkhighlands_id) {
        return res.status(400).json({ success: false, error: 'Name and Walkhighlands ID are required.' });
    }

    db.run(`INSERT INTO users (name, walkhighlands_id) VALUES (?, ?)`, [name, walkhighlands_id], function(err) {
        if (err) {
            console.error('Error inserting user:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ 
            success: true, 
            id: this.lastID, 
            message: `User ${name} added successfully!` 
        });
    });
});

const syncUserForId = require('./sync-user');

// 1. Get users with their completed Munro counts, ordered highest first
app.get('/users', (req, res) => {
    const query = `
        SELECT u.id, u.name, u.walkhighlands_id, 
               (SELECT COUNT(*) FROM munros) as total_munros,
               (SELECT COUNT(*) FROM user_munros um WHERE um.user_id = u.id AND um.status = 'Yes') as completed_count
        FROM users u
        ORDER BY completed_count DESC
    `;
    db.all(query, [], (err, rows) => {
        if (err) {
            console.error('Error fetching users:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, data: rows });
    });
});

// 2. Trigger sync for a specific user
app.post('/users/:id/sync', async (req, res) => {
    const userId = req.params.id;
    try {
        console.log(`Received request to sync user ID: ${userId}`);
        const result = await syncUserForId(userId);
        res.json({ success: true, message: `Successfully synced ${result.name}!` });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

// 3. Delete a user and their progress records
app.delete('/users/:id', (req, res) => {
    const userId = req.params.id;
    db.serialize(() => {
        db.run(`DELETE FROM user_munros WHERE user_id = ?`, [userId]);
        db.run(`DELETE FROM users WHERE id = ?`, [userId], function(err) {
            if (err) {
                return res.status(500).json({ success: false, error: 'Failed to delete user' });
            }
            res.json({ success: true, message: 'User deleted successfully' });
        });
    });
});

// Get all munros with a specific user's completion status & coordinates
app.get('/users/:id/munros', (req, res) => {
    const userId = req.params.id;
    const query = `
        SELECT m.id, m.name, m.area, m.lat, m.lng, 
               COALESCE(um.status, 'No') as status
        FROM munros m
        LEFT JOIN user_munros um ON m.id = um.munro_id AND um.user_id = ?
    `;
    db.all(query, [userId], (err, rows) => {
        if (err) {
            console.error('Error fetching user munros:', err.message);
            return res.status(500).json({ success: false, error: 'Database error' });
        }
        res.json({ success: true, data: rows });
    });
});

// Export munros table to CSV for auditing
app.get('/export-munros', (req, res) => {
    db.all(`SELECT id, name, area, lat, lng FROM munros ORDER BY id ASC`, [], (err, rows) => {
        if (err) {
            return res.status(500).send('Database error');
        }

        let csv = 'id,name,area,lat,lng\n';
        for (const row of rows) {
            // Wrap name and area in quotes in case of commas
            const name = `"${(row.name || '').replace(/"/g, '""')}"`;
            const area = `"${(row.area || '').replace(/"/g, '""')}"`;
            csv += `${row.id},${name},${area},${row.lat || ''},${row.lng || ''}\n`;
        }

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="munros_export.csv"');
        res.status(200).send(csv);
    });
});

app.listen(PORT, () => {
    console.log(`Server is running at http://localhost:${PORT}`);
});