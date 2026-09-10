with open('scripts/c08b-06-runtime-acceptance.mjs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove duplicate response handler (lines 51-55, which are indices 50-54)
# Line 56 (index 55) starts with spaces + await page.goto
# We need to insert '  try {' before it
# We need to insert '  }' before the catch block at line 203 (index 202)

# Remove indices 50-54 (lines 51-55)
new_lines = lines[:50] + lines[55:]

# Now 'try {' should be at index 50 (was line 51, now line 51 after removal)
# But actually after removal, index 50 is what was line 56
# Insert '  try {\n' at index 50
new_lines.insert(50, '  try {\n')

# Find catch block - it should now be at index 203 + 1 (because we inserted one line)
# Actually we removed 5 lines and added 1, so net -4. Original catch at 203 -> now at 199
catch_idx = None
for i, line in enumerate(new_lines):
    if '} catch (error) {' in line:
        catch_idx = i
        break

if catch_idx is not None:
    new_lines.insert(catch_idx, '  }\n')

with open('scripts/c08b-06-runtime-acceptance.mjs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Fixed. Catch at index:', catch_idx)
