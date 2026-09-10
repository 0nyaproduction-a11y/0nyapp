const fs=require('fs');  
const p='src/lib/cms/form-wrapper.test.tsx';  
let c=fs.readFileSync(p,'utf8').split('\n');  
c[0]='import { test, describe } from \'node:test\';';  
c.unshift('import assert from \'node:assert/strict\';');  
c=c.join('\n');  
c=c.replace(/vi\.fn\(\)/g,'function() {}');  
c=c.replace(/it\(/g,'test(');  
fs.writeFileSync(p,c); 
