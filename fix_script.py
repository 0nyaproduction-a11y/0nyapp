import re
with open('scripts/c08b-06-runtime-acceptance.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace the duplicated and broken section with the correct one
# We look for the pattern starting from the second response handler through the goto line
pattern = r'  page\.on\("response", \(response\) => \{[^}]+\}\n  \}\);\n  page\.on\("response", \(response\) => \{[^}]+\}\n  \}\);\n(    await page\.goto\(ADMIN_HOME)'
replacement = r'  page.on("response", (response) => {\n    if (response.status() >= 400) {\n      results.httpErrors.push(`${response.status()} ${response.url()}`);\n    }\n  });\n\n  try {\n\1'

content = re.sub(pattern, replacement, content)

with open('scripts/c08b-06-runtime-acceptance.mjs', 'w', encoding='utf-8') as f:
    f.write(content)
print('Done')
