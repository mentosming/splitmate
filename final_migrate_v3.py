
import httpx
import time

S_URL = "https://cpjcbdqqjqzxvglnagiz.supabase.co/rest/v1"
S_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwamNiZHFxanF6eHZnbG5hZ2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY3NTE1MywiZXhwIjoyMDg3MjUxMTUzfQ.0YfMafiFB9NhPWlW76xmC9z8LWF8-LGKGPvTXQPycOU"

T_URL = "https://ktmrxbovvhdusknzdnzt.supabase.co/rest/v1"
T_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMzOTE1OCwiZXhwIjoyMDg3OTE1MTU4fQ.UYiR775iW7P-3XRUX87C6JGo-01ymN3o_YTFwt3yBMg"

ID_MAP = {
    "6d431ee8-e4b4-4fa3-8d1f-45d6f4367f0d": "785463f5-24bf-413d-8052-17a208889a93"
}

def map_item(item):
    if isinstance(item, dict):
        return {k: map_item(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [map_item(x) for x in item]
    elif isinstance(item, str) and item in ID_MAP:
        return ID_MAP[item]
    return item

def migrate(table):
    print(f"Migrating {table}...")
    headers_s = {"apikey": S_KEY, "Authorization": f"Bearer {S_KEY}"}
    headers_t = {"apikey": T_KEY, "Authorization": f"Bearer {T_KEY}", "Prefer": "resolution=merge-duplicates"}
    
    with httpx.Client(timeout=30.0) as client:
        try:
            # Fetch
            r = client.get(f"{S_URL}/{table}?select=*", headers=headers_s)
            r.raise_for_status()
            data = r.json()
            if not data:
                print(f"  No data for {table}")
                return
            
            # Map
            mapped = [map_item(row) for row in data]
            
            # Push
            r_post = client.post(f"{T_URL}/{table}", headers=headers_t, json=mapped)
            r_post.raise_for_status()
            print(f"  Successfully migrated {len(mapped)} rows to {table}")
        except Exception as e:
            print(f"  Error in {table}: {e}")

if __name__ == "__main__":
    tables = ["profiles", "teams", "participants", "team_members", "transactions", "transaction_splits"]
    for t in tables:
        migrate(t)
    print("\nMigration Script Finished.")
