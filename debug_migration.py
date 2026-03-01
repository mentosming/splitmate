
from supabase import create_client, Client

SOURCE_URL = "https://cpjcbdqqjqzxvglnagiz.supabase.co"
SOURCE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNwamNiZHFxanF6eHZnbG5hZ2l6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY3NTE1MywiZXhwIjoyMDg3MjUxMTUzfQ.0YfMafiFB9NhPWlW76xmC9z8LWF8-LGKGPvTXQPycOU"

TARGET_URL = "https://ktmrxbovvhdusknzdnzt.supabase.co"
TARGET_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjMzOTE1OCwiZXhwIjoyMDg3OTE1MTU4fQ.UYiR775iW7P-3XRUX87C6JGo-01ymN3o_YTFwt3yBMg"

s_client = create_client(SOURCE_URL, SOURCE_KEY)
t_client = create_client(TARGET_URL, TARGET_KEY)

EMAIL = "ming1988@gmail.com"

def debug():
    print(f"--- Checking OLD Project for {EMAIL} ---")
    old_profile = s_client.table("profiles").select("*").eq("email", EMAIL).execute().data
    if old_profile:
        old_id = old_profile[0]['id']
        print(f"Old User ID: {old_id}")
        
        # Check team memberships
        memberships = s_client.table("team_members").select("*, teams(*)").eq("user_id", old_id).execute().data
        print(f"Old Memberships: {len(memberships)}")
        for m in memberships:
            print(f" - Team: {m['teams']['name']} (ID: {m['team_id']})")
            
        # Check teams where user is admin
        owned_teams = s_client.table("teams").select("*").eq("admin_id", old_id).execute().data
        print(f"Old Owned Teams: {len(owned_teams)}")
        for ot in owned_teams:
             print(f" - Owned Team: {ot['name']} (ID: {ot['id']})")
    else:
        print("User not found in old profiles.")

    print(f"\n--- Checking NEW Project for {EMAIL} ---")
    new_profile = t_client.table("profiles").select("*").eq("email", EMAIL).execute().data
    if new_profile:
        new_id = new_profile[0]['id']
        print(f"New User ID: {new_id}")
        
        memberships = t_client.table("team_members").select("*, teams(*)").eq("user_id", new_id).execute().data
        print(f"New Memberships: {len(memberships)}")
        for m in memberships:
            print(f" - Team: {m['teams']['name']} (ID: {m['team_id']})")
            
        owned_teams = t_client.table("teams").select("*").eq("admin_id", new_id).execute().data
        print(f"New Owned Teams: {len(owned_teams)}")
        for ot in owned_teams:
             print(f" - Owned Team: {ot['name']} (ID: {ot['id']})")
    else:
        print("User not found in new profiles.")

if __name__ == "__main__":
    debug()
