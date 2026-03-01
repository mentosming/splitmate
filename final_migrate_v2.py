
from supabase import create_client, Client
import json

SOURCE_URL = "https://cpjcbdqqjqzxvglnagiz.supabase.co"
SOURCE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwamNiZHFxanF6eHZnbG5hZ2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY3NTE1MywiZXhwIjoyMDg3MjUxMTUzfQ.0YfMafiFB9NhPWlW76xmC9z8LWF8-LGKGPvTXQPycOU"

TARGET_URL = "https://ktmrxbovvhdusknzdnzt.supabase.co"
TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMzOTE1OCwiZXhwIjoyMDg3OTE1MTU4fQ.UYiR775iW7P-3XRUX87C6JGo-01ymN3o_YTFwt3yBMg"

s_client = create_client(SOURCE_URL, SOURCE_KEY)
t_client = create_client(TARGET_URL, TARGET_KEY)

# ID Mapping
ID_MAP = {
    "6d431ee8-e4b4-4fa3-8d1f-45d6f4367f0d": "785463f5-24bf-413d-8052-17a208889a93"
}

def map_item(item):
    """Recursively remap IDs in an item."""
    if isinstance(item, dict):
        return {k: map_item(v) for k, v in item.items()}
    elif isinstance(item, list):
        return [map_item(x) for x in item]
    elif isinstance(item, str) and item in ID_MAP:
        return ID_MAP[item]
    return item

def migrate_table(table):
    print(f"Migrating {table}...")
    try:
        data = s_client.table(table).select("*").execute().data
        if data:
            print(f"  Mapping {len(data)} rows...")
            mapped_data = [map_item(row) for row in data]
            print(f"  Upserting to target...")
            batch_size = 50
            for i in range(0, len(mapped_data), batch_size):
                batch = mapped_data[i:i + batch_size]
                t_client.table(table).upsert(batch).execute()
            print(f"  Successfully migrated {len(data)} rows.")
        else:
            print(f"  {table} has no data.")
    except Exception as e:
        print(f"  Error in {table}: {e}")

def repair_memberships():
    print("\nEnsuring admins are in team_members...")
    try:
        teams = t_client.table("teams").select("*").execute().data
        for team in teams:
            admin_id = team['admin_id']
            if admin_id and admin_id == "785463f5-24bf-413d-8052-17a208889a93":
                 print(f"  Adding/Confirming admin for team {team['name']}...")
                 t_client.table("team_members").upsert({
                     "team_id": team['id'],
                     "user_id": admin_id,
                     "status": "admin"
                 }).execute()
    except Exception as e:
        print(f"  Repair error: {e}")

if __name__ == "__main__":
    tables = ["profiles", "teams", "participants", "team_members", "transactions", "transaction_splits"]
    for t in tables:
        migrate_table(t)
    repair_memberships()
    print("\nDone.")
