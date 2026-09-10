with open('scripts/c08b-06-runtime-acceptance.mjs', 'r', encoding='utf-8') as f:
    content = f.read()

start = content.find('page.on("console", (msg)')
end = content.find('try {', start)
print('Start:', start)
print('End:', end)
print('---SECTION---')
print(content[start:end])
