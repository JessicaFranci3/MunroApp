const { chromium } = require('playwright');

async function runScraper() {
    // Launch the browser (headless: true is great for background servers)
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();

    // Replace 'YOUR_URL_HERE' with your actual target URL
    const url = 'https://www.walkhighlands.co.uk/Forum/munros.php?&u=262722'; 

    console.log('Navigating to target page...');
    await page.goto(url, { waitUntil: 'networkidle' });

    // Wait for the length dropdown to appear
    const dropdown = page.locator('#dt-length-0');
    await dropdown.waitFor({ state: 'visible' });

    // Select "All" from the dropdown
    await dropdown.selectOption({ label: 'All' });

    // Locate all rows in the table body and wait for them to load
    const rows = page.locator('table tbody tr');
    await rows.first().waitFor();

    const rowCount = await rows.count();
    console.log(`Total rows found: ${rowCount}`);

    const dataToSave = [];

    // Loop through each row and grab cell texts
    for (let i = 0; i < rowCount; i++) {
        const row = rows.nth(i);
        const anchorLocator = row.locator('td').nth(0).locator('a');

        // Check if the anchor tag exists in this row
        if (await anchorLocator.count() > 0) {
            const hillName = (await anchorLocator.innerText()).trim();
            const styleAttr = (await anchorLocator.getAttribute('style')) || '';

            let complete = 'unknown';
            const lowerStyle = styleAttr.toLowerCase();

            if (lowerStyle.includes('71a3d9')) {
                complete = 'No';
            } else if (lowerStyle.includes('d70000')) {
                complete = 'Yes';
            }

            dataToSave.push({ name: hillName, complete: complete });
        }
    }

    await browser.close();
    console.log(`Successfully scraped ${dataToSave.length} rows.`);
    return dataToSave;
}

module.exports = runScraper;