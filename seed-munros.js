const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();

// Connect to SQLite database
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database for seeding.');
    }
});

// Setup the new database schema
db.serialize(() => {
    // 1. Master list of all Munros and their areas
    db.run(`CREATE TABLE IF NOT EXISTS munros (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        area TEXT
    )`);

    // 2. Users table
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
});

async function seedMunros() {
    const browser = await chromium.launch({ headless: false }); // Watch it run!
    const page = await browser.newPage();

    // Replace with your actual target URL
    const url = 'https://www.walkhighlands.co.uk/Forum/munros.php?&u=262722'; 

    console.log('Navigating to target page to seed Munros...');
    await page.goto(url, { waitUntil: 'networkidle' });

    // Select "All" from the dropdown to ensure all rows are visible
    const dropdown = page.locator('#dt-length-0');
    await dropdown.waitFor({ state: 'visible' });
    await dropdown.selectOption({ label: 'All' });

    // Locate all rows in the table body
    const rows = page.locator('table tbody tr');
    await rows.first().waitFor();

    const rowCount = await rows.count();
    console.log(`Found ${rowCount} rows to seed.`);

    let insertedCount = 0;

    for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        
        // 1st column contains the anchor with the name
        const anchorLocator = row.locator('td').nth(0).locator('a');
        
        // 2nd column contains the area text (adjust nth index if your table structure differs)
        const areaLocator = row.locator('td').nth(2);

        if (await anchorLocator.count() > 0) {
            const hillName = (await anchorLocator.innerText()).trim();
            const areaName = (await areaLocator.innerText()).trim();

            // Insert into the munros master table
            db.run(`INSERT INTO munros (name, area) VALUES (?, ?)`, [hillName, areaName], (err) => {
                if (err) {
                    console.error(`Error inserting ${hillName}:`, err.message);
                }
            });

            insertedCount++;
        }
    }

    await browser.close();
    console.log(`Successfully seeded ${insertedCount} Munros into the database!`);
    
    // Give SQLite a moment to finish writing before closing the script process
    setTimeout(() => {
        db.close();
        console.log('Database connection closed.');
    }, 1000);
}

seedMunros();