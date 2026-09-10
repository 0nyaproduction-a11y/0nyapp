const fs=require('fs');
const f='scripts/c08b-06-runtime-acceptance.mjs';
let c=fs.readFileSync(f,'utf8');
const old=`;
const new_=`;
if(c.includes(old)){c=c.replace(old,new_);fs.writeFileSync(f,c);console.log('Updated')}else{console.log('Pattern not found')}
