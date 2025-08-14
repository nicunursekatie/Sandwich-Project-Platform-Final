#!/usr/bin/env python3
import re
import csv
import subprocess
from datetime import datetime

def get_database_entries():
    """Get all entries from database"""
    cmd = ['psql', '-d', 'postgresql://neondb_owner:neondb_pass@ep-green-breeze-a2fy9v2l.us-east-1.aws.neon.tech/sandwich_platform?sslmode=require', '-c', 
           "COPY (SELECT collection_date, host_name, individual_sandwiches + COALESCE(group1_count, 0) + COALESCE(group2_count, 0) as total FROM sandwich_collections ORDER BY collection_date, host_name) TO STDOUT WITH CSV HEADER;"]
    
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            print(f"Database query failed: {result.stderr}")
            return set()
        
        db_entries = set()
        reader = csv.DictReader(result.stdout.strip().split('\n'))
        for row in reader:
            date = row['collection_date']
            host = row['host_name']
            total = int(row['total'])
            db_entries.add((date, host, total))
        
        return db_entries
    except Exception as e:
        print(f"Error querying database: {e}")
        return set()

def parse_source_file():
    """Parse the source PDF file for entries"""
    try:
        with open('attached_assets/New Sandwich Totals Scott - InputData_1755193170742.pdf', 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
    except Exception as e:
        print(f"Error reading source file: {e}")
        return []

    lines = content.split('\n')
    source_entries = []
    
    # Location name mapping
    location_mapping = {
        'GROUPS': 'Groups',
        'ALPHARETTA': 'Alpharetta',
        'DUNWOODY/PTC': 'Dunwoody/PTC', 
        'E COBB/ROSWELL': 'East Cobb/Roswell',
        'EAST COBB/ROSWELL': 'East Cobb/Roswell',
        'SANDY SPRINGS': 'Sandy Springs',
        'INTOWN/DRUID HILLS': 'Intown/Druid Hills',
        'P\'TREE CORNERS': 'Peachtree Corners',
        'PEACHTREE CORNERS': 'Peachtree Corners',
        'FLOWERY BRANCH': 'Flowery Branch',
        'DECATUR': 'Decatur',
        'SNELLVILLE': 'Snellville',
        'PREVIOUS OAK GROVE': 'OG Sandwich Project',
        'PREVIOUS BUCKHEAD': 'OG Sandwich Project',
        'Collective Learning': 'Collective Learning',
        'Dacula': 'Dacula'
    }
    
    i = 0
    while i < len(lines):
        line = lines[i].strip()
        
        # Match date pattern
        date_match = re.match(r'^(\d{1,2}/\d{1,2}/\d{4})\s+(.+)', line)
        if date_match:
            date_str = date_match.group(1)
            rest_of_line = date_match.group(2).strip()
            
            # Try to extract sandwiches from this line
            sandwich_match = re.search(r'(\d{1,3}(?:,\d{3})*|\d+)$', rest_of_line)
            if sandwich_match:
                sandwiches = int(sandwich_match.group(1).replace(',', ''))
                location = rest_of_line[:sandwich_match.start()].strip()
            else:
                # Check next line for sandwich count
                if i + 1 < len(lines):
                    next_line = lines[i + 1].strip()
                    sandwich_match = re.match(r'^\s*(\d{1,3}(?:,\d{3})*|\d+)\s*$', next_line)
                    if sandwich_match:
                        sandwiches = int(sandwich_match.group(1).replace(',', ''))
                        location = rest_of_line
                        i += 1  # Skip the next line
                    else:
                        i += 1
                        continue
                else:
                    i += 1
                    continue
            
            # Clean up location name
            location = re.sub(r'\s*\([^)]*\)\s*', '', location)  # Remove parentheses
            location = re.sub(r'Numbers displayed only when not included in a host\'s count\.', '', location)
            location = location.strip()
            
            # Map to database location names
            for source_name, db_name in location_mapping.items():
                if source_name in location.upper():
                    location = db_name
                    break
            
            # Convert date format
            try:
                date_obj = datetime.strptime(date_str, '%m/%d/%Y')
                formatted_date = date_obj.strftime('%Y-%m-%d')
                source_entries.append((formatted_date, location, sandwiches))
            except ValueError:
                pass
        
        i += 1
    
    return source_entries

def find_missing_entries():
    print("Getting database entries...")
    db_entries = get_database_entries()
    print(f"Found {len(db_entries)} database entries")
    
    print("\nParsing source file...")
    source_entries = parse_source_file()
    print(f"Found {len(source_entries)} source entries")
    
    # Find missing entries
    missing_entries = []
    for source_entry in source_entries:
        date, location, sandwiches = source_entry
        
        # Look for exact match
        if source_entry not in db_entries:
            # Look for any entry with same date and location (different sandwich count)
            date_location_matches = [db_entry for db_entry in db_entries 
                                   if db_entry[0] == date and db_entry[1] == location]
            
            if not date_location_matches:
                missing_entries.append(source_entry)
            else:
                # Entry exists but with different sandwich count
                for db_entry in date_location_matches:
                    if db_entry[2] != sandwiches:
                        print(f"MISMATCH: {date} {location} - Source: {sandwiches}, DB: {db_entry[2]}")
    
    print(f"\nFound {len(missing_entries)} missing entries:")
    for date, location, sandwiches in sorted(missing_entries):
        print(f"{date} | {location} | {sandwiches}")
    
    return missing_entries

if __name__ == "__main__":
    missing_entries = find_missing_entries()