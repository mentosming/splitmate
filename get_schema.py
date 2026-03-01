import urllib2
import json

url = "https://ktmrxbovvhdusknzdnzt.supabase.co/rest/v1/"
headers = {
    "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMzkxNTgsImV4cCI6MjA4NzkxNTE1OH0.Mv5bqKx139Em9JzFsACE0ONqrUwQWpDJExCW_5BcxBI",
    "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt0bXJ4Ym92dmhkdXNrbnpkbnp0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzMzkxNTgsImV4cCI6MjA4NzkxNTE1OH0.Mv5bqKx139Em9JzFsACE0ONqrUwQWpDJExCW_5BcxBI"
}

req = urllib2.Request(url, headers=headers)
try:
    response = urllib2.urlopen(req)
    content = response.read()
    with open("schema.json", "w") as f:
        f.write(content)
    print("Schema saved to schema.json")
except Exception as e:
    print("Error: " + str(e))
