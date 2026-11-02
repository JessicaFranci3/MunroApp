const { chromium } = require('playwright');
const sqlite3 = require('sqlite3').verbose();

async function syncUserForId(userIdArg) {
    const db = new sqlite3.Database('./database.sqlite');

    try {
        const user = await new Promise((resolve, reject) => {
            db.get(`SELECT * FROM users WHERE id = ?`, [userIdArg], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });

        if (!user) {
            throw new Error(`User with ID ${userIdArg} not found.`);
        }

        console.log(`👤 Syncing progress for: ${user.name}`);
        const targetUrl = `https://www.walkhighlands.co.uk/Forum/munros.php?u=${user.walkhighlands_id}`;

        const munroMap = new Map();
        const munroRows = await new Promise((resolve, reject) => {
            db.all(`SELECT id, name FROM munros`, [], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        munroRows.forEach(row => munroMap.set(row.name, row.id));

        // Use headless: true for web-triggered syncs so it runs smoothly in the background
        const browser = await chromium.launch({ headless: false });
        const page = await browser.newPage();
        
        await page.goto(targetUrl, { waitUntil: 'domcontentloaded' });

        const dropdown = page.locator('#dt-length-0');
        await dropdown.waitFor({ state: 'visible' });
        await dropdown.selectOption({ label: 'All' });

        const rows = page.locator('table tbody tr');
        await rows.first().waitFor();
        const rowCount = await rows.count();

        const progressData = [];
        for (let i = 0; i < rowCount; i++) {
            const row = rows.nth(i);
            const anchorLocator = row.locator('td').nth(0).locator('a');

            if (await anchorLocator.count() > 0) {
                const hillName = (await anchorLocator.innerText()).trim();
                const styleAttr = (await anchorLocator.getAttribute('style')) || '';

                let status = 'No'; // Default to unclimbed

                const lowerStyle = styleAttr.toLowerCase();

                if (lowerStyle.includes('71a3d9')) {
                    status = 'Yes'; // Blue = Climbed / Completed
                } else if (lowerStyle.includes('d70000')) {
                    status = 'No';  // Red = Not completed
                }

                const munroId = munroMap.get(hillName);
                if (munroId) {
                    progressData.push({ munroId, status });
                }
            }
        }

        await browser.close();

        await new Promise((resolve, reject) => {
            db.serialize(() => {
                db.run('BEGIN TRANSACTION');
                const stmt = db.prepare(`
                    INSERT OR REPLACE INTO user_munros (user_id, munro_id, status) 
                    VALUES (?, ?, ?)
                `);

                for (const item of progressData) {
                    stmt.run(user.id, item.munroId, item.status);
                }

                stmt.finalize();
                db.run('COMMIT', (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });

        console.log(`🎉 Successfully synced progress for ${user.name}!`);
        return { success: true, name: user.name };

    } catch (error) {
        console.error('❌ Sync error:', error);
        throw error;
    } finally {
        db.close();
    }
}

// Allow running directly via command line: node sync-user.js <id>
if (require.main === module) {
    const userIdArg = process.argv[2];
    if (!userIdArg) {
        console.error('Please provide a user ID.');
        process.exit(1);
    }
    syncUserForId(userIdArg);
}

module.exports = syncUserForId;