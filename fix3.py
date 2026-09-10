with open('scripts/c08b-06-runtime-acceptance.mjs', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Remove duplicate catch block lines at indices 199-201 (lines 200-202)
# We want to keep only one catch-finally sequence
# Current structure after previous fix:
# 193:     } else {
# 194:       ...
# 197:     }
# 198: (empty)
# 199:   } catch (error) {
# 200:   } catch (error) {   <-- duplicate
# 201:     console.error(...)
# 202:     await takeScreenshot(...)
# 203:   } finally {
# 204:     await browser.close();
# 205:   }

# Remove lines 200-202 (indices 199-201) which are the duplicate catch
new_lines = lines[:199] + lines[202:]

with open('scripts/c08b-06-runtime-acceptance.mjs', 'w', encoding='utf-8') as f:
    f.writelines(new_lines)
print('Lines after fix:', len(new_lines))
