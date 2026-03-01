
import httpx
from supabase import create_client, Client
import time

SOURCE_URL = "https://cpjcbdqqjqzxvglnagiz.supabase.co"
SOURCE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwamNiZHFxanF6eHZnbG5hZ2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY3NTE1MywiZXhwIjoyMDg3MjUxMTUzfQ.0YfMafiFB9NhPWlW76xmC9z8LWF8-LGKGPvTXQPycOU"

TARGET_URL = "https://ktmrxbovvhdusknzdnzt.supabase.co"
TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMzOTE1OCwiZXhwIjoyMDg3OTE1MTU4fQ.UYiR775iW7P-3XRUX87C6JGo-01ymN3o_YTFwt3yBMg"

s_client = create_client(SOURCE_URL, SOURCE_KEY)
t_client = create_client(TARGET_URL, TARGET_KEY)

def migrate_table(table):
    print(f"Migrating {table}...")
    try:
        data = s_client.table(table).select("*").execute().data
        if data:
            print(f"  Found {len(data)} rows. Upserting to target...")
            # We divide into batches just in case
            batch_size = 50
            for i in range(0, len(data), batch_size):
                batch = data[i:i + batch_size]
                t_client.table(table).upsert(batch).execute()
            print(f"  Migrated {len(data)} rows.")
        else:
            print(f"  No data in {table}.")
    except Exception as e:
        print(f"  Error migrating {table}: {e}")

def repair_memberships():
    print("\nRepairing team memberships for admins...")
    try:
        teams = t_client.table("teams").select("*").execute().data
        for team in teams:
            admin_id = team['admin_id']
            team_id = team['id']
            if admin_id:
                print(f"  Adding admin {admin_id} to team {team['name']} ({team_id})...")
                # Upsert to team_members
                t_client.table("team_members").upsert({
                    "team_id": team_id,
                    "user_id": admin_id,
                    "status": "admin"
                }).execute()
        print("Repair complete.")
    except Exception as e:
        print(f"  Error repairing memberships: {e}")

if __name__ == "__main__":
    tables = ["profiles", "teams", "participants", "team_members", "transactions", "transaction_splits"]
    for t in tables:
        migrate_table(t)
    
    repair_memberships()
    print("\nMigration and Repair Finished.")
