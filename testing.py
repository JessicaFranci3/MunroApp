import time
import pandas as pd
from playwright.sync_api import sync_playwright
import csv

url = "https://www.walkhighlands.co.uk/Forum/munros.php?&u=262722"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=False)
    page = browser.new_page()

    page.goto(url, wait_until="domcontentloaded")
    time.sleep(5)

    page.locator("#dt-length-0").select_option(label="All")

    # Locate all rows in the table body
    page.locator("table tbody tr").first.wait_for()
    rows = page.locator("table tbody tr")

    # Count how many rows are displayed
    row_count = rows.count()
    print(f"Total rows found: {row_count}")

    data_to_save = []

    # Loop through each row and grab cell texts
    for i in range(row_count):
        row = rows.nth(i)

        anchor_locator = row.locator("td").nth(0).locator("a")

        if anchor_locator.count() > 0:
            hill_name = anchor_locator.inner_text().strip()
            style_attr = anchor_locator.get_attribute("style") or ""

            complete = "unknown"
            if "71a3d9" in style_attr.lower():
                complete = "No"
            elif "d70000" in style_attr.lower() in style_attr.lower():
                complete = "Yes"
            else:
                colour = style_attr

            data_to_save.append([hill_name, complete])

    csv_filename = "hills_colour.csv"
    with open(csv_filename, mode="w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(["name", "complete"])
        writer.writerows(data_to_save)

    print(f"Successfully saved {len(data_to_save)} rows to {csv_filename}")
    browser.close()
