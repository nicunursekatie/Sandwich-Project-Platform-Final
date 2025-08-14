#!/usr/bin/env python3
import re

# Read the source PDF content
with open('attached_assets/New Sandwich Totals Scott - InputData_1755193170742.pdf', 'r') as f:
    content = f.read()

# Extract all data lines with dates, locations, and sandwich counts
lines = content.split('\n')

# Parse entries
entries = []
total_2020_groups = 0
total_all_groups = 0
total_all_sandwiches = 0

for line in lines:
    # Match pattern: Date Location Sandwiches
    # Handle cases where sandwiches are on next line due to formatting
    if re.match(r'\s*\d{1,2}/\d{1,2}/\d{4}', line):
        parts = line.split()
        if len(parts) >= 3:
            date = parts[0]
            location = ' '.join(parts[1:-1])  
            try:
                sandwiches = int(parts[-1].replace(',', ''))
                entries.append((date, location, sandwiches))
                total_all_sandwiches += sandwiches
                
                # Check if it's 2020 GROUPS entry
                if date.endswith('/2020') and 'GROUPS' in location:
                    total_2020_groups += sandwiches
                
                # Check if it's any GROUPS entry
                if 'GROUPS' in location:
                    total_all_groups += sandwiches
                    
            except ValueError:
                continue

print(f"Total entries found: {len(entries)}")
print(f"2020 GROUPS total: {total_2020_groups:,}")
print(f"All GROUPS total: {total_all_groups:,}")
print(f"Grand total from source: {total_all_sandwiches:,}")
print(f"Database total: 1,972,339")
print(f"Difference: {total_all_sandwiches - 1972339:,}")

# Show some sample entries
print(f"\nFirst 10 entries:")
for i, (date, location, sandwiches) in enumerate(entries[:10]):
    print(f"{date} {location}: {sandwiches:,}")

# Show largest entries
print(f"\nLargest 10 entries:")
sorted_entries = sorted(entries, key=lambda x: x[2], reverse=True)
for date, location, sandwiches in sorted_entries[:10]:
    print(f"{date} {location}: {sandwiches:,}")