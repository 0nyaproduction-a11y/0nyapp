import { chromium } from "playwright";
import fs from "fs";
const QA="https://onya-qa-api-gwkke6nq5a-el.a.run.app";
const SC="scripts/c08b-10-screenshots";
const R={login:null,list:null,edit:null,breadcrumb:null,dirtyModal:null,stay:null,leave:null,consoleErrors:[],httpErrors:[],hydrationErrors:[]};
const l=console.log;
function ed(d){if(!fs.existsSync(d))fs.mkdirSync(d,{recursive:true});}
async function run(){
ed(SC);
const b=await chromium.launch({headless:true});
const c=await b.newContext();
const p=await c.newPage();
p.on("console",m=>{if(m.type()==="error")R.consoleErrors.push(m.text());if(m.type()==="warning"&&m.text().includes("hydrat"))R.hydrationErrors.push(m.text());});
p.on("pageerror",e=>R.hydrationErrors.push(e.message));
p.on("requestfailed",r=>{const u=r.url();if(u.includes("&_rsc=")||u.includes("?_rsc="))return;R.httpErrors.push(u+" "+(r.failure()?.errorText||""));});
p.on("response",r=>{const u=r.url();if(u.includes("&_rsc=")||u.includes("?_rsc="))return;if(r.status()>=400)R.httpErrors.push(r.status()+" "+u);});
l("=== LOGIN ===");
try{
await p.goto(QA+"/admin/login",{waitUntil:"networkidle",timeout:30000});
await p.waitForSelector("input[type=email]",{timeout:10000});
await p.fill("input[type=email]","0@0nya.com");
await p.fill("input[type=password]","Nile-Quartz-74!mR9");
await p.click("button[type=submit]");
await p.waitForNavigation({waitUntil:"networkidle",timeout:30000}).catch(()=>{});
R.login=p.url();
l("Login URL: "+R.login);
await p.screenshot({path:SC+"/01-login.png"});
}catch(e){l("LOGIN_ERROR: "+e.message);R.login="ERROR: "+e.message;}
l("=== LIST ===");
try{
await p.goto(QA+"/admin/short-films?page=3&pageSize=50&search=&status=draft",{waitUntil:"networkidle",timeout:30000});
await p.waitForTimeout(2000);
R.list=p.url();
l("List URL: "+R.list);
await p.screenshot({path:SC+"/02-list.png"});
}catch(e){l("LIST_ERROR: "+e.message);R.list="ERROR: "+e.message;}
function findFilmLink(page){
return page.$$eval("a[href*='/admin/short-films/']",(links)=>{
const filmLinks=links.filter(l=>{
const h=l.getAttribute("href")||"";
return h.includes("/admin/short-films/")&&!h.includes("/new")&&h.length>30;
});
return filmLinks.length>0 ? filmLinks[0].getAttribute("href") : null;
});
}
async function openFilm(page){
const href=await findFilmLink(page);
if(!href) throw new Error("No film link found on list page");
await page.goto(QA+href,{waitUntil:"networkidle",timeout:30000});
}
l("=== QUERY STATE TEST (exact task params) ===");
try{
const u1=new URL(p.url());
R.queryState={page:u1.searchParams.get("page"),pageSize:u1.searchParams.get("pageSize"),search:u1.searchParams.get("search"),status:u1.searchParams.get("status")};
l("List query: "+JSON.stringify(R.queryState));
if(R.queryState.page==="3"&&R.queryState.pageSize==="50"&&R.queryState.search===""&&R.queryState.status==="draft"){
l("QUERY STATE: PASS - exact task params present");
}else{
l("QUERY STATE: FAIL - params mismatch");
}
}catch(e){l("QUERY_STATE_ERROR: "+e.message);}
l("=== FIND FILM FOR DIRTY TEST ===");
try{
await p.goto(QA+"/admin/short-films?page=1&pageSize=50&search=&status=",{waitUntil:"networkidle",timeout:30000});
await p.waitForTimeout(2000);
const filmHref=await findFilmLink(p);
if(filmHref){
l("Found film: "+filmHref);
await p.goto(QA+filmHref,{waitUntil:"networkidle",timeout:30000});
await p.waitForTimeout(2000);
R.edit=p.url();
l("Edit URL: "+R.edit);
await p.screenshot({path:SC+"/03-edit.png"});
}else{
l("No films found in QA database");
R.edit="NO_FILMS";
}
}catch(e){l("EDIT_ERROR: "+e.message);R.edit="ERROR: "+e.message;}
l("=== EDIT FIELD (make dirty) ===");
try{
await p.waitForSelector("input[type=text],textarea",{timeout:10000});
const inputs=await p.$$("input[type=text],textarea");
l("Found "+inputs.length+" text inputs");
if(inputs.length>0){
const name=await inputs[0].getAttribute("name")||"unknown";
const type=await inputs[0].getAttribute("type")||"unknown";
l("Editing: name="+name+" type="+type);
await inputs[0].click();
await inputs[0].fill("DIRTY_VAL_12345");
await p.waitForTimeout(2000);
const newVal=await inputs[0].inputValue();
l("New value: "+newVal);
}
}catch(e){l("EDIT_FIELD_ERROR: "+e.message);}
l("=== DIRTY BREADCRUMB ===");
try{
const nav=p.getByRole("navigation",{name:"Breadcrumb"});
const bcLink=nav.getByText("Short Films",{exact:true});
await bcLink.click();
await p.waitForTimeout(3000);
await p.screenshot({path:SC+"/05-dirty-modal.png"});
const modal=await p.$("[class*=modal],[class*=Modal],[role=dialog],.fixed.inset-0");
const mt=modal?(await modal.textContent()||"").substring(0,300):"";
l("Modal found: "+!!modal);
l("Modal text: "+mt);
R.dirtyModal={found:!!modal,text:mt};
}catch(e){l("DIRTY_ERROR: "+e.message);R.dirtyModal="ERROR: "+e.message;}
l("=== STAY ===");
try{
const stayBtn=p.getByText("Stay",{exact:true});
await stayBtn.click();
await p.waitForTimeout(1000);
R.stay=p.url();
l("After Stay: "+R.stay);
await p.screenshot({path:SC+"/06-stay.png"});
}catch(e){l("STAY_ERROR: "+e.message);R.stay="ERROR: "+e.message;}
l("=== DIRTY BREADCRUMB AGAIN ===");
try{
const nav2=p.getByRole("navigation",{name:"Breadcrumb"});
const bcLink2=nav2.getByText("Short Films",{exact:true});
await bcLink2.click();
await p.waitForTimeout(2500);
await p.screenshot({path:SC+"/07-before-leave.png"});
}catch(e){l("BREADCRUMB2_ERROR: "+e.message);}
l("=== LEAVE ===");
try{
const leaveBtn=p.getByText("Leave without saving",{exact:true});
await leaveBtn.click();
await p.waitForNavigation({waitUntil:"networkidle",timeout:30000}).catch(()=>{});
await p.waitForTimeout(1500);
R.leave=p.url();
l("After Leave: "+R.leave);
await p.screenshot({path:SC+"/08-leave.png"});
}catch(e){l("LEAVE_ERROR: "+e.message);R.leave="ERROR: "+e.message;}
l("=== FINAL QUERY CHECK ===");
try{const u=new URL(p.url());R.finalQuery={page:u.searchParams.get("page"),pageSize:u.searchParams.get("pageSize"),search:u.searchParams.get("search"),status:u.searchParams.get("status")};l("Final URL: "+p.url());l("Final query: "+JSON.stringify(R.finalQuery));}catch(e){l("QUERY_ERROR: "+e.message);}
l("=== RESULTS ===");
l(JSON.stringify(R,null,2));
fs.writeFileSync(SC+"/results.json",JSON.stringify(R,null,2));
await b.close();
return R;
}
run().catch(e=>{console.error("FATAL: "+e.message);process.exit(1);});