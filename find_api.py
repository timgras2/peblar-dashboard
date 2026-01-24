import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Look for strings like "/api/..."
matches = re.findall(r'\"/api/[^\"]+\"', content)
print("API matches:")
for m in set(matches):
    print(m)

# Look for system matches
matches_system = re.findall(r'\"/system/[^\"]+\"', content)
print("System matches:")
for m in set(matches_system):
    print(m)

# Look for port 8080
if "8080" in content:
    print("Found 8080 in JS")
