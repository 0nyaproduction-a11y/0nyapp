const fs=require('fs');  
let c=fs.readFileSync('src/lib/cms/form-wrapper.test.tsx','utf8').split('\n').slice(1).join('\n');  
fs.writeFileSync('src/lib/cms/form-wrapper.test.tsx',c); 
