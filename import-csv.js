const fs = require('fs');
const readline = require('readline');
const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database('./database.sqlite');
const CSV_FILE_PATH = './hills_registry_rows - Sheet1 (1).csv'; // Ensure your CSV file is in the project folder

async function importCsv() {
    const fileStream = fs.createReadStream(CSV_FILE_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let isHeader = true;
    let count = 0;

    console.log('Importing Munro coordinates from CSV using unique ID...');

    db.serialize(() => {
        db.run('BEGIN TRANSACTION');
        
        // Update directly using the unique Munro ID
        const stmt = db.prepare(`
            UPDATE munros 
            SET height = ?, lat = ?, lng = ? 
            WHERE id = ?
        `);

        rl.on('line', (line) => {
            if (isHeader) {
                isHeader = false; // Skip the CSV header row
                return;
            }

            // Assumes column order: ID, Name, Area, Latitude, Longitude
            // Index 0: ID | Index 1: Name | Index 2: Area | Index 3: Latitude | Index 4: Longitude
            // (If your column order is different, just tweak the array indices below!)
            const parts = line.split(',');
            if (parts.length >= 5) {
                const id = parseInt(parts[0].trim());
                const height = parseInt(parts[4])
                const lat = parseFloat(parts[5]);
                const lng = parseFloat(parts[6]);

                if (!isNaN(id) && !isNaN(lat) && !isNaN(lng) && !isNaN(height)) {
                    stmt.run(height, lat, lng, id, (err) => {
                        if (err) {
                            console.error(`Error updating munro ID ${id}:`, err.message);
                        }
                    });
                    count++;
                }
            }
        });

        rl.on('close', () => {
            stmt.finalize();
            db.run('COMMIT', () => {
                console.log(`Successfully updated coordinates for ${count} Munros using IDs! 🎉`);
                db.close();
            });
        });
    });
}

importCsv();