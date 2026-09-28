/**
 * Drama and Art & Design BGE trackers: all behaviour and page layout.
 * Subject differences (names, colours, benchmarks, report wording) live in window.TRACKER_CONFIG,
 * set by drama-tracker.html and art-tracker.html before this file loads.
 */
/* global DataService, TrackerSync, TrackerColumnView, TrackerKeyboard, TrackerRoster, TrackerHome,
   TrackerPromoteArchive, TrackerReadonlyView, ReportBuilderBridge, renderMetaChips, renderMetaPanel */
/* Called from onclick/oninput attributes in the page markup: */
/* exported addClass, addPupil, addRosterPupils, applyBulk, autoSave, bulkAdd, col, delClass, delPupil, deleteArchivedClass, exportCSV, exportForFacultyHead, exportForHandover, handleImportFile, ignoreRosterPupils, openTodo, promoteClass, refreshFromClassManagement, removePupilFromTracker, renameClass, retryLoad, saveProfileField, selectBulk, sendToReportBuilder, setCls, setNote, setOvCls, setOvYG, setProfPupil, setScoreView, setTP, setThreshold, setUnitDefault, toggleColNote, toggleDefaults, toggleSidebar, viewArchivedClass */
// ══════════════════════════════════════════════════════════
// SUBJECT SETTINGS — window.TRACKER_CONFIG, set in drama-tracker.html / art-tracker.html
// ══════════════════════════════════════════════════════════
const CFG=window.TRACKER_CONFIG;
const SUBJ_HTML=String(CFG.name).replace(/&/g,'&amp;').replace(/</g,'&lt;');
const BM=CFG.benchmarks;
document.body.insertAdjacentHTML('afterbegin',trackerShellHTML());

const TPS = (window.CURRICULUM_TPS && window.CURRICULUM_TPS[CFG.subject]) || { s1: [], s2: [], s3: [] };

const PROC_DIMS   = ['creating','presenting','evaluating'];
const ATTIT_DIMS  = ['effort','behaviour','homelearning'];
const PROC_LABELS = {creating:'Creating',presenting:'Presenting',evaluating:'Evaluating'};
const ATTIT_LABELS= {effort:'Effort',behaviour:'Behaviour',homelearning:'Home Learning'};

// ══════════════════════════════════════════════════════════
// STATE
// ══════════════════════════════════════════════════════════
let S={
  pupils:{s1:{},s2:{},s3:{}},
  scores:{s1:{},s2:{},s3:{}},
  profiles:{s1:{},s2:{},s3:{}},
  archived:{s1:{},s2:{},s3:{}},
  curTP:{s1:'tp1',s2:'tp1',s3:'tp1'},
  curCls:{s1:'all',s2:'all',s3:'all'},
  defaultsOn:{}, // {s1:{tp1:false,tp2:false,...}, s2:{...}, s3:{...}} — per-unit default settings toggle
};
// Cloud saving: see tracker-sync.js. S keeps its identity; merges replace its contents in place.
const SYNC=TrackerSync.create({dataType:CFG.dataType,state:S,onStatus:renderSaveStatus,onRemoteChange:rerenderAfterRemote});
// Older Art data had one "progress" score per unit; copy it into the three process columns.
function migrateLegacyProgressScores(){
  let changed=false;
  ['s1','s2','s3'].forEach(function(yg){
    const ygScores=S.scores?.[yg]||{};
    Object.values(ygScores).forEach(function(pupilScores){
      Object.values(pupilScores||{}).forEach(function(tpScores){
        if(!tpScores||typeof tpScores!=='object')return;
        if(Object.prototype.hasOwnProperty.call(tpScores,'progress')
           && tpScores.creating===undefined
           && tpScores.presenting===undefined
           && tpScores.evaluating===undefined){
          tpScores.creating=tpScores.progress;
          tpScores.presenting=tpScores.progress;
          tpScores.evaluating=tpScores.progress;
          changed=true;
        }
      });
    });
  });
  return changed;
}
function load(){
  return SYNC.load().then(function(r){
    if(!r.ok)return r;
    ensureTrackerShape();
    if(CFG.migrateLegacyProgress&&migrateLegacyProgressScores())save();
    return r;
  });
}
function save(){return SYNC.save();}
function roBlock(){
  if(window.TrackerReadonlyView&&TrackerReadonlyView.block())return true;
  if(!SYNC.isLoaded()){toast('Your tracker has not loaded, so this change would not be saved. Tap Retry at the top.',4000);return true;}
  return false;
}
function autoSave(){SYNC.flush().then(function(r){toast(r.ok?'All changes saved':'Not saved yet. It will keep trying, and your changes are kept on this device.',3500);});}
function currentAcademicYearLabel(){
  const now=new Date();
  const start=now.getMonth()>=7?now.getFullYear():now.getFullYear()-1;
  return `${start}-${start+1}`;
}
function yearLevelToTrackerGroup(level){
  const n=Number(level);
  if(n===1)return's1';
  if(n===2)return's2';
  if(n===3)return's3';
  return null;
}
function ensureTrackerShape(){
  S.pupils=S.pupils||{s1:{},s2:{},s3:{}};
  ['s1','s2','s3'].forEach(yg=>{if(!S.pupils[yg]||typeof S.pupils[yg]!=='object')S.pupils[yg]={};});
  if(window.TrackerPromoteArchive)TrackerPromoteArchive.ensureArchivedShape(S);
}
function syncAssignedClasses(){
  if(!SYNC.isLoaded()||!window.DataService||!DataService.listMyAssignedClassesForTracker)return Promise.resolve();
  return DataService.listMyAssignedClassesForTracker({
    subject:CFG.subject,
    academicYearLabel:currentAcademicYearLabel()
  }).then(function(rows){
    ensureTrackerShape();
    let added=0;
    (rows||[]).forEach(function(row){
      const yg=yearLevelToTrackerGroup(row.year_level);
      const className=String(row.class_name||'').trim();
      if(!yg||!className)return;
      if(!S.pupils[yg][className]){
        S.pupils[yg][className]=[];
        added++;
      }
    });
    if(!added)return;
    return save().then(function(){toast(`Synced ${added} class${added!==1?'es':''} from Class Management Hub`);});
  }).catch(function(){});
}

// ── PUPILS FROM CLASS MANAGEMENT (matching in tracker-roster.js) ──
// Empty classes fill themselves; classes that already have pupils show who is missing and wait for the teacher.
let _roster={};          // {yg:{className:[roster pupil]}} for this teacher's classes in this subject this year
let _rosterLoaded=false;
function syncRosterPupils(opts){
  const manual=!!(opts&&opts.manual);
  if(!SYNC.isLoaded()||!window.DataService||!DataService.listMyClassPupilsForTracker||!window.TrackerRoster)return Promise.resolve();
  return DataService.listMyClassPupilsForTracker({subject:CFG.subject,academicYearLabel:currentAcademicYearLabel()}).then(function(rows){
    _roster=TrackerRoster.groupRows(rows);_rosterLoaded=true;
    const res=TrackerRoster.sync(S,_roster,uid);
    if(res.filled||res.linked)save();
    const waiting=rosterWaitingCount();
    if(res.filled)toast(`Added ${res.filled} pupil${res.filled!==1?'s':''} to ${res.classes} class${res.classes!==1?'es':''} from Class Management`,3500);
    else if(manual)toast(waiting?`${waiting} pupil${waiting!==1?'s are':' is'} in Class Management but not in your classes yet`:'Your classes match Class Management',3500);
  }).catch(function(){if(manual)toast('Could not read class lists from Class Management',3500);});
}
function syncFromClassManagement(opts){return syncAssignedClasses().then(function(){return syncRosterPupils(opts);});}
function rosterMissing(yg,cls){return _rosterLoaded?TrackerRoster.missing(S,_roster,yg,cls):[];}
function rosterWaitingCount(){
  let n=0;
  ['s1','s2','s3'].forEach(yg=>Object.keys(S.pupils[yg]||{}).forEach(cls=>{n+=rosterMissing(yg,cls).length;}));
  return n;
}
function rosterBannerHTML(yg,cls){
  const miss=rosterMissing(yg,cls);
  if(!miss.length)return '';
  const names=miss.slice(0,6).map(p=>escText(p.name)).join(', ')+(miss.length>6?` and ${miss.length-6} more`:'');
  const c=escAttr(cls).replace(/'/g,"\\'");
  return `<div class="roster-note"><div class="roster-note-text"><strong>${miss.length} pupil${miss.length!==1?'s':''} in Class Management ${miss.length!==1?'aren\'t':'isn\'t'} in this class yet:</strong> ${names}</div>
    <div class="roster-note-actions"><button class="btn btn-primary" onclick="addRosterPupils('${yg}','${c}')">Add ${miss.length===1?'pupil':miss.length+' pupils'}</button><button class="btn btn-ghost" onclick="ignoreRosterPupils('${yg}','${c}')">Don't add</button></div></div>`;
}
function addRosterPupils(yg,cls){
  if(roBlock())return;
  const added=TrackerRoster.addPupils(S,yg,cls,rosterMissing(yg,cls),uid);
  save();renderSetup(yg);toast(`Added ${added} pupil${added!==1?'s':''} to ${cls}`);
}
function ignoreRosterPupils(yg,cls){
  if(roBlock())return;
  TrackerRoster.ignore(S,yg,cls,rosterMissing(yg,cls).map(p=>p.rosterId));
  save();renderSetup(yg);toast('OK — they won\'t be suggested for this class again');
}
function refreshFromClassManagement(yg){
  if(roBlock())return;
  syncFromClassManagement({manual:true}).then(function(){renderSetup(yg);});
}
// A pupil the teacher removes is not suggested again for that class.
function forgetRosterPupil(yg,cls,pid){
  const p=(S.pupils[yg][cls]||[]).find(x=>x.id===pid);
  if(p&&p.rosterId&&window.TrackerRoster)TrackerRoster.ignore(S,yg,cls,[p.rosterId]);
}

// ── UTILS ──
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2)}
let _toastTimer=null;
function toast(msg,ms=2300){const t=document.getElementById('toast');t.classList.remove('has-action');t.textContent=msg;t.classList.add('show');clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>t.classList.remove('show'),ms);}
function toastAction(msg,label,fn,ms=8000){
  const t=document.getElementById('toast');t.textContent='';
  const m=document.createElement('span');m.textContent=msg;
  const b=document.createElement('button');b.type='button';b.className='toast-action';b.textContent=label;
  b.onclick=()=>{clearTimeout(_toastTimer);t.classList.remove('show');fn();};
  t.append(m,b);t.classList.add('show','has-action');clearTimeout(_toastTimer);_toastTimer=setTimeout(()=>t.classList.remove('show'),ms);
}
function closeModal(){document.getElementById('modal-overlay').classList.remove('open')}
function showModal(title,desc,okLbl,okFn,danger=true){
  document.getElementById('m-title').textContent=title;
  document.getElementById('m-desc').innerHTML=desc;
  const b=document.getElementById('m-ok');b.textContent=okLbl;b.className='btn '+(danger?'btn-danger':'btn-primary');
  b.onclick=()=>{if(okFn()!==false)closeModal();};
  document.getElementById('modal-overlay').classList.add('open');
}
function escText(s){return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');}
function escAttr(s){return String(s).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;');}
function avg(arr){const f=arr.filter(v=>v&&v>0);return f.length?(f.reduce((a,b)=>a+b,0)/f.length):null;}
function pct(a){return a?((a/4)*100):0;}
function toggleSidebar(){
  if(window.trackerIpadToggle&&window.trackerIpadToggle())return;
  const collapsed=document.body.classList.toggle('body-sidebar-collapsed');
  try{localStorage.setItem(CFG.subject+'-tracker-sidebar-collapsed',collapsed?'1':'0');}catch(e){/* storage blocked: keep going */}
  const icon=document.getElementById('sb-toggle-icon');if(icon)icon.setAttribute('d',collapsed?'M9 18l6-6-6-6':'M15 18l-6-6 6-6');
}
function initSidebarState(){try{if(localStorage.getItem(CFG.subject+'-tracker-sidebar-collapsed')==='1'){document.body.classList.add('body-sidebar-collapsed');const icon=document.getElementById('sb-toggle-icon');if(icon)icon.setAttribute('d','M9 18l6-6-6-6');}}catch(e){/* storage blocked: keep going */}}
function annotateSidebarItems(){
  document.querySelectorAll('.sb-item').forEach(function(btn){
    const label=(btn.textContent||'').replace(/\s+/g,' ').trim();
    if(!label)return;
    btn.setAttribute('data-tooltip',label);
    btn.setAttribute('title',label);
    btn.setAttribute('aria-label',label);
  });
}

// ── NAVIGATION ──
const HEADS={
  home:SUBJ_HTML+' BGE <span>Tracker</span>',
  'setup-s1':'S1 — <span>Set Up Classes</span>','setup-s2':'S2 — <span>Set Up Classes</span>','setup-s3':'S3 — <span>Set Up Classes</span>',
  'tracker-s1':'S1 '+SUBJ_HTML+' — <span>Enter Scores</span>','tracker-s2':'S2 '+SUBJ_HTML+' — <span>Enter Scores</span>','tracker-s3':'S3 '+SUBJ_HTML+' — <span>Enter Scores</span>',
  profiles:'<span>Pupil Profiles</span>',benchmarks:'<span>Benchmark Analysis</span>',overview:'<span>Progress Overview</span>',export:'<span>Export &amp; Send</span>',
};
function nav(id){
  if(window.trackerIpadClose)window.trackerIpadClose();
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b=>b.classList.remove('active'));
  const panel=document.getElementById('panel-'+id);if(!panel)return;
  panel.classList.add('active');
  const btn=document.querySelector(`.sb-item[data-panel="${id}"]`);if(btn)btn.classList.add('active');
  document.getElementById('tb-heading').innerHTML=HEADS[id]||id;
  if(id==='home')renderHome();
  else if(id.startsWith('setup-'))renderSetup(id.replace('setup-',''));
  else if(id.startsWith('tracker-'))renderTracker(id.replace('tracker-',''));
  else if(id==='profiles')renderProfiles();
  else if(id==='benchmarks')renderBenchmarks();
  else if(id==='overview'){_ovYG='all';_ovCls='all';renderOverview();}
  else if(id==='export')renderExportPreview();
}

// ══════════════════════════════════════════════════════════
// HOME
// ══════════════════════════════════════════════════════════
function renderHome(){
  let total=0;
  ['s1','s2','s3'].forEach(yg=>{
    let t=0;Object.values(S.pupils[yg]).forEach(a=>t+=a.length);
    const el=document.getElementById('hm-'+yg);
    if(el)el.textContent=`${Object.keys(S.pupils[yg]).length} class${Object.keys(S.pupils[yg]).length!==1?'es':''} · ${t} pupil${t!==1?'s':''}`;
    total+=t;
  });
  const allScores=Object.values(S.scores).flatMap(yg=>Object.values(yg).flatMap(p=>Object.values(p).flatMap(tp=>PROC_DIMS.map(d=>tp[d]).filter(Boolean))));
  const el=document.getElementById('home-stats');
  if(el)el.innerHTML=`
    <div><div class="hs-num">${total}</div><div class="hs-label">Pupils Registered</div></div>
    <div><div class="hs-num">${allScores.length}</div><div class="hs-label">Process Scores</div></div>
  `;
  const todo=document.getElementById('home-todo');
  if(todo&&window.TrackerHome)todo.innerHTML=TrackerHome.render(TrackerHome.build({S,TPS,dims:[...PROC_DIMS,...ATTIT_DIMS],rosterMissing}));
}
// From a To do item: open that class and unit, on the first column with gaps.
function openTodo(yg,cls,tpId,dim){
  S.curCls[yg]=cls;
  if(tpId)S.curTP[yg]=tpId;
  if(dim)_colDim[yg]=dim;
  nav('tracker-'+yg);
  const area=document.getElementById('score-area-'+yg);
  if(!area)return;
  area.scrollIntoView({block:'start'});
  // First pupil without a score in that column, in either view
  const cells=[...area.querySelectorAll(dim?`[data-score-cell][data-dim="${dim}"]`:'[data-score-cell]')];
  const gap=cells.find(c=>!c.querySelector('.active'));
  if(gap&&!document.documentElement.dataset.ipad)gap.focus();
}

// ══════════════════════════════════════════════════════════
// SETUP
// ══════════════════════════════════════════════════════════
function renderSetup(yg){
  const el=document.getElementById('panel-setup-'+yg);
  const classes=Object.keys(S.pupils[yg]).sort();
  const addClassForm=`
        <div class="form-row">
          <div class="form-group"><label class="form-label">Class name</label><input class="form-input" id="nc-${yg}" placeholder="e.g. 1A1" /></div>
          <button class="btn btn-primary" onclick="addClass('${yg}')">Add class</button>
        </div>`;
  el.innerHTML=`
    <div class="sc" style="margin-bottom:1.2rem">
      <div class="sc-header"><div><div class="sc-title">${yg.toUpperCase()} ${SUBJ_HTML}</div><div class="sc-sub">${classes.length?'Add a pupil in the class below.':'Add the first class, then the pupil names.'}</div></div><div style="display:flex;gap:.4rem;flex-wrap:wrap"><button class="btn btn-ghost" onclick="refreshFromClassManagement('${yg}')">Update from Class Management</button><input type="file" id="importFile-${yg}" accept=".json" style="display:none" onchange="handleImportFile(event)"><button class="btn btn-ghost" onclick="document.getElementById('importFile-${yg}').click()">Import from teacher</button></div></div>
      <div class="sc-body">
        ${classes.length?`<details class="task-more"><summary>Add another class</summary><div class="task-more-body">${addClassForm}</div></details>`:addClassForm}
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(295px,1fr));gap:.95rem">
      ${classes.length===0?`<div class="sc"><div class="sc-body"><div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>No classes yet — add one above.</div></div></div>`:''}
      ${classes.map(c=>classCard(yg,c)).join('')}
    </div>
    ${renderArchivedSection(yg)}
  `;
}
function renderArchivedSection(yg){
  ensureTrackerShape();
  const archived=(window.TrackerPromoteArchive?TrackerPromoteArchive.archivedClassNames(S,yg):[]);
  if(!archived.length)return '';
  return `<details class="archived-section" style="margin-top:1.5rem">
    <summary style="cursor:pointer;font-weight:600;font-size:.85rem;color:var(--text2);padding:.35rem 0">Archived classes (${archived.length}) — promoted or retired, data preserved</summary>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(295px,1fr));gap:.95rem;margin-top:.75rem">
      ${archived.map(c=>archivedClassCard(yg,c)).join('')}
    </div>
  </details>`;
}
function archivedClassCard(yg,cls){
  const entry=(S.archived&&S.archived[yg]&&S.archived[yg][cls])||{};
  const pupils=entry.pupils||[];
  const promoted=entry.promotedTo;
  const date=entry.archivedAt?new Date(entry.archivedAt).toLocaleDateString():'';
  const promotedLbl=promoted?`Promoted to ${String(promoted.yearGroup||'').toUpperCase()} — ${promoted.className||''}`:'Archived';
  return `<div class="sc" style="border-style:dashed;opacity:.94" data-arch-cls="${escAttr(cls)}">
    <div class="sc-header">
      <div><div class="sc-title">${cls}</div><div class="sc-sub">${pupils.length} pupil${pupils.length!==1?'s':''} · ${promotedLbl}${date?` · ${date}`:''}</div></div>
      <div style="display:flex;gap:.32rem;flex-wrap:wrap">
        <button class="btn btn-ghost" style="font-size:.61rem;padding:.26rem .58rem" onclick="viewArchivedClass('${yg}',this.closest('.sc').dataset.archCls)">View</button>
        <button class="btn btn-danger" style="font-size:.61rem;padding:.26rem .58rem" onclick="deleteArchivedClass('${yg}',this.closest('.sc').dataset.archCls)">Delete</button>
      </div>
    </div>
    <div class="sc-body"><p style="font-size:.72rem;color:var(--text3);margin:0">Read-only archive. Prior-year scores also appear on promoted pupils' profiles in the new year group.</p></div>
  </div>`;
}
function viewArchivedClass(yg,cls){
  if(!cls)return;
  const entry=(S.archived&&S.archived[yg]&&S.archived[yg][cls])||{};
  const pupils=entry.pupils||[];
  const promoted=entry.promotedTo;
  const scored=pupils.filter(p=>entry.scores&&entry.scores[p.id]&&Object.keys(entry.scores[p.id]).length).length;
  const list=pupils.map((p,i)=>`<div style="font-size:.78rem;padding:.2rem 0">${String(i+1).padStart(2,'0')} ${p.name}</div>`).join('')||'<p style="font-size:.78rem;color:var(--text3)">No pupils recorded.</p>';
  const promotedNote=promoted?`<p style="font-size:.78rem;color:var(--text2);margin:0 0 .75rem">Active tracking continues in <strong>${String(promoted.yearGroup||'').toUpperCase()} — ${promoted.className||''}</strong>. Open pupil profiles there to see this year's snapshot alongside new scores.</p>`:'';
  showModal(`Archived: ${cls}`,`${promotedNote}<p style="font-size:.78rem;color:var(--text2);margin:0 0 .6rem">${pupils.length} pupils · ${scored} with tracking data</p><div style="max-height:220px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:.5rem .75rem">${list}</div>`,'Close',()=>true,false);
}
function deleteArchivedClass(yg,cls){
  if(roBlock())return;
  if(!cls||!window.TrackerPromoteArchive)return;
  const pupils=((S.archived&&S.archived[yg]&&S.archived[yg][cls]&&S.archived[yg][cls].pupils)||[]).length;
  showModal(`Delete archived "${cls}"?`,`This permanently removes ${pupils} archived pupil${pupils!==1?'s':''} and all stored ${yg.toUpperCase()} scores for this class. Cannot be undone.`,'Delete',()=>{
    TrackerPromoteArchive.deleteArchivedClass(S,yg,cls);
    save();renderSetup(yg);toast('Archived class deleted');
  });
}
function classCard(yg,cls){
  const pupils=S.pupils[yg][cls]||[];
  return `<div class="sc" data-cls="${String(cls).replace(/"/g,'&quot;')}">
    <div class="sc-header">
      <div><div class="sc-title">${cls}</div><div class="sc-sub">${pupils.length} pupil${pupils.length!==1?'s':''}</div></div>
      <details class="task-more class-more">
        <summary>More</summary>
        <div class="class-more-menu">
          ${pupils.length?`<button class="btn btn-ghost" onclick="bulkAdd('${yg}','${cls}')">Bulk add</button>`:''}
          <button class="btn btn-ghost" onclick="renameClass('${yg}',this.closest('.sc').dataset.cls)">Rename</button>
          ${yg!=='s3'?`<button class="btn btn-ghost" onclick="promoteClass('${yg}',this.closest('.sc').dataset.cls)">Promote</button>`:''}
          <button class="btn btn-ghost" onclick="exportForHandover('${yg}',this.closest('.sc').dataset.cls)">Export</button>
          <button class="btn btn-danger" onclick="delClass('${yg}','${cls}')">Delete</button>
        </div>
      </details>
    </div>
    <div class="sc-body">
      ${rosterBannerHTML(yg,cls)}
      <div class="form-row" style="margin-bottom:.65rem">
        <div class="form-group"><input class="form-input" id="np-${yg}-${cls.replace(/\s/g,'_')}" placeholder="Pupil name" onkeydown="if(event.key==='Enter')addPupil('${yg}','${cls}')" /></div>
        <button class="btn btn-primary" onclick="addPupil('${yg}','${cls}')">Add</button>
        ${pupils.length?'':`<button class="btn btn-ghost" onclick="bulkAdd('${yg}','${cls}')">Bulk add</button>`}
      </div>
      <div class="pupil-list">
        ${pupils.length===0?`<div class="empty-s" style="padding:.9rem;font-size:.74rem">No pupils yet.</div>`:''}
        ${pupils.map((p,i)=>`<div class="pupil-row"><span class="p-num">${String(i+1).padStart(2,'0')}</span><span class="p-name">${p.name}</span><button class="p-del" onclick="delPupil('${yg}','${cls}','${p.id}')" title="Remove"><svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`).join('')}
      </div>
    </div>
  </div>`;
}
function addClass(yg){
  if(roBlock())return;
  const inp=document.getElementById('nc-'+yg);const n=inp.value.trim();
  if(!n){toast('Enter a class name');return;}
  if(S.pupils[yg][n]){toast('Already exists');return;}
  S.pupils[yg][n]=[];save();inp.value='';renderSetup(yg);toast(`"${n}" added`);
}
function delClass(yg,cls){
  if(roBlock())return;
  showModal(`Delete "${cls}"?`,`This removes all ${(S.pupils[yg][cls]||[]).length} pupils and their scores. Cannot be undone.`,'Delete',()=>{
    (S.pupils[yg][cls]||[]).forEach(p=>{delete S.scores[yg][p.id];if(S.profiles[yg])delete S.profiles[yg][p.id];});
    delete S.pupils[yg][cls];save();renderSetup(yg);toast('Class deleted');
  });
}
function renameClass(yg,cls){
  if(roBlock())return;
  if(!cls)return;
  showModal(`Rename "${cls}"`,`<label class="form-label">Class name</label><input class="form-input" id="rename-cls-inp" value="${escAttr(cls)}" />`,'Rename',()=>{
    const inp=document.getElementById('rename-cls-inp');const newCls=(inp?.value||'').trim();
    if(!newCls){toast('Enter a class name');return false;}
    if(newCls===cls){toast('Name unchanged');return false;}
    if(S.pupils[yg][newCls]){toast('A class with that name already exists');return false;}
    S.pupils[yg][newCls]=S.pupils[yg][cls];delete S.pupils[yg][cls];save();renderSetup(yg);toast(`Renamed to "${newCls}"`);
  },false);
  setTimeout(()=>{const inp=document.getElementById('rename-cls-inp');if(inp){inp.focus();inp.select();}},50);
}
function addPupil(yg,cls){
  if(roBlock())return;
  const k=`np-${yg}-${cls.replace(/\s/g,'_')}`;const inp=document.getElementById(k);
  const n=inp.value.trim();if(!n){toast('Enter a name');return;}
  S.pupils[yg][cls].push({id:uid(),name:n});save();inp.value='';renderSetup(yg);toast(`Added: ${n}`);
}
function delPupil(yg,cls,pid){
  if(roBlock())return;
  const pupil=(S.pupils[yg][cls]||[]).find(p=>p.id===pid);
  const name=pupil?escAttr(pupil.name):'this pupil';
  const scored=Object.keys(S.scores[yg]?.[pid]||{}).length;
  showModal(`Remove ${name}?`,`This removes <strong>${name}</strong> from <strong>${escAttr(cls)}</strong>${scored?` and deletes their scores for ${scored} unit${scored!==1?'s':''}`:''}. This cannot be undone.`,'Remove pupil',()=>{
    forgetRosterPupil(yg,cls,pid);
    S.pupils[yg][cls]=S.pupils[yg][cls].filter(p=>p.id!==pid);
    delete S.scores[yg][pid];if(S.profiles[yg])delete S.profiles[yg][pid];save();renderSetup(yg);toast('Pupil removed');
  });
}
let _bYG='',_bCLS='';
function bulkAdd(yg,cls){
  if(roBlock())return;
  _bYG=yg;_bCLS=cls;
  showModal(`Bulk Add to ${cls}`,'Paste names — one per line:<br><br><textarea class="bulk-ta" id="bta" placeholder="First Last&#10;First Last&#10;First Last"></textarea><div class="helper">Duplicates skipped automatically.</div>','Add Pupils',processBulk,false);
}
function processBulk(){
  if(roBlock())return;
  const ta=document.getElementById('bta');if(!ta)return;
  const existing=(S.pupils[_bYG][_bCLS]||[]).map(p=>p.name.toLowerCase());
  let added=0;
  ta.value.split('\n').map(l=>l.trim()).filter(Boolean).forEach(n=>{
    if(!existing.includes(n.toLowerCase())){S.pupils[_bYG][_bCLS].push({id:uid(),name:n});existing.push(n.toLowerCase());added++;}
  });
  save();renderSetup(_bYG);toast(`Added ${added} pupil${added!==1?'s':''}`);
}

// ── PROMOTE CLASS (copy to next year, keep data) ──
function suggestPromotedClassName(cls,yg,nextYg){
  const toLabel=nextYg.toUpperCase();
  if(/\bS1\b/i.test(cls)&&nextYg==='s2')return cls.replace(/\bS1\b/gi,toLabel);
  if(/\bS2\b/i.test(cls)&&nextYg==='s3')return cls.replace(/\bS2\b/gi,toLabel);
  if(/\bs1\b/i.test(cls)&&nextYg==='s2')return cls.replace(/\bs1\b/gi,nextYg);
  if(/\bs2\b/i.test(cls)&&nextYg==='s3')return cls.replace(/\bs2\b/gi,nextYg);
  return S.pupils[nextYg][cls]?cls+' (promoted)':cls;
}
function promotePupilChecklistHtml(pupils){
  const rows=pupils.map(p=>`<label style="display:flex;align-items:center;gap:.45rem;font-size:.78rem;cursor:pointer"><input type="checkbox" class="promote-pupil-cb" data-pid="${escAttr(p.id)}" checked style="accent-color:var(--accent)"/><span>${escAttr(p.name)}</span></label>`).join('');
  return `<label class="form-label" style="margin-top:.65rem">Pupils continuing</label><p style="font-size:.72rem;color:var(--text3);margin:0 0 .4rem">Uncheck pupils not continuing in this subject. Their scores remain in the archived class.</p><div style="max-height:180px;overflow:auto;border:1px solid var(--border);border-radius:8px;padding:.5rem .65rem;display:flex;flex-direction:column;gap:.35rem">${rows}</div>`;
}
function continuingPupilIdsFromPromoteModal(){
  return Array.from(document.querySelectorAll('.promote-pupil-cb:checked')).map(cb=>cb.dataset.pid).filter(Boolean);
}
function promoteClass(yg,cls){
  if(roBlock())return;
  if(!cls||!window.TrackerPromoteArchive)return;
  const nextYg=yg==='s1'?'s2':yg==='s2'?'s3':null;
  if(!nextYg){toast('S3 is the highest year group');return;}
  const pupils=S.pupils[yg][cls]||[];
  if(!pupils.length){toast('No pupils to promote');return;}
  const defaultTarget=suggestPromotedClassName(cls,yg,nextYg);
  showModal(`Promote "${cls}" to ${nextYg.toUpperCase()}?`,`${pupils.length} pupils in this class. Checked pupils move to ${nextYg.toUpperCase()} with fresh TP columns; prior-year scores are saved as a read-only snapshot on each promoted pupil's profile. The ${yg.toUpperCase()} class is archived with all pupils (including those not continuing).<br><br><label class="form-label">Class name in ${nextYg.toUpperCase()}</label><input class="form-input" id="promote-cls-inp" value="${escAttr(defaultTarget)}" />${promotePupilChecklistHtml(pupils)}`,'Promote',()=>{
    const inp=document.getElementById('promote-cls-inp');const targetCls=(inp?.value||'').trim();
    if(!targetCls){toast('Enter a class name');return false;}
    if(S.pupils[nextYg][targetCls]){toast(`"${targetCls}" already exists in ${nextYg.toUpperCase()}`);return false;}
    const continuingPupilIds=continuingPupilIdsFromPromoteModal();
    if(!continuingPupilIds.length){toast('Select at least one pupil to promote');return false;}
    let result;
    try{
      result=TrackerPromoteArchive.promoteClass(S,{fromYearGroup:yg,className:cls,toYearGroup:nextYg,toClassName:targetCls,uid:uid,includeSnapshot:true,archiveSource:true,continuingPupilIds:continuingPupilIds});
    }catch(e){toast(e.message||'Promote failed');return false;}
    save();renderSetup(yg);nav('setup-'+nextYg);
    const excluded=(result.excludedCount||0)>0?` (${result.excludedCount} not continuing — kept in archive only)`:'' ;
    toast(`Promoted ${result.pupilCount} pupil${result.pupilCount!==1?'s':''} to ${nextYg.toUpperCase()} as "${targetCls}"${excluded} — ${yg.toUpperCase()} class archived`);
  },false);
  setTimeout(()=>{const inp=document.getElementById('promote-cls-inp');if(inp){inp.focus();inp.select();}},50);
}

// ── EXPORT FOR HANDOVER ──
function exportForHandover(yg,cls){
  if(!cls)return;
  const pupils=S.pupils[yg][cls]||[];
  const scores={};const profiles={};
  pupils.forEach(p=>{if(S.scores[yg][p.id])scores[p.id]=S.scores[yg][p.id];if(S.profiles[yg]?.[p.id])profiles[p.id]=S.profiles[yg][p.id];});
  const exportData={subject:CFG.subject,version:1,exportDate:new Date().toISOString(),yearGroup:yg,className:cls,pupils:pupils.map(p=>({id:p.id,name:p.name})),scores,profiles};
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${CFG.filePrefix}_${yg.toUpperCase()}_${cls.replace(/[^a-z0-9]/gi,'_')}_handover.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
  toast('Downloaded — give file to receiving teacher');
}

// ── IMPORT FROM HANDOVER ──
function handleImportFile(ev){
  if(roBlock())return;
  const f=ev.target.files[0];if(!f)return;
  const r=new FileReader();r.onload=()=>{
    try{
      const d=JSON.parse(r.result);
      if(!d.subject||!d.yearGroup||!d.className||!Array.isArray(d.pupils)){toast('Invalid handover file');return;}
      if(d.subject!==CFG.subject){toast(`This file is from the ${d.subject==='art'?'Art':d.subject==='drama'?'Drama':'other'} tracker. Import it there instead.`);return;}
      const yg=d.yearGroup;if(!['s1','s2','s3'].includes(yg)){toast('Invalid year group');return;}
      const targetCls=d.className;
      // Find existing class to replace (exact match or previous "imported" variant) — refresh instead of duplicate
      const existingCls=Object.keys(S.pupils[yg]||{}).find(c=>c===targetCls||c.startsWith(targetCls+' (imported '));
      const applyImport=()=>{
      if(existingCls){
        (S.pupils[yg][existingCls]||[]).forEach(p=>{if(S.scores[yg])delete S.scores[yg][p.id];if(S.profiles[yg])delete S.profiles[yg][p.id];});
        delete S.pupils[yg][existingCls];
      }
      const pidMap={};const newPupils=d.pupils.map(p=>{const np={id:uid(),name:p.name};pidMap[p.id]=np.id;return np;});
      S.pupils[yg][targetCls]=newPupils;
      if(!S.scores[yg])S.scores[yg]={};
      Object.entries(d.scores||{}).forEach(([oldPid,sc])=>{const newPid=pidMap[oldPid];if(newPid)S.scores[yg][newPid]=sc;});
      if(!S.profiles[yg])S.profiles[yg]={};
      Object.entries(d.profiles||{}).forEach(([oldPid,prof])=>{const newPid=pidMap[oldPid];if(newPid)S.profiles[yg][newPid]=prof;});
      save();renderSetup(yg);toast(existingCls?`Replaced "${targetCls}" — ${newPupils.length} pupils`:`Imported "${targetCls}" — ${newPupils.length} pupils`);
      };
      if(existingCls){
        const have=(S.pupils[yg][existingCls]||[]).length;
        showModal(`Replace ${escAttr(existingCls)}?`,`You already have <strong>${escAttr(existingCls)}</strong> in ${yg.toUpperCase()} with ${have} pupil${have!==1?'s':''}. Importing replaces that class, its pupils and all their scores and notes with the ${d.pupils.length} pupil${d.pupils.length!==1?'s':''} in this file. This cannot be undone.`,'Replace class',applyImport);
      }else applyImport();
    }catch(e){toast('Could not parse file');}
  };
  r.readAsText(f);ev.target.value='';
}

// ══════════════════════════════════════════════════════════
// TRACKER
// ══════════════════════════════════════════════════════════

// Tracks which bulk score is selected per dimension for the current view
let _bulkSel = {}; // {dim: value|null}

function renderTracker(yg){
  _bulkSel = {};
  const el=document.getElementById('panel-tracker-'+yg);
  const tps=TPS[yg];const tpId=S.curTP[yg];
  const tp=tps.find(t=>t.id===tpId)||tps[0];
  const bms=BM[yg][tpId]||[];
  const classes=Object.keys(S.pupils[yg]).sort();
  const curCls=S.curCls[yg];
  let pupils=[];
  if(curCls==='all')classes.forEach(c=>(S.pupils[yg][c]||[]).forEach(p=>pupils.push({...p,cls:c})));
  else(S.pupils[yg][curCls]||[]).forEach(p=>pupils.push({...p,cls:curCls}));
  const totalAll=classes.reduce((a,c)=>a+(S.pupils[yg][c]||[]).length,0);

  const tabsHTML=tps.map(t=>{
    const hasData=classes.some(c=>(S.pupils[yg][c]||[]).some(p=>PROC_DIMS.some(d=>S.scores[yg]?.[p.id]?.[t.id]?.[d]>0)));
    const unitOn=unitHasDefaultFill(yg,t.id);
    return `<button class="tp-tab ${t.id===tpId?'active':''}" onclick="setTP('${yg}','${t.id}')">${t.label}: ${t.unit}${unitOn?'<span class="tp-def">On</span>':''}${hasData?'<span class="has-dot"></span>':''}</button>`;
  }).join('');

  const filterHTML=`
    <button class="cf-btn ${curCls==='all'?'active':''}" onclick="setCls('${yg}','all')">All (${totalAll})</button>
    ${classes.map(c=>`<button class="cf-btn ${curCls===c?'active':''}" onclick="setCls('${yg}','${c}')">${c} (${(S.pupils[yg][c]||[]).length})</button>`).join('')}
  `;

  const bmHTML=bms.map(b=>`
    <div class="bm-item">
      <span class="bm-proc bm-${b.proc}">${b.proc==='cr'?'Creating':b.proc==='pr'?'Presenting':'Evaluating'}</span>
      <span class="bm-text">${b.text}</span>
    </div>`).join('');

  const metaHTML=(tp.meta_skills&&tp.meta_skills.length)?`
        <div class="bm-section-title" style="margin-top:.65rem">SDS Meta-Skills</div>
        <div class="tp-meta-chips">${typeof renderMetaChips==='function'?renderMetaChips(tp.meta_skills,'tp-meta-chip'):tp.meta_skills.join(', ')}</div>
        <details class="tp-meta-details"><summary>How addressed in this unit</summary>
          ${typeof renderMetaPanel==='function'?renderMetaPanel(tp.meta_skills,tp.meta_notes):''}
        </details>`:'';

  const modeMap={Say:'mc-say',Write:'mc-write',Make:'mc-make',Do:'mc-do'};

  // Summary
  const procAvgs={};
  PROC_DIMS.forEach(d=>{procAvgs[d]=avg(pupils.map(p=>S.scores[yg]?.[p.id]?.[tpId]?.[d]).filter(v=>v>0));});
  const attitAvgs={};
  ATTIT_DIMS.forEach(d=>{attitAvgs[d]=avg(pupils.map(p=>S.scores[yg]?.[p.id]?.[tpId]?.[d]).filter(v=>v>0));});

  const dimConfigs=[
    {d:'creating',lbl:'Creating',col:'#7c3aed',avg:procAvgs.creating},
    {d:'presenting',lbl:'Presenting',col:'#0369a1',avg:procAvgs.presenting},
    {d:'evaluating',lbl:'Evaluating',col:'#0f766e',avg:procAvgs.evaluating},
    {d:'effort',lbl:'Effort',col:'#92400e',avg:attitAvgs.effort},
    {d:'behaviour',lbl:'Behaviour',col:'#be185d',avg:attitAvgs.behaviour},
    {d:'homelearning',lbl:'Home Learning',col:'#b45309',avg:attitAvgs.homelearning},
  ];

  const sumHTML=dimConfigs.map(({lbl,col,avg:a})=>`
    <div class="sum-c">
      <div class="sum-n" style="color:${col}">${a?a.toFixed(1):'—'}</div>
      <div class="sum-l">${lbl}</div>
    </div>`).join('');

  // Baseline scores apply only to this unit, and only while its own default is on.
  const defaultsEnabled=isDefaultsOn(yg,tpId);
  if(defaultsEnabled && applyUnitDefaults(yg,tpId)) save();
  const unitFilled=unitHasDefaultFill(yg,tpId);
  const scoredNow=pupils.filter(p=>PROC_DIMS.some(d=>S.scores[yg]?.[p.id]?.[tpId]?.[d]>0)).length;

  // Bulk-apply toolbar — one score selector per dimension
  const allDims=[...PROC_DIMS,...ATTIT_DIMS];
  const bulkColsHTML=allDims.map((d,i)=>{
    const lbl={creating:'Creating',presenting:'Presenting',evaluating:'Evaluating',effort:'Effort',behaviour:'Behaviour',homelearning:'Home Learning'}[d];
    const btns=[1,2,3,4].map(n=>`<button class="bulk-btn s${n}" id="bb-${yg}-${d}-${n}" onclick="selectBulk('${yg}','${d}',${n})">${n}</button>`).join('');
    return `${i===3?'<div class="bulk-divider"></div>':''}<div class="bulk-col"><span class="bulk-col-lbl">${lbl}</span>${btns}</div>`;
  }).join('');

  const unitChecksHTML=tps.map(t=>{
    const filled=unitHasDefaultFill(yg,t.id);
    return `<label class="unit-def-check ${t.id===tpId?'is-current':''}"><input type="checkbox" ${filled?'checked':''} onchange="setUnitDefault('${yg}','${t.id}',this.checked)"> ${t.label}</label>`;
  }).join('');

  const scoreView=TrackerColumnView.getMode();
  const trackerCtrlHTML=`
    <div class="tracker-ctrl">
      <div style="flex:1">
        <div class="tp-tabs">${tabsHTML}</div>
      </div>
      <div class="tracker-meta">${scoredNow} / ${pupils.length} scored</div>
    </div>
  `;

  const bulkHTML=pupils.length===0?'':`
    <details class="task-more">
      <summary>Score the whole class</summary>
      <div class="task-more-body">
        <div class="bulk-bar">
          <span class="bulk-bar-label">Set all to</span>
          ${bulkColsHTML}
          <label class="bulk-keep"><input type="checkbox" id="bulk-keep-${yg}" checked> Keep scores already entered</label>
          <button class="bulk-apply-btn" onclick="applyBulk('${yg}','${tpId}')">Apply to all visible pupils</button>
        </div>
      </div>
    </details>`;

  const tableHTML=pupils.length===0?`<div class="empty-s" style="padding:2rem"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>No pupils. <span style="color:var(--accent);cursor:pointer" onclick="nav('setup-${yg}')">Set up classes first</span></div>`:`
    <div class="tbl-wrap">
      <table class="tbl">
        <thead>
          <tr>
            <th rowspan="2" style="width:32px;padding:.6rem .4rem"></th>
            <th rowspan="2" style="min-width:148px">Pupil</th>
            <th rowspan="2" style="min-width:140px">Notes</th>
            <th colspan="3" style="text-align:center;border-bottom:1px solid rgba(255,255,255,.07)" class="grp-start">CfE Process Dimensions</th>
            <th colspan="3" style="text-align:center;border-bottom:1px solid rgba(255,255,255,.07)" class="grp-start">Attitudinal</th>
          </tr>
          <tr>
            <th class="sc-col h-cr grp-start">Creating</th>
            <th class="sc-col h-pr">Presenting</th>
            <th class="sc-col h-ev">Evaluating</th>
            <th class="sc-col h-ef grp-start">Effort</th>
            <th class="sc-col h-bh">Behaviour</th>
            <th class="sc-col h-hl">Home Learning</th>
          </tr>
        </thead>
        <tbody>
          ${pupils.map(p=>{
            const sc=S.scores[yg]?.[p.id]?.[tpId]||{};
            return `<tr data-pid="${p.id}">
              <td style="text-align:center;padding:.4rem .4rem">
                <button class="row-del" onclick="removePupilFromTracker('${yg}','${p.cls||curCls}','${p.id}')" title="Remove ${p.name}">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                </button>
              </td>
              <td><div class="p-name-th">${p.name}</div><div class="p-cls-th">${p.cls}</div></td>
              <td><textarea class="notes-inp" placeholder="Notes…" oninput="setNote('${yg}','${p.id}','${tpId}',this.value)">${escText(sc.notes)}</textarea></td>
              ${PROC_DIMS.map((d,i)=>`<td class="${i===0?'grp-start':''}">${scoreCell(yg,p.id,tpId,d,sc[d])}</td>`).join('')}
              ${ATTIT_DIMS.map((d,i)=>`<td class="${i===0?'grp-start':''}">${scoreCell(yg,p.id,tpId,d,sc[d])}</td>`).join('')}
            </tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>`;

  el.innerHTML=`
    <div class="cls-filter">${filterHTML}</div>
    ${trackerCtrlHTML}
    <details class="task-more">
      <summary>Unit detail</summary>
      <div class="task-more-body">
        <div class="sum-strip">${sumHTML}</div>
        <div class="unit-def-row">
          <span class="unit-def-label">Default on</span>
          ${unitChecksHTML}
        </div>
        <div class="tp-info">
          <div>
            <div class="tp-unit">${tp.label}: ${tp.unit}</div>
            <div class="tp-assessed">${tp.assessed}</div>
            <div class="tp-eos">${tp.eos.map(e=>`<span class="eo-chip">${e}</span>`).join('')}</div>
            <div class="bm-section-title">Benchmarks assessed this unit</div>
            <div class="bm-list">${bmHTML||'<span style="font-size:.7rem;color:rgba(255,255,255,.25)">No benchmarks.</span>'}</div>
            ${metaHTML}
          </div>
          <div class="tp-right">
            <div class="defaults-toggle-wrap">
              <span class="defaults-toggle-lbl">This unit only</span>
              <button class="defaults-toggle-btn ${unitFilled?'on':''}" onclick="setUnitDefault('${yg}','${tpId}',${!unitFilled})" title="${unitFilled?'Baseline is on for '+tp.label+' only. Uncheck to clear it.':'Off for '+tp.label+'. Tick it when you are ready to track this unit.'}">
                <span class="defaults-toggle-slider"></span>
              </button>
              <span class="defaults-toggle-state">${unitFilled?'On':'Off'}</span>
            </div>
            <div class="defaults-unit-note">${unitFilled?tp.label+' still has the default baseline (process 3, attitude 4). Uncheck this unit to clear it.':tp.label+' is not tracked yet. Tick it when you are ready to score this unit.'}</div>
            <div class="tp-timing">${tp.timing}</div>
            <div class="mode-chips">${tp.modes.map(m=>`<span class="mc ${modeMap[m]||''}">${m}</span>`).join('')}</div>
          </div>
        </div>
      </div>
    </details>
    ${bulkHTML}
    ${pupils.length?`<div class="score-view-bar"><span class="kbd-hint">Keyboard: <kbd>↑</kbd><kbd>↓</kbd> pupil · <kbd>←</kbd><kbd>→</kbd> column · <kbd>1</kbd>–<kbd>4</kbd> score · <kbd>0</kbd> N/A · <kbd>Delete</kbd> clear</span>${TrackerColumnView.switchHTML(yg,scoreView)}</div>`:''}
    <div class="score-area" id="score-area-${yg}">${pupils.length&&scoreView==='column'?columnViewHTML(yg):tableHTML}</div>
  `;
  TrackerKeyboard.prepare(el);
}

function scoreCell(yg,pid,tpId,dim,current){
  const btns=[1,2,3,4].map(n=>`<button class="sc-btn s${n} ${current===n?'active':''}" onclick="setScore('${yg}','${pid}','${tpId}','${dim}',${n},this)">${n}</button>`).join('');
  const na=`<button class="na-btn ${current===0?'active':''}" onclick="setScore('${yg}','${pid}','${tpId}','${dim}',0,this)" title="Not assessed this TP">N/A</button>`;
  const lbl=PROC_LABELS[dim]||ATTIT_LABELS[dim]||dim;
  return `<div class="sc-wrap"><div class="sc-group" data-score-cell data-pid="${escAttr(pid)}" data-dim="${dim}" role="group" aria-label="${lbl}">${btns}${na}</div></div>`;
}
function setTP(yg,id){S.curTP[yg]=id;renderTracker(yg);}
function setCls(yg,cls){S.curCls[yg]=cls;renderTracker(yg);}

// ── ONE-COLUMN SCORING (markup in tracker-column-view.js) ──
const _colDim={s1:'creating',s2:'creating',s3:'creating'};
function trackerPupils(yg){
  const curCls=S.curCls[yg];const out=[];
  const classes=curCls==='all'?Object.keys(S.pupils[yg]).sort():[curCls];
  classes.forEach(c=>(S.pupils[yg][c]||[]).forEach(p=>out.push({...p,cls:c})));
  return out;
}
function columnViewOpts(yg){
  const tpId=S.curTP[yg];
  return {
    yg,tpId,dim:_colDim[yg],pupils:trackerPupils(yg),showClass:S.curCls[yg]==='all',
    getCell:(pid,dim)=>{const sc=S.scores[yg]?.[pid]?.[tpId]||{};return {value:sc[dim],isDefault:Array.isArray(sc.defaultDims)&&sc.defaultDims.includes(dim)};},
    getNote:pid=>S.scores[yg]?.[pid]?.[tpId]?.notes||'',
  };
}
function columnViewHTML(yg){return TrackerColumnView.render(columnViewOpts(yg));}
function renderScoreArea(yg){const el=document.getElementById('score-area-'+yg);if(el){el.innerHTML=columnViewHTML(yg);TrackerKeyboard.prepare(document.getElementById('panel-tracker-'+yg));}}
function setScoreView(yg,mode){TrackerColumnView.setMode(mode);renderTracker(yg);}
function setColDim(yg,dim,jump){
  _colDim[yg]=dim;renderScoreArea(yg);
  if(jump){const el=document.getElementById('score-area-'+yg);if(el)el.scrollIntoView({block:'start',behavior:'smooth'});}
}
function toggleColNote(btn){
  const box=btn.closest('.col-row').querySelector('.col-note');
  const open=box.hidden;box.hidden=!open;btn.setAttribute('aria-expanded',String(open));
  if(open)box.querySelector('textarea').focus();
}
function isDefaultsOn(yg,tpId){return S.defaultsOn?.[yg]?.[tpId]===true;}
function defaultValueForDim(dim){return PROC_DIMS.includes(dim)?3:4;}
function pupilsInYear(yg){
  const out=[];
  Object.keys(S.pupils[yg]||{}).forEach(c=>(S.pupils[yg][c]||[]).forEach(p=>out.push(p)));
  return out;
}
function ensureScoreBucket(yg,pid,tpId){
  if(!S.scores[yg])S.scores[yg]={};
  if(!S.scores[yg][pid])S.scores[yg][pid]={};
  if(!S.scores[yg][pid][tpId])S.scores[yg][pid][tpId]={};
  return S.scores[yg][pid][tpId];
}
function applyUnitDefaults(yg,tpId){
  let changed=false;
  pupilsInYear(yg).forEach(p=>{
    const sc=ensureScoreBucket(yg,p.id,tpId);
    if(!Array.isArray(sc.defaultDims))sc.defaultDims=[];
    [...PROC_DIMS,...ATTIT_DIMS].forEach(d=>{
      if(sc[d]===undefined||sc[d]===null){
        sc[d]=defaultValueForDim(d);
        if(!sc.defaultDims.includes(d))sc.defaultDims.push(d);
        changed=true;
      }
    });
  });
  return changed;
}
function clearUnitDefaults(yg,tpId){
  pupilsInYear(yg).forEach(p=>{
    const sc=S.scores[yg]?.[p.id]?.[tpId];
    if(!sc)return;
    const dims=[...PROC_DIMS,...ATTIT_DIMS];
    if(Array.isArray(sc.defaultDims)){
      sc.defaultDims.forEach(d=>{if(sc[d]===defaultValueForDim(d))delete sc[d];});
      delete sc.defaultDims;
      return;
    }
    const present=dims.filter(d=>sc[d]!==undefined&&sc[d]!==null);
    if(present.length&&present.every(d=>sc[d]===defaultValueForDim(d)))present.forEach(d=>delete sc[d]);
  });
}
function scoreIsUntouchedBaseline(sc){
  if(!sc)return false;
  const dims=[...PROC_DIMS,...ATTIT_DIMS];
  const present=dims.filter(d=>sc[d]!==undefined&&sc[d]!==null);
  if(!present.length)return false;
  if(Array.isArray(sc.defaultDims)&&sc.defaultDims.length)return true;
  return present.every(d=>sc[d]===defaultValueForDim(d));
}
function unitHasDefaultFill(yg,tpId){
  if(isDefaultsOn(yg,tpId))return true;
  return pupilsInYear(yg).some(p=>scoreIsUntouchedBaseline(S.scores[yg]?.[p.id]?.[tpId]));
}
function bindModalCancel(yg){
  const cancelBtn=document.querySelector('#modal-overlay .btn-ghost');
  if(cancelBtn)cancelBtn.onclick=function(){closeModal();renderTracker(yg);};
}
function setUnitDefault(yg,tpId,on){
  if(roBlock()){renderTracker(yg);return;}
  if(!S.defaultsOn[yg]||typeof S.defaultsOn[yg]!=='object')S.defaultsOn[yg]={};
  const unit=(TPS[yg]||[]).find(t=>t.id===tpId);
  const unitName=unit?`${unit.label}: ${unit.unit}`:tpId;
  if(!on){
    showModal(
      'Uncheck '+unitName+'?',
      'This removes the old default scores for this unit only (process 3 and attitude 4). Scores you have changed are kept. The other units stay as they are.',
      'Uncheck this unit',
      function(){
        S.defaultsOn[yg][tpId]=false;
        clearUnitDefaults(yg,tpId);
        save();renderTracker(yg);
      },
      false
    );
    bindModalCancel(yg);
    return;
  }
  showModal(
    'Start tracking '+unitName+'?',
    'Empty cells in this unit only will be set to process 3 (on track) and attitude 4. Other units are not changed.',
    'Check this unit',
    function(){
      S.defaultsOn[yg][tpId]=true;
      applyUnitDefaults(yg,tpId);
      save();renderTracker(yg);
    },
    false
  );
  bindModalCancel(yg);
}
function markScoreManual(yg,pid,tpId,dim){
  const sc=S.scores[yg]?.[pid]?.[tpId];
  if(!sc||!Array.isArray(sc.defaultDims))return;
  sc.defaultDims=sc.defaultDims.filter(d=>d!==dim);
}
function toggleDefaults(yg,tpId){
  if(roBlock())return;
  if(!S.defaultsOn[yg]||typeof S.defaultsOn[yg]!=='object')S.defaultsOn[yg]={};
  const unit=(TPS[yg]||[]).find(t=>t.id===tpId);
  const unitName=unit?`${unit.label}: ${unit.unit}`:tpId;
  const isCurrentlyOn=S.defaultsOn[yg][tpId]===true;
  if(isCurrentlyOn){
    showModal(
      'Turn off defaults for this unit?',
      `This only affects ${unitName}. Untouched baseline scores (process 3, attitude 4) are cleared so this unit no longer counts as on track. Scores you changed stay. Other units are left as they are.`,
      'Turn off this unit',
      function(){
        S.defaultsOn[yg][tpId]=false;
        clearUnitDefaults(yg,tpId);
        save();renderTracker(yg);
      },
      false
    );
    return;
  }
  showModal(
    'Start tracking this unit?',
    `Empty cells in ${unitName} only will be set to process 3 (on track) and attitude 4. Units you have not switched on stay blank, so pupils are not shown as on track for the rest of the year.`,
    'Turn on this unit',
    function(){
      S.defaultsOn[yg][tpId]=true;
      applyUnitDefaults(yg,tpId);
      save();renderTracker(yg);
    },
    false
  );
}
function setScore(yg,pid,tpId,dim,val,btn){
  if(roBlock())return;
  if(!S.scores[yg])S.scores[yg]={};
  if(!S.scores[yg][pid])S.scores[yg][pid]={};
  if(!S.scores[yg][pid][tpId])S.scores[yg][pid][tpId]={};
  const cur=S.scores[yg][pid][tpId][dim];
  S.scores[yg][pid][tpId][dim]=(cur===val)?null:val;
  markScoreManual(yg,pid,tpId,dim);
  save();
  const cell=btn.closest('[data-score-cell]')||btn.closest('td');const nv=S.scores[yg][pid][tpId][dim];
  cell.querySelectorAll('.sc-btn').forEach(b=>b.classList.toggle('active',nv===parseInt(b.textContent)));
  cell.querySelectorAll('.na-btn').forEach(b=>b.classList.toggle('active',nv===0));
  if(btn.closest('.col-view'))TrackerColumnView.refresh(document.getElementById('score-area-'+yg),columnViewOpts(yg));
}
function setNote(yg,pid,tpId,val){
  if(roBlock())return;
  if(!S.scores[yg])S.scores[yg]={};
  if(!S.scores[yg][pid])S.scores[yg][pid]={};
  if(!S.scores[yg][pid][tpId])S.scores[yg][pid][tpId]={};
  S.scores[yg][pid][tpId].notes=val;save();
}

// ── BULK APPLY ──
function selectBulk(yg,dim,val){
  // Toggle — click same value again to deselect
  _bulkSel[dim] = (_bulkSel[dim]===val) ? null : val;
  // Update button highlight states for this dimension
  [1,2,3,4].forEach(n=>{
    const b=document.getElementById(`bb-${yg}-${dim}-${n}`);
    if(b) b.classList.toggle('sel', _bulkSel[dim]===n);
  });
}

function applyBulk(yg,tpId){
  if(roBlock())return;
  const dims=Object.keys(_bulkSel).filter(d=>_bulkSel[d]!=null);
  if(!dims.length){toast('Select a score for at least one column first');return;}
  const keepEl=document.getElementById('bulk-keep-'+yg);
  const keep=keepEl?keepEl.checked:true;
  const allDims=[...PROC_DIMS,...ATTIT_DIMS];
  const undo=[];let changed=0,kept=0;
  // Visible rows = the class filter currently on screen
  document.querySelectorAll(`#panel-tracker-${yg} tbody tr[data-pid], #panel-tracker-${yg} .col-row[data-pid]`).forEach(row=>{
    const pid=row.dataset.pid;if(!pid)return;
    const sc=ensureScoreBucket(yg,pid,tpId);
    const cells=row.querySelectorAll('td');
    dims.forEach(d=>{
      const prev=sc[d];
      const wasDefault=Array.isArray(sc.defaultDims)&&sc.defaultDims.includes(d);
      const entered=prev!==undefined&&prev!==null&&!wasDefault;
      if(prev===_bulkSel[d]&&!wasDefault)return;
      if(keep&&entered){kept++;return;}
      undo.push({pid,d,prev,wasDefault});
      sc[d]=_bulkSel[d];
      markScoreManual(yg,pid,tpId,d);
      changed++;
      // Score cells start after the delete, pupil and notes columns
      const cell=cells[3+allDims.indexOf(d)];
      if(cell){
        cell.querySelectorAll('.sc-btn').forEach(b=>b.classList.toggle('active',parseInt(b.textContent)===_bulkSel[d]));
        cell.querySelectorAll('.na-btn').forEach(b=>b.classList.remove('active'));
      }
    });
  });
  if(document.querySelector(`#score-area-${yg} .col-view`))renderScoreArea(yg);
  if(!changed){toast(kept?`Nothing changed — all ${kept} score${kept!==1?'s were':' was'} already entered`:'Nothing to change');return;}
  save();
  const msg=`Set ${changed} score${changed!==1?'s':''}${kept?` · kept ${kept} already entered`:''}`;
  toastAction(msg,'Undo',()=>undoBulk(yg,tpId,undo));
}
function undoBulk(yg,tpId,undo){
  if(roBlock())return;
  undo.forEach(({pid,d,prev,wasDefault})=>{
    const sc=ensureScoreBucket(yg,pid,tpId);
    if(prev===undefined||prev===null)delete sc[d];else sc[d]=prev;
    if(wasDefault){if(!Array.isArray(sc.defaultDims))sc.defaultDims=[];if(!sc.defaultDims.includes(d))sc.defaultDims.push(d);}
  });
  save();renderTracker(yg);toast('Undone');
}

// ── REMOVE PUPIL from tracker (also removes from class list) ──
function removePupilFromTracker(yg,cls,pid){
  // Find pupil name for confirmation
  const pupil=(S.pupils[yg][cls]||[]).find(p=>p.id===pid);
  const name=pupil?pupil.name:'this pupil';
  showModal(
    `Remove ${name}?`,
    `This will permanently remove <strong>${name}</strong> from <strong>${cls}</strong> and delete all their scores. This cannot be undone.`,
    'Remove Pupil',
    ()=>{
      forgetRosterPupil(yg,cls,pid);
      S.pupils[yg][cls]=S.pupils[yg][cls].filter(p=>p.id!==pid);
      delete S.scores[yg][pid];if(S.profiles[yg])delete S.profiles[yg][pid];
      save();
      // Remove the row from DOM without full re-render
      const row=document.querySelector(`#panel-tracker-${yg} tr[data-pid="${pid}"]`);
      if(row){
        row.style.transition='opacity .2s';
        row.style.opacity='0';
        setTimeout(()=>{row.remove();},220);
      }
      toast(`${name} removed`);
    }
  );
}

// ══════════════════════════════════════════════════════════
// BENCHMARK ANALYSIS
// ══════════════════════════════════════════════════════════
function renderBenchmarks(){
  const body=document.getElementById('bm-body');
  let html='';let anyData=false;

  // Global process averages
  const global={creating:[],presenting:[],evaluating:[]};
  ['s1','s2','s3'].forEach(yg=>{
    Object.keys(S.pupils[yg]).forEach(cls=>{
      (S.pupils[yg][cls]||[]).forEach(p=>{
        TPS[yg].forEach(tp=>{
          const sc=S.scores[yg]?.[p.id]?.[tp.id]||{};
          PROC_DIMS.forEach(d=>{if(sc[d]>0){global[d].push(sc[d]);anyData=true;}});
        });
      });
    });
  });

  if(!anyData){body.innerHTML='<div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg></div>No process scores entered yet. Enter scores in the tracker panels first.</div>';return;}

  const procConfigs=[
    {d:'creating',cls:'cr',col:'#7c3aed',title:'Creating',desc:CFG.dimSummaries.creating},
    {d:'presenting',cls:'pr',col:'#0369a1',title:'Presenting',desc:CFG.dimSummaries.presenting},
    {d:'evaluating',cls:'ev',col:'#0f766e',title:'Evaluating',desc:CFG.dimSummaries.evaluating},
  ];

  // Global overview
  html+=`<div class="bm-ov-grid">
    ${procConfigs.map(({d,cls,col,title,desc})=>{
      const a=avg(global[d]);const p=pct(a);
      return `<div class="bm-ov-card ${cls}">
        <div class="bm-ov-title ${cls}">${title}</div>
        <div class="bm-ov-desc">${desc}</div>
        <div class="bm-ov-avg ${cls}">${a?a.toFixed(2):'—'}</div>
        <div class="bm-ov-lbl">Faculty-wide average / 4 &nbsp;(${global[d].length} scores)</div>
        <div class="bm-bar-wrap"><div class="bm-bar-fill f-${cls}" style="width:${p}%"></div></div>
      </div>`;
    }).join('')}
  </div>`;

  // Per year group
  ['s1','s2','s3'].forEach(yg=>{
    const classes=Object.keys(S.pupils[yg]);
    if(!classes.length)return;
    const allPupils=[];
    classes.forEach(c=>(S.pupils[yg][c]||[]).forEach(p=>allPupils.push({...p,cls:c})));
    if(!allPupils.length)return;

    const ygData=[];
    TPS[yg].forEach(tp=>{
      (BM[yg][tp.id]||[]).forEach(bm=>{
        const d=bm.proc==='cr'?'creating':bm.proc==='pr'?'presenting':'evaluating';
        const scores=allPupils.map(p=>S.scores[yg]?.[p.id]?.[tp.id]?.[d]).filter(v=>v>0);
        const a=avg(scores);
        ygData.push({tp:tp.label,unit:tp.unit,proc:bm.proc,text:bm.text,avg:a,n:scores.length,total:allPupils.length});
      });
    });

    const hasAny=ygData.some(r=>r.avg);

    // Summary numbers for header
    const ygProc={cr:[],pr:[],ev:[]};
    ygData.filter(r=>r.avg).forEach(r=>ygProc[r.proc].push(r.avg));
    const procSummary=procConfigs.map(({d,cls,col,title})=>{
      const p=d==='creating'?'cr':d==='presenting'?'pr':'ev';
      const a=avg(ygProc[p]);
      return `<div style="text-align:center;padding:.45rem .8rem;border-radius:6px;background:${cls==='cr'?'var(--cr-bg)':cls==='pr'?'var(--pr-bg)':'var(--ev-bg)'};border:1px solid ${cls==='cr'?'var(--cr-bd)':cls==='pr'?'var(--pr-bd)':'var(--ev-bd)'}">
        <div style="font-family:var(--font-heading);font-size:1.05rem;font-weight:800;color:${col}">${a?a.toFixed(1):'—'}</div>
        <div style="font-size:.55rem;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:${col};opacity:.75">${title}</div>
      </div>`;
    }).join('');

    html+=`<div class="sc" style="margin-bottom:1.2rem">
      <div class="sc-header">
        <div><div class="sc-title">${yg.toUpperCase()} ${SUBJ_HTML} — Benchmark Analysis</div><div class="sc-sub">${allPupils.length} pupils · ${TPS[yg].length} tracking periods · ${ygData.filter(r=>r.avg).length} benchmarks with data</div></div>
        <div style="display:flex;gap:.55rem">${procSummary}</div>
      </div>
      <div class="sc-body" style="padding:0">
        ${hasAny?`<div class="gap-wrap">
          <table class="gap-tbl">
            <thead><tr>
              <th>TP</th><th>Unit</th><th>Process</th><th>Benchmark</th><th style="width:130px">Class Avg</th><th style="width:75px">Scored</th>
            </tr></thead>
            <tbody>
              ${ygData.map(r=>{
                const col=r.proc==='cr'?'#7c3aed':r.proc==='pr'?'#0369a1':'#0f766e';
                const fillCls=`f-${r.proc}`;
                const lbl=r.proc==='cr'?'Creating':r.proc==='pr'?'Presenting':'Evaluating';
                const flagLow=r.avg&&r.avg<2.5;
                return `<tr ${flagLow?'style="background:#fffbeb"':''}>
                  <td style="font-family:var(--font-mono);font-size:.7rem;font-weight:600;white-space:nowrap">${r.tp}</td>
                  <td style="font-size:.73rem;color:var(--text2)">${r.unit}</td>
                  <td><span class="gp gp-${r.proc}">${lbl}</span></td>
                  <td style="font-size:.71rem;color:var(--text2);line-height:1.55"><details class="bm-line"><summary>${flagLow?'Below 2.5. Show benchmark':'Show benchmark'}</summary>${r.text}</details></td>
                  <td>
                    ${r.avg?`<div class="bar-row">
                      <div class="bar-inner"><div class="bar-fill ${fillCls}" style="width:${pct(r.avg)}%"></div></div>
                      <span style="font-family:var(--font-mono);font-size:.68rem;font-weight:600;color:${col};flex-shrink:0">${r.avg.toFixed(1)}</span>
                    </div>`:'<span style="font-size:.68rem;color:var(--text3)">No data</span>'}
                  </td>
                  <td style="font-family:var(--font-mono);font-size:.68rem;color:var(--text3)">${r.n}/${r.total}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>`:`<div class="empty-s" style="padding:1.5rem;font-size:.75rem">No scores entered for ${yg.toUpperCase()} yet.</div>`}
      </div>
    </div>`;
  });

  body.innerHTML=html;
}

// ══════════════════════════════════════════════════════════
// PUPIL PROFILES — Learner Conversations
// ══════════════════════════════════════════════════════════
const SCALE_GUIDE = [
  {n:1,cls:'s1',title:'I\'m working on my targets',desc:'I\'m getting help with my learning and I\'m trying hard to reach my targets. I\'m making small steps forward.'},
  {n:2,cls:'s2',title:'I\'m getting there',desc:'I\'m making progress but I\'m not quite there yet. I\'m working towards what\'s expected and I\'m getting better.'},
  {n:3,cls:'s3',title:'I\'m on track',desc:'I\'m doing what\'s expected for my stage. I\'m showing the skills and knowledge I need.'},
  {n:4,cls:'s4',title:'I\'m doing really well',desc:'I\'m doing more than expected! I can work on my own and show deep understanding.'},
];
const SCALE_NOTE = CFG.scaleNote;

const PROFILE_PROMPTS = CFG.profilePrompts;
let _profYG='s1',_profCls='',_profPid='';

function buildProfileAnalysis(yg,pid){
  const tps=TPS[yg];const sc=S.scores[yg]?.[pid]||{};
  const dims={creating:[],presenting:[],evaluating:[],effort:[],behaviour:[],homelearning:[]};
  tps.forEach(tp=>{
    const s=sc[tp.id]||{};
    ['creating','presenting','evaluating','effort','behaviour','homelearning'].forEach(d=>{if(s[d]>0)dims[d].push(s[d]);});
  });
  const avgs={};Object.keys(dims).forEach(d=>{avgs[d]=avg(dims[d]);});
  const procAvgs=avg([avgs.creating,avgs.presenting,avgs.evaluating].filter(v=>v!=null));
  const badges=[];const strengths=[];const areas=[];const nextSteps=[];
  if(procAvgs>=3.5)badges.push({cls:'gold',icon:'★',text:'Above Expectations'});
  else if(procAvgs>=2.5)badges.push({cls:'green',icon:'✓',text:'On Track'});
  else if(procAvgs!=null)badges.push({cls:'amber',icon:'↗',text:'Developing'});
  if(procAvgs!=null&&procAvgs<2.5)badges.push({cls:'blue',icon:'💪',text:'Needs Support'});
  if(avgs.creating>=3)badges.push({cls:'purple',icon:'◆',text:'Strong Creating'});
  if(avgs.presenting>=3)badges.push({cls:'blue',icon:'◆',text:'Strong Presenting'});
  if(avgs.evaluating>=3)badges.push({cls:'green',icon:'◆',text:'Strong Evaluating'});
  if(avgs.effort>=3)badges.push({cls:'green',icon:'↑',text:'Consistent Effort'});
  if(avgs.behaviour>=3)badges.push({cls:'green',icon:'◎',text:'Positive Behaviour'});
  if(avgs.homelearning>=3)badges.push({cls:'green',icon:'📋',text:'Home Learning on Track'});
  const tpsScored=tps.filter(tp=>{const s=sc[tp.id]||{};return [s.creating,s.presenting,s.evaluating].some(v=>v>0);}).length;
  if(tpsScored>=4)badges.push({cls:'purple',icon:'📊',text:'Good Coverage'});
  // Wording for each subject comes from CFG.profile; an area is only listed if the subject has a next step for it.
  const P=CFG.profile;
  ['creating','presenting','evaluating','effort'].forEach(d=>{if(P.strengths[d]&&avgs[d]!=null&&avgs[d]>=2.5)strengths.push(P.strengths[d]);});
  [['creating','Creating'],['presenting','Presenting'],['evaluating','Evaluating'],['effort','Effort'],['behaviour','Behaviour'],['homelearning','Home learning']]
    .forEach(([d,l])=>{if(P.nextSteps[l]&&avgs[d]!=null&&avgs[d]<2.5)areas.push(l);});
  areas.forEach(a=>nextSteps.push(P.nextSteps[a]));
  if(nextSteps.length===0&&procAvgs!=null)nextSteps.push(P.stretch);
  const progressComment=procAvgs==null?'No scores entered yet — add data in the tracker to generate a progress report.'
    :`Is ${procAvgs>=3?'progressing well':procAvgs>=2.5?'making steady progress':'working towards'} in ${CFG.name} with an average of ${procAvgs.toFixed(1)} across Creating, Presenting and Evaluating. ${strengths.length?`Strengths include ${strengths.join(', ')}. `:''}${areas.length?`Areas to develop: ${areas.join(', ')}.`:''}`;
  return {badges,avgs,procAvgs,progressComment,nextSteps,dims:['creating','presenting','evaluating','effort','behaviour','homelearning'],dimLabels:{creating:'Creating',presenting:'Presenting',evaluating:'Evaluating',effort:'Effort',behaviour:'Behaviour',homelearning:'Home Learning'}};
}

function setProfPupil(yg,cls,pid){ _profYG=yg;_profCls=cls;_profPid=pid;renderProfiles(); }
function saveProfileField(yg,pid,field,val){
  if(roBlock())return;
  if(!S.profiles[yg])S.profiles[yg]={};
  if(!S.profiles[yg][pid])S.profiles[yg][pid]={};
  S.profiles[yg][pid][field]=val;
  S.profiles[yg][pid].lastUpdated=new Date().toISOString().slice(0,10);
  save();
}

function profileTrackingHistoryHtml(prof){
  const hist=prof.trackingHistory;
  if(!hist||typeof hist!=='object')return '';
  return Object.keys(hist).sort().map(fromYg=>{
    const h=hist[fromYg];
    if(!h||!h.scores||typeof h.scores!=='object')return '';
    const tps=TPS[fromYg]||[];
    const rows=tps.map(tp=>{
      const s=h.scores[tp.id]||{};
      const a=avg([s.creating,s.presenting,s.evaluating,s.progress,s.development,s.expression,s.effort,s.behaviour,s.homelearning].filter(v=>v>0));
      if(a==null)return '';
      return `<tr><td style="font-size:.72rem">${tp.label}</td><td style="font-size:.72rem;color:var(--text2)">${tp.unit||''}</td><td style="font-family:monospace;font-weight:600">${a.toFixed(1)}</td></tr>`;
    }).filter(Boolean).join('');
    if(!rows)return '';
    return `<div class="profile-section" style="background:var(--bg);border:1px solid var(--border);border-radius:8px;padding:.85rem 1rem;margin:0 0 1rem">
      <div class="profile-section-title">${fromYg.toUpperCase()} snapshot (read-only)${h.className?' — '+h.className:''}</div>
      <p style="font-size:.72rem;color:var(--text3);margin:0 0 .5rem">Prior-year tracking from class handover or promotion. Use the current year tracker for new scores.</p>
      <table class="tbl" style="font-size:.75rem"><thead><tr><th>TP</th><th>Unit</th><th>Avg</th></tr></thead><tbody>${rows}</tbody></table>
    </div>`;
  }).join('');
}

function renderProfiles(){
  const body=document.getElementById('profiles-body');
  const classes=Object.keys(S.pupils[_profYG]||{}).sort();
  const allPupils=[];classes.forEach(c=>(S.pupils[_profYG][c]||[]).forEach(p=>allPupils.push({...p,cls:c})));

  if(!classes.length){
    body.innerHTML='<div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>No classes set up yet. Add classes and pupils in Class Setup first.</div>';
    return;
  }

  const prof=S.profiles[_profYG]?.[_profPid]||{};
  const pupil=allPupils.find(p=>p.id===_profPid);

  let html=`
    <div class="profile-select no-print">
      <div class="form-group">
        <label class="form-label">Year group</label>
        <select class="form-input" onchange="setProfPupil(this.value,'','')">
          ${['s1','s2','s3'].map(y=>`<option value="${y}" ${_profYG===y?'selected':''}>${y.toUpperCase()}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Class</label>
        <select class="form-input" onchange="setProfPupil(_profYG,this.value||this.options[this.selectedIndex].value,'')">
          <option value="">— Select class —</option>
          ${classes.map(c=>`<option value="${c}" ${_profCls===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="flex:1;min-width:180px">
        <label class="form-label">Pupil</label>
        <select class="form-input" onchange="setProfPupil(_profYG,_profCls,this.value)">
          <option value="">— Select pupil —</option>
          ${(_profCls?(S.pupils[_profYG][_profCls]||[]):allPupils).map(p=>`<option value="${p.id}" ${_profPid===p.id?'selected':''}>${p.name}${p.cls?' ('+p.cls+')':''}</option>`).join('')}
        </select>
      </div>
    </div>`;

  if(pupil){
    const tps=TPS[_profYG];const sc=S.scores[_profYG]?.[pupil.id]||{};
    const scoreSummary=tps.map(tp=>{
      const s=sc[tp.id]||{};
      const cr=s.creating,spr=s.presenting,ev=s.evaluating;
      const procAvg=avg([cr,spr,ev].filter(v=>v>0));
      return {tp:tp.label,unit:tp.unit,creating:cr,presenting:spr,evaluating:ev,avg:procAvg};
    });
    const analysis=buildProfileAnalysis(_profYG,pupil.id);
    const dimCols={creating:'#7c3aed',presenting:'#0369a1',evaluating:'#0f766e',effort:'#92400e',behaviour:'#be185d',homelearning:'#b45309'};

    const printDate=new Date().toLocaleDateString('en-GB',{day:'numeric',month:'long',year:'numeric'});
    html+=`
    <div class="profile-card">
      <div class="profile-print-header">
        <div class="school">Knightswood Secondary School</div>
        <div class="title">Pupil Progress Profile — ${SUBJ_HTML}</div>
        <div class="date">${printDate} · Use "Save as PDF" when printing to email to parents</div>
      </div>
      <div class="profile-head">
        <div><div class="profile-name">${pupil.name}</div><div class="profile-meta">${pupil.cls} · ${_profYG.toUpperCase()} ${SUBJ_HTML}</div></div>
        <button class="profile-print-btn no-print" onclick="window.print()" title="Print or Save as PDF to email"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>Print / Save PDF</button>
      </div>
      ${profileTrackingHistoryHtml(prof)}
      <div class="profile-body">
        <div class="profile-section">
          <div class="profile-section-title">Achievement badges</div>
          <div class="profile-badges">
            ${analysis.badges.length?analysis.badges.map(b=>`<span class="profile-badge ${b.cls}"><span class="profile-badge-icon">${b.icon}</span>${b.text}</span>`).join(''):'<span style="font-size:.75rem;color:var(--text3)">Enter scores to generate badges</span>'}
          </div>
        </div>
        <div class="profile-visual-row">
          <div class="profile-report-card">
            <h4>Progress report</h4>
            <p><strong>${pupil.name}</strong> ${analysis.progressComment}</p>
          </div>
          <div class="profile-report-card">
            <h4>Progress by dimension</h4>
            ${analysis.dims.map(d=>{
              const a=analysis.avgs[d];const pct=a?((a/4)*100):0;const col=dimCols[d];const lbl=analysis.dimLabels[d];
              return `<div class="profile-dim-bar"><span class="profile-dim-lbl">${lbl}</span><div class="profile-dim-track"><div class="profile-dim-fill" style="width:${pct}%;background:${col}"></div></div><span class="profile-dim-val" style="color:${col}">${a?a.toFixed(1):'—'}</span></div>`;
            }).join('')}
          </div>
        </div>
        <details class="task-more">
          <summary>What the numbers mean</summary>
          <div class="task-more-body">
            <div class="profile-scale-cards">
              ${SCALE_GUIDE.map(s=>`<div class="profile-scale-card"><div class="profile-scale-num ${s.cls}">${s.n}</div><div class="profile-scale-card-title">${s.title}</div><div class="profile-scale-card-desc">${s.desc}</div></div>`).join('')}
            </div>
            <div class="profile-scale-note">${SCALE_NOTE}</div>
          </div>
        </details>
        <div class="profile-section">
          <div class="profile-section-title">Next steps</div>
          <div class="profile-report-card">
            ${analysis.nextSteps.length?`<ul style="margin:0;padding-left:1.2rem;font-size:.8rem;color:var(--text2);line-height:1.8">${analysis.nextSteps.map(s=>`<li>${s}</li>`).join('')}</ul>`:'<p style="color:var(--text3)">Enter scores to generate suggested next steps.</p>'}
          </div>
        </div>
        <div class="profile-section">
          <div class="profile-section-title">Scores by TP</div>
          <div class="profile-scores-grid">
            ${scoreSummary.map(r=>`<div class="profile-score-cell"><div class="profile-score-lbl">${r.tp}</div><div class="profile-score-val">${r.avg?r.avg.toFixed(1):'—'}</div><div class="profile-score-lbl" style="font-size:.5rem">${r.unit}</div></div>`).join('')}
          </div>
        </div>
        <div class="profile-section no-print">
          <div class="profile-section-title">Teacher notes — for learner conversation</div>
          <textarea class="profile-ta" placeholder="Add notes about this pupil's progress to share during learner conversations…" oninput="saveProfileField('${_profYG}','${pupil.id}','teacherNotes',this.value)">${escText(prof.teacherNotes)}</textarea>
        </div>
        <div class="profile-section no-print">
          <div class="profile-section-title">Pupil reflection</div>
          <textarea class="profile-ta" placeholder="Pupil can complete this before or during the conversation…" oninput="saveProfileField('${_profYG}','${pupil.id}','pupilReflection',this.value)">${escText(prof.pupilReflection)}</textarea>
        </div>
        <details class="task-more no-print">
          <summary>Question prompts</summary>
          <div class="task-more-body">
            <div class="profile-section-title">For the teacher</div>
            <div class="profile-prompts">${PROFILE_PROMPTS.teacher.map(q=>`<div class="profile-prompt-item">${q}</div>`).join('')}</div>
            <div class="profile-section-title" style="margin-top:.8rem">For the pupil</div>
            <div class="profile-prompts">${PROFILE_PROMPTS.pupil.map(q=>`<div class="profile-prompt-item">${q}</div>`).join('')}</div>
          </div>
        </details>
      </div>
    </div>`;
  } else {
    html+='<div class="empty-s" style="padding:2rem"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg></div>Select a pupil to view and edit their profile.</div>';
  }

  body.innerHTML=html;
}

// ══════════════════════════════════════════════════════════
// OVERVIEW
// ══════════════════════════════════════════════════════════
let _arThreshold = 2;
let _ovYG = 'all';       // 'all' | 's1' | 's2' | 's3'
let _ovCls = 'all';      // 'all' | specific class name

function setThreshold(val){ _arThreshold=parseFloat(val); renderOverview(); }
function setOvYG(yg){ _ovYG=yg; _ovCls='all'; renderOverview(); }
function setOvCls(cls){ _ovCls=cls; renderOverview(); }

function renderOverview(){
  const body = document.getElementById('ov-body');

  // ── Build filter bar ──
  const ygFilterEl = document.getElementById('ov-yg-filters');
  const clsFilterEl = document.getElementById('ov-cls-filters');

  if(ygFilterEl){
    const ygs = ['all','s1','s2','s3'];
    ygFilterEl.innerHTML = ygs.map(yg=>{
      const lbl = yg==='all' ? 'All Years' : yg.toUpperCase();
      return `<button class="cf-btn ${_ovYG===yg?'active':''}" onclick="setOvYG('${yg}')">${lbl}</button>`;
    }).join('');
  }

  if(clsFilterEl){
    // Collect classes for the active YG filter
    const activeYGs = _ovYG==='all' ? ['s1','s2','s3'] : [_ovYG];
    const allClasses = [];
    activeYGs.forEach(yg=>{
      Object.keys(S.pupils[yg]).sort().forEach(cls=>{
        if(!allClasses.includes(cls)) allClasses.push(cls);
      });
    });
    if(allClasses.length){
      clsFilterEl.innerHTML = [
        `<button class="cf-btn ${_ovCls==='all'?'active':''}" onclick="setOvCls('all')">All Classes</button>`,
        ...allClasses.map(cls=>`<button class="cf-btn ${_ovCls===cls?'active':''}" onclick="setOvCls('${cls.replace(/'/g,"\\'")}')">${cls}</button>`)
      ].join('');
    } else {
      clsFilterEl.innerHTML='<span style="font-size:.7rem;color:var(--text3)">No classes set up yet</span>';
    }
  }

  // ── Determine which YGs + classes to show ──
  const activeYGs = _ovYG==='all' ? ['s1','s2','s3'] : [_ovYG];

  // ── Collect at-risk pupils — holistic composite approach ──
  // A pupil is flagged only if their OVERALL picture is concerning,
  // not because of one low score in one dimension.
  // We calculate:
  //   processAvg   = mean of all Creating/Presenting/Evaluating scores entered
  //   attitudeAvg  = mean of all Effort/Behaviour/HomeLearning scores entered
  //   overallAvg   = mean of all six dimensions combined
  // Flag if: overallAvg <= 2.0  AND at least 2 TPs have been scored
  // (so we don't flag someone with one score entered)
  // Also capture which specific areas are dragging the average down.

  const allAtRisk=[];
  let anyData=false;

  const dimCfg={
    creating:    {lbl:'Creating',     flagCls:'ar-flag-cr', group:'process'},
    presenting:  {lbl:'Presenting',   flagCls:'ar-flag-pr', group:'process'},
    evaluating:  {lbl:'Evaluating',   flagCls:'ar-flag-ev', group:'process'},
    effort:      {lbl:'Effort',       flagCls:'ar-flag-ef', group:'attitude'},
    behaviour:   {lbl:'Behaviour',    flagCls:'ar-flag-bh', group:'attitude'},
    homelearning:{lbl:'Home Learning',flagCls:'ar-flag-hl', group:'attitude'},
  };

  activeYGs.forEach(yg=>{
    Object.keys(S.pupils[yg]).sort().forEach(cls=>{
      if(_ovCls!=='all' && cls!==_ovCls) return;
      (S.pupils[yg][cls]||[]).forEach(p=>{

        // Gather all scores per dimension across all TPs
        const dimScores={};
        [...PROC_DIMS,...ATTIT_DIMS].forEach(d=>dimScores[d]=[]);
        let tpsScoredCount=0;

        TPS[yg].forEach(tp=>{
          const sc=S.scores[yg]?.[p.id]?.[tp.id]||{};
          const hasAny=[...PROC_DIMS,...ATTIT_DIMS].some(d=>sc[d]>0);
          if(hasAny){ tpsScoredCount++; anyData=true; }
          [...PROC_DIMS,...ATTIT_DIMS].forEach(d=>{
            if(sc[d]>0) dimScores[d].push(sc[d]);
          });
        });

        if(tpsScoredCount < 1) return; // needs at least one TP scored

        // Per-dimension averages (only for dims that have been scored)
        const dimAvgs={};
        [...PROC_DIMS,...ATTIT_DIMS].forEach(d=>{
          dimAvgs[d] = dimScores[d].length
            ? dimScores[d].reduce((a,b)=>a+b,0)/dimScores[d].length
            : null;
        });

        // Dims that are at or below threshold
        const weakDims=[...PROC_DIMS,...ATTIT_DIMS].filter(d=>dimAvgs[d]!==null && dimAvgs[d]<=_arThreshold);

        // Flag if 2 or more dimensions are at/below threshold
        // OR if any single dimension averages 1.5 or below (serious individual concern)
        const seriousSingle=[...PROC_DIMS,...ATTIT_DIMS].some(d=>dimAvgs[d]!==null && dimAvgs[d]<=1.5);
        if(weakDims.length < 2 && !seriousSingle) return;

        const processVals = PROC_DIMS.map(d=>dimAvgs[d]).filter(v=>v!==null);
        const attitudeVals= ATTIT_DIMS.map(d=>dimAvgs[d]).filter(v=>v!==null);
        const allVals     = [...processVals,...attitudeVals];
        const processAvg  = processVals.length  ? processVals.reduce((a,b)=>a+b,0)/processVals.length  : null;
        const attitudeAvg = attitudeVals.length ? attitudeVals.reduce((a,b)=>a+b,0)/attitudeVals.length: null;
        const overallAvg  = allVals.length ? allVals.reduce((a,b)=>a+b,0)/allVals.length : null;
        if(!overallAvg) return;

        // concerns = dims below 2.5 for the card detail
        const concerns=[...PROC_DIMS,...ATTIT_DIMS]
          .filter(d=>dimAvgs[d]!==null && dimAvgs[d]<2.5)
          .map(d=>({dim:d, avg:dimAvgs[d], group:dimCfg[d].group}));

        allAtRisk.push({
          name:p.name, cls, yg:yg.toUpperCase(),
          overallAvg, processAvg, attitudeAvg,
          weakDims, concerns, tpsScoredCount, dimAvgs, seriousSingle
        });
      });
    });
  });

  // Sort — most weak dims first, then lowest overall avg
  allAtRisk.sort((a,b)=> b.weakDims.length - a.weakDims.length || a.overallAvg - b.overallAvg);

  // ── At Risk section ──
  const arHTML=`
    <div class="at-risk-section">
      <div class="at-risk-header">
        <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
        <div class="at-risk-title">At Risk</div>
        ${allAtRisk.length ? `<span class="at-risk-count">${allAtRisk.length} pupil${allAtRisk.length!==1?'s':''} flagged</span>` : ''}
        <div class="at-risk-threshold">
          <span class="threshold-label">Overall avg at or below</span>
          <select class="threshold-select" onchange="setThreshold(this.value)">
            <option value="1.5" ${_arThreshold===1.5?'selected':''}>1.5 — serious concern</option>
            <option value="2"   ${_arThreshold===2  ?'selected':''}>2 — cause for concern</option>
            <option value="2.5" ${_arThreshold===2.5?'selected':''}>2.5 — monitor closely</option>
          </select>
          <span style="font-size:.62rem;color:var(--text3);margin-left:.35rem">(2+ dimensions at or below)</span>
        </div>
      </div>
      ${allAtRisk.length===0 ? `
        <div class="ar-empty">
          <div class="ar-empty-title">No pupils flagged at this threshold</div>
          <div class="ar-empty-sub">${anyData?'No pupils have 2 or more dimensions averaging at or below the threshold.':'Enter scores in the tracker first.'}</div>
        </div>
      ` : `
        <div class="at-risk-grid">
          ${allAtRisk.map(p=>{
            // Colour the overall avg by severity
            const avgCol = p.overallAvg<=1.5?'#ef4444':p.overallAvg<=2?'#f97316':'#f59e0b';

            // Process vs attitude split display
            const procBar = p.processAvg!==null ? `
              <div class="ar-flag" style="margin-bottom:.2rem">
                <span class="ar-flag-dim" style="background:rgba(124,58,237,.1);border:1px solid rgba(124,58,237,.25);color:#6d28d9;min-width:60px">Process</span>
                <div style="flex:1;height:5px;background:var(--border);border-radius:99px;overflow:hidden;margin:0 .4rem">
                  <div style="height:100%;border-radius:99px;background:#7c3aed;width:${(p.processAvg/4)*100}%"></div>
                </div>
                <span class="ar-score" style="color:#7c3aed">${p.processAvg.toFixed(1)}</span>
              </div>` : '';
            const attBar = p.attitudeAvg!==null ? `
              <div class="ar-flag">
                <span class="ar-flag-dim" style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.25);color:#92400e;min-width:60px">Attitude</span>
                <div style="flex:1;height:5px;background:var(--border);border-radius:99px;overflow:hidden;margin:0 .4rem">
                  <div style="height:100%;border-radius:99px;background:#f59e0b;width:${(p.attitudeAvg/4)*100}%"></div>
                </div>
                <span class="ar-score" style="color:#f59e0b">${p.attitudeAvg.toFixed(1)}</span>
              </div>` : '';

            // Specific weak areas (only show dims clearly below average)
            const weakAreas = p.concerns.map(c=>`<span class="ar-flag-dim ${dimCfg[c.dim]?.flagCls||''}" style="margin:.1rem .15rem .1rem 0">${dimCfg[c.dim]?.lbl} ${c.avg.toFixed(1)}</span>`).join('');

            return `<div class="ar-card">
              <div class="ar-card-head">
                <div><div class="ar-name">${p.name}</div><div class="ar-meta">${p.yg} · ${p.cls} · ${p.tpsScoredCount} TPs scored</div></div>
                <div style="text-align:right">
                  <div style="font-family:var(--font-mono);font-size:1.25rem;font-weight:800;color:${avgCol}">${p.overallAvg.toFixed(1)}</div>
                  <div style="font-size:.56rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:#fca5a5">overall avg</div>
                </div>
              </div>
              <div class="ar-body">
                <div class="ar-section-label">Process vs Attitude</div>
                ${procBar}${attBar}
                ${p.concerns.length ? `
                  <div class="ar-section-label" style="margin-top:.6rem">Weak areas (avg below 2.5)</div>
                  <div style="display:flex;flex-wrap:wrap">${weakAreas}</div>
                ` : ''}
              </div>
            </div>`;
          }).join('')}
        </div>
      `}
    </div>`;

  // ── Class overview cards ──
  let classHTML='';
  let anyClass=false;

  activeYGs.forEach(yg=>{
    Object.keys(S.pupils[yg]).sort().forEach(cls=>{
      if(_ovCls!=='all' && cls!==_ovCls) return;
      const pupils=S.pupils[yg][cls]||[];
      if(!pupils.length) return;
      anyClass=true;
      const tps=TPS[yg];

      const procCfg=[
        {d:'creating',  lbl:'Creating',  col:'#7c3aed',fill:'f-cr'},
        {d:'presenting',lbl:'Presenting',col:'#0369a1',fill:'f-pr'},
        {d:'evaluating',lbl:'Evaluating',col:'#0f766e',fill:'f-ev'},
      ];

      const procBars=procCfg.map(({d,lbl,col,fill})=>{
        const vals=tps.flatMap(tp=>pupils.map(p=>S.scores[yg]?.[p.id]?.[tp.id]?.[d]).filter(v=>v>0));
        const a=avg(vals);
        return `<div class="ov-bar-row">
          <div class="ov-bar-lbl" style="color:${col};font-weight:700">${lbl}</div>
          <div class="ov-bar-wrap"><div class="ov-bar-fill ${fill}" style="width:${pct(a)}%"></div></div>
          <div class="ov-bar-val">${a?a.toFixed(1):'—'}</div>
        </div>`;
      }).join('');

      const tpRows=tps.map(tp=>{
        const vals=pupils.flatMap(p=>PROC_DIMS.map(d=>S.scores[yg]?.[p.id]?.[tp.id]?.[d]).filter(v=>v>0));
        const a=avg(vals);
        const bg=a?(a<2?'#ef4444':a<3?'#f59e0b':'#10b981'):'var(--border2)';
        const atRiskCount=pupils.filter(p=>PROC_DIMS.some(d=>{const v=S.scores[yg]?.[p.id]?.[tp.id]?.[d];return v>0&&v<=_arThreshold;})).length;
        return `<div class="ov-bar-row">
          <div class="ov-bar-lbl" style="font-family:var(--font-mono);font-size:.59rem">${tp.label}</div>
          <div class="ov-bar-wrap"><div class="ov-bar-fill" style="width:${pct(a)}%;background:${bg}"></div></div>
          <div class="ov-bar-val">${a?a.toFixed(1):'—'}</div>
          ${atRiskCount?`<span style="font-family:var(--font-mono);font-size:.58rem;font-weight:700;color:#ef4444;margin-left:.3rem;flex-shrink:0">${atRiskCount}⚠</span>`:''}
        </div>`;
      }).join('');

      // Per-pupil score rows for deep-dive when a single class is selected
      let pupilRowsHTML='';
      if(_ovCls!=='all'){
        const allDims=[...PROC_DIMS,...ATTIT_DIMS];
        const dimLabels={creating:'Cr',presenting:'Pr',evaluating:'Ev',effort:'Ef',behaviour:'Bh',homelearning:'HL'};
        const dimCols={creating:'#7c3aed',presenting:'#0369a1',evaluating:'#0f766e',effort:'#92400e',behaviour:'#be185d',homelearning:'#b45309'};
        const scoreBg={1:'var(--s1-bg)',2:'var(--s2-bg)',3:'var(--s3-bg)',4:'var(--s4-bg)'};
        const scoreCol={1:'var(--s1-text)',2:'var(--s2-text)',3:'var(--s3-text)',4:'var(--s4-text)'};

        pupilRowsHTML=`
          <div class="ov-sec">Individual Pupils</div>
          <div style="overflow-x:auto;border:1px solid var(--border);border-radius:6px;margin-top:.25rem">
            <table style="width:100%;border-collapse:collapse;font-size:.7rem;min-width:560px">
              <thead>
                <tr style="background:var(--navy-dark)">
                  <th style="padding:.45rem .75rem;text-align:left;color:rgba(255,255,255,.55);font-size:.55rem;font-weight:700;letter-spacing:.14em;text-transform:uppercase;white-space:nowrap;position:sticky;left:0;background:var(--navy-dark)">Pupil</th>
                  ${tps.map(tp=>`<th colspan="${allDims.length}" style="padding:.45rem .5rem;text-align:center;color:rgba(255,255,255,.45);font-size:.53rem;font-weight:700;letter-spacing:.1em;text-transform:uppercase;border-left:1px solid rgba(255,255,255,.07)">${tp.label}</th>`).join('')}
                </tr>
                <tr style="background:#1a2744">
                  <th style="padding:.3rem .75rem;position:sticky;left:0;background:#1a2744"></th>
                  ${tps.map(()=>allDims.map(d=>`<th style="padding:.28rem .3rem;text-align:center;font-size:.56rem;font-weight:700;color:${dimCols[d]};opacity:.8;white-space:nowrap;border-left:1px solid rgba(255,255,255,.04)">${dimLabels[d]}</th>`).join('')).join('')}
                </tr>
              </thead>
              <tbody>
                ${pupils.map((p,i)=>{
                  const arEntry=allAtRisk.find(r=>r.name===p.name&&r.cls===cls&&r.yg===yg.toUpperCase());
                  const atRisk=!!arEntry;
                  return `<tr style="${i%2===0?'':'background:#f8fafc'}${atRisk?';outline:1px solid #fca5a5':''}" ${atRisk?'title="At risk"':''}>
                    <td style="padding:.38rem .75rem;font-weight:${atRisk?'600':'500'};white-space:nowrap;position:sticky;left:0;background:${i%2===0?'#fff':'#f8fafc'};${atRisk?'color:#991b1b':''}">${atRisk?'▲ ':''} ${p.name}${arEntry?` <span style="font-family:var(--font-mono);font-size:.6rem;color:#ef4444">${arEntry.overallAvg.toFixed(1)}</span>`:''}</td>
                    ${tps.map(tp=>{
                      const sc=S.scores[yg]?.[p.id]?.[tp.id]||{};
                      return allDims.map(d=>{
                        const v=sc[d];
                        const isLow=v>0&&v<=_arThreshold;
                        return `<td style="padding:.3rem .3rem;text-align:center;border-left:1px solid var(--border)">
                          ${v>0?`<span style="display:inline-flex;align-items:center;justify-content:center;width:20px;height:20px;border-radius:3px;font-family:var(--font-mono);font-size:.65rem;font-weight:700;background:${isLow?'#fee2e2':scoreBg[v]||'var(--bg)'};color:${isLow?'#991b1b':scoreCol[v]||'var(--text3)'};${isLow?'outline:1px solid #fca5a5':''}">${v}</span>`:'<span style="color:var(--border2);font-size:.6rem">·</span>'}
                        </td>`;
                      }).join('');
                    }).join('')}
                  </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`;
      }

      const classAtRisk=allAtRisk.filter(r=>r.yg===yg.toUpperCase()&&r.cls===cls).length;
      classHTML+=`<div class="ov-card" ${classAtRisk?'style="border-color:#fca5a5"':''}>
        <div class="ov-head" ${classAtRisk?'style="background:#7f1d1d"':''}>
          <div class="ov-title">${yg.toUpperCase()} · ${cls}</div>
          <div style="display:flex;align-items:center;gap:.5rem">
            ${classAtRisk?`<span style="font-size:.6rem;font-weight:700;padding:.14rem .45rem;border-radius:3px;background:#ef4444;color:#fff">${classAtRisk} at risk</span>`:''}
            <div class="ov-meta">${pupils.length} pupils</div>
          </div>
        </div>
        <div class="ov-body">
          <div style="font-size:.55rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--text3);margin-bottom:.45rem">Year-to-date — Process Dimensions</div>
          ${procBars}
          <div class="ov-sec">By Tracking Period (process avg)</div>
          ${tpRows}
          ${pupilRowsHTML}
        </div>
      </div>`;
    });
  });

  if(!anyData){
    body.innerHTML='<div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>No data yet. Enter scores in the tracker panels first.</div>';
    return;
  }

  const viewLabel = _ovCls!=='all' ? `Showing: ${_ovYG==='all'?'All Years':_ovYG.toUpperCase()} · ${_ovCls}` : _ovYG!=='all' ? `Showing: ${_ovYG.toUpperCase()} · All Classes` : 'Showing: All Years · All Classes';

  body.innerHTML=`
    ${arHTML}
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.75rem;flex-wrap:wrap;gap:.5rem">
      <div style="font-size:.57rem;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:var(--text3)">Class Overview</div>
      <div style="font-size:.65rem;color:var(--text3);font-style:italic">${viewLabel}</div>
    </div>
    <div class="ov-grid">${anyClass?classHTML:'<div class="empty-s" style="grid-column:1/-1">No classes match the current filter.</div>'}</div>
  `;
}

// ══════════════════════════════════════════════════════════
// EXPORT
// ══════════════════════════════════════════════════════════
function renderExportPreview(){
  const el=document.getElementById('exp-preview');
  let rows=0;
  ['s1','s2','s3'].forEach(yg=>{
    Object.keys(S.pupils[yg]).forEach(cls=>{
      (S.pupils[yg][cls]||[]).forEach(p=>{
        TPS[yg].forEach(tp=>{
          const sc=S.scores[yg]?.[p.id]?.[tp.id]||{};
          if(PROC_DIMS.some(d=>sc[d]>0))rows++;
        });
      });
    });
  });
  el.innerHTML=rows?`<div style="font-size:.73rem;color:var(--text2)">${rows} scored TP rows ready across all year groups. The CSV includes one row per pupil per TP with all six dimensions plus notes.</div>`:'<div class="empty-s"><div class="empty-icon">📋</div>No scored data yet.</div>';
}

function exportForFacultyHead(){
  const name=prompt('Enter your name (for Faculty Head to identify your data):','');
  if(!name||!name.trim()){toast('Export cancelled');return;}
  const tp=prompt('Tracking period (e.g. TP1, TP2, Nov 2025 — helps avoid duplicates):',S.curTP?.s1||'TP1');
  const exportData={version:1,type:'staff_export',teacherName:name.trim(),trackingPeriod:(tp||'').trim()||null,subject:CFG.subject,exportDate:new Date().toISOString(),data:{pupils:S.pupils,scores:S.scores,profiles:S.profiles}};
  const blob=new Blob([JSON.stringify(exportData,null,2)],{type:'application/json'});
  const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${CFG.filePrefix}_StaffExport_${name.trim().replace(/\s+/g,'_')}_${(tp||'TP').trim().replace(/\s+/g,'_')}_${new Date().toISOString().slice(0,10)}.json`;document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(a.href);
  toast('Exported — give this file to your Faculty Head');
}
function sendToReportBuilder(){
  var out=[];
  ['s1','s2','s3'].forEach(function(yg){
    var tpIds=(TPS[yg]||[]).map(function(tp){ return tp.id; });
    var year=yg.toUpperCase();
    Object.keys(S.pupils[yg]||{}).forEach(function(cls){
      (S.pupils[yg][cls]||[]).forEach(function(p){
        var scoresByTp=S.scores[yg]&&S.scores[yg][p.id]?S.scores[yg][p.id]:{};
        var profile=S.profiles[yg]&&S.profiles[yg][p.id]?S.profiles[yg][p.id]:{};
        var notes='';
        tpIds.forEach(function(tpId){
          var n=scoresByTp[tpId]&&scoresByTp[tpId].notes;
          if(n&&String(n).trim()) notes=String(n).trim();
        });
        out.push(ReportBuilderBridge.buildTrackerExportEntry(CFG.subject, p, year, scoresByTp, tpIds, {
          cfeLevel: profile.cfeLevel||'',
          notes: notes
        }));
      });
    });
  });
  if(out.length===0){toast('No pupils to send. Add pupils in Class Setup first.');return;}
  var key=ReportBuilderBridge.EXPORT_KEYS[CFG.subject];
  if(window.DataService){DataService.set(key,out).then(function(){toast('Sent '+out.length+' pupils to Report Builder with suggested comments. Open the Report Builder and click Import from Tracker.');}).catch(function(){toast('Failed to send.');});}
  else{try{localStorage.setItem(key,JSON.stringify(out));toast('Sent '+out.length+' pupils to Report Builder with suggested comments. Open the Report Builder and click Import from Tracker.');}catch(e){toast('Failed to send.');}}
}

function exportCSV(target){
  const ygs=target==='all'?['s1','s2','s3']:[target];
  const date=new Date().toLocaleDateString('en-GB').replace(/\//g,'-');
  ygs.forEach(yg=>{
    const tps=TPS[yg];const rows=[];
    // header
    const h=['Year Group','Class','Pupil Name'];
    tps.forEach(tp=>{
      h.push(`${tp.label} Unit`);
      PROC_DIMS.forEach(d=>h.push(`${tp.label} ${PROC_LABELS[d]}`));
      ATTIT_DIMS.forEach(d=>h.push(`${tp.label} ${ATTIT_LABELS[d]}`));
      h.push(`${tp.label} Notes`);
    });
    rows.push(h);
    Object.keys(S.pupils[yg]).sort().forEach(cls=>{
      (S.pupils[yg][cls]||[]).forEach(p=>{
        const r=[yg.toUpperCase(),cls,p.name];
        tps.forEach(tp=>{
          const sc=S.scores[yg]?.[p.id]?.[tp.id]||{};
          r.push(tp.unit);
          PROC_DIMS.forEach(d=>r.push(sc[d]||''));
          ATTIT_DIMS.forEach(d=>r.push(sc[d]||''));
          r.push((sc.notes||'').replace(/,/g,';').replace(/\n/g,' '));
        });
        rows.push(r);
      });
    });
    if(rows.length<2){toast(`⚠️ No data for ${yg.toUpperCase()}`);return;}
    const csv=rows.map(r=>r.map(c=>`"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob=new Blob(['\uFEFF'+csv],{type:'text/csv;charset=utf-8;'});
    const url=URL.createObjectURL(blob);
    const a=document.createElement('a');a.href=url;a.download=`${CFG.filePrefix}_Tracker_${yg.toUpperCase()}_${date}.csv`;
    document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
  });
  toast('✅ Exported — check Downloads');
}

// ── INIT ──
const SAVE_STATUS={
  loading:['Loading…','muted','Loading your tracker'],
  saved:['Saved','ok','Everything is saved to the cloud'],
  pending:['Saving…','muted','Saving your changes'],
  saving:['Saving…','muted','Saving your changes'],
  retrying:['Not saved — retrying','warn','Saving failed. It will keep trying; your changes are kept on this device.'],
  offline:['Offline — kept on this device','warn','No connection. Changes are kept on this device and saved when you are back online.'],
  'load-failed':['Not loaded','bad','Your tracker did not load. Nothing is saved until it does.'],
  'signed-out':['Signed out','bad','You are signed out. Sign in again to load and save your tracker.'],
  local:['Saved on this device only','warn','Not connected to the cloud. Data is saved in this browser only.'],
};
function renderSaveStatus(status){
  if(window.TrackerReadonlyView&&TrackerReadonlyView.isActive())return;
  const el=document.getElementById('storage-indicator');
  const cfg=SAVE_STATUS[status]||SAVE_STATUS.saved;
  if(el){el.innerHTML=`<span class="save-status save-status--${cfg[1]}">${cfg[0]}</span>`;el.title=cfg[2];}
  const banner=document.getElementById('sync-banner');
  if(status==='load-failed'||status==='signed-out'){
    const html=status==='signed-out'
      ?`<span>You're signed out, so your tracker can't load or save.</span><a class="btn btn-primary" href="login.html?redirect=${encodeURIComponent(location.pathname.replace(/^\//,'')+location.search)}" target="_top">Sign in again</a>`
      :`<span>Your tracker didn't load, so nothing you change here will be saved.</span><button type="button" class="btn btn-primary" onclick="retryLoad()">Retry</button>`;
    if(banner)banner.innerHTML=html;
    else{const b=document.createElement('div');b.id='sync-banner';b.className='sync-banner';b.setAttribute('role','alert');b.innerHTML=html;const c=document.querySelector('.content');if(c)c.insertBefore(b,c.firstChild);}
  }else if(banner&&status!=='loading')banner.remove();
}
function updateStorageIndicator(){renderSaveStatus(SYNC.status());}
function currentPanelId(){const p=document.querySelector('.panel.active');return p?p.id.replace('panel-',''):'home';}
function rerenderCurrent(){
  const id=currentPanelId();
  if(id==='home')renderHome();
  else if(id.startsWith('setup-'))renderSetup(id.replace('setup-',''));
  else if(id.startsWith('tracker-'))renderTracker(id.replace('tracker-',''));
  else if(id==='profiles')renderProfiles();
  else if(id==='benchmarks')renderBenchmarks();
  else if(id==='overview')renderOverview();
  else if(id==='export')renderExportPreview();
}
// Another device saved. Leave the screen alone while someone is typing; the data is already merged.
function rerenderAfterRemote(){
  ensureTrackerShape();
  const a=document.activeElement;
  if(a&&/^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName))return;
  rerenderCurrent();
  toast('Updated with changes saved on another device');
}
function retryLoad(){
  load().then(function(){
    if(!SYNC.isLoaded())return;
    return syncFromClassManagement().then(function(){rerenderCurrent();toast('Tracker loaded');});
  });
}
annotateSidebarItems();
initSidebarState();
TrackerKeyboard.init({
  dims:[...PROC_DIMS,...ATTIT_DIMS],
  current:(yg,pid,dim)=>S.scores[yg]?.[pid]?.[S.curTP[yg]]?.[dim],
  setScore:(yg,pid,dim,val,btn)=>setScore(yg,pid,S.curTP[yg],dim,val,btn),
  switchDim:(yg,dim)=>setColDim(yg,dim),
});
if(window.TrackerReadonlyView&&TrackerReadonlyView.isConfigured()){
  TrackerReadonlyView.boot({
    state:S,dataType:CFG.dataType,subjectLabel:CFG.name+' BGE tracker',
    loadOwn:load,syncClasses:syncFromClassManagement,
    afterLoad:function(){if(CFG.migrateLegacyProgress)migrateLegacyProgressScores();},
    onReady:function(){updateStorageIndicator();renderHome();}
  });
}else{
  load()
    .then(function(){ return syncFromClassManagement(); })
    .then(function(){updateStorageIndicator();renderHome();});
}

// ── PAGE LAYOUT ──
function trackerShellHTML(){return `<button type="button" class="ipad-backdrop" onclick="trackerIpadClose()" aria-label="Close navigation"></button>
<aside class="sidebar">
  <div class="sb-logo">
    <button type="button" class="sb-toggle" onclick="toggleSidebar()" title="Collapse/expand navigation" aria-label="Toggle sidebar">
      <svg id="sb-toggle-icon" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M15 18l-6-6 6-6"/></svg>
    </button>
    <a href="faculty-hub.html" class="sb-logo-link"><img src="faculty-hub-logo.png" alt="Faculty Hub" class="sb-logo-img"></a>
    <div class="sb-logo-title">${SUBJ_HTML} BGE Tracker</div>
    <div class="sb-logo-sub">Knightswood Secondary School</div>
  </div>
  <div class="sb-section">
    <button class="sb-item active" onclick="nav('home')" data-panel="home"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9.5z"/><polyline points="9 21 9 12 15 12 15 21"/></svg>Home</button>
    <div class="sb-divider"></div>
    <div class="sb-label">Class Setup</div>
    <button class="sb-item" onclick="nav('setup-s1')" data-panel="setup-s1"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>S1 — Set Up Classes</button>
    <button class="sb-item" onclick="nav('setup-s2')" data-panel="setup-s2"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>S2 — Set Up Classes</button>
    <button class="sb-item" onclick="nav('setup-s3')" data-panel="setup-s3"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>S3 — Set Up Classes</button>
    <div class="sb-divider"></div>
    <div class="sb-label">Enter Scores</div>
    <button class="sb-item" onclick="nav('tracker-s1')" data-panel="tracker-s1"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>S1 — Enter Scores</button>
    <button class="sb-item" onclick="nav('tracker-s2')" data-panel="tracker-s2"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>S2 — Enter Scores</button>
    <button class="sb-item" onclick="nav('tracker-s3')" data-panel="tracker-s3"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>S3 — Enter Scores</button>
    <div class="sb-divider"></div>
    <div class="sb-label">Learner Conversations</div>
    <button class="sb-item" onclick="nav('profiles')" data-panel="profiles"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>Pupil Profiles</button>
    <div class="sb-divider"></div>
    <div class="sb-label">Analysis</div>
    <button class="sb-item" onclick="nav('benchmarks')" data-panel="benchmarks"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>Benchmark Analysis</button>
    <button class="sb-item" onclick="nav('overview')" data-panel="overview"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>Progress Overview</button>
    <button class="sb-item" onclick="nav('export')" data-panel="export"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:.45rem;vertical-align:-1px;flex-shrink:0"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export &amp; Send</button>
    <div class="sb-divider"></div>
    <div class="sb-signout">
      <button type="button" class="sb-item" style="width:100%;text-align:left;background:none;border:none;cursor:pointer" onclick="try{(window.doSignOut||function(){window.clearSupabaseAuth&&window.clearSupabaseAuth();location.href='login.html?signout=1';})();}catch(e){window.clearSupabaseAuth&&window.clearSupabaseAuth();location.href='login.html?signout=1';}">Sign out</button>
    </div>
  </div>
</aside>

<div class="main">
  <div class="topbar">
    <button type="button" class="btn btn-ghost ipad-menu" onclick="toggleSidebar()" aria-label="Open navigation">Menu</button>
    <div class="topbar-heading" id="tb-heading">${SUBJ_HTML} BGE <span>Tracker</span></div>
    <div id="storage-indicator" class="topbar-actions" style="font-size:.7rem;color:var(--text3);margin-right:.5rem"></div>
    <div class="topbar-actions">
      <button class="btn btn-ghost" onclick="autoSave()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>Save</button>
      <button class="btn btn-primary" onclick="nav('export')"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>Export</button>
    </div>
  </div>

  <div class="content">

    <!-- HOME -->
    <div id="panel-home" class="panel active">
      <div class="hero">
        <div class="hero-eyebrow">Knightswood Secondary School · Faculty of Art &amp; Drama</div>
        <div class="hero-title">${SUBJ_HTML} BGE <span>Pupil Tracker</span></div>
        <div class="hero-desc">Enter scores for the class in front of you.</div>
        <div class="hero-stats" id="home-stats"></div>
      </div>

      <div id="home-todo"></div>

      <details class="task-more">
        <summary>What the scores mean</summary>
        <div class="task-more-body">
          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:.7rem;margin-bottom:.9rem">
            <div style="padding:.85rem 1rem;border-radius:6px;background:var(--cr-bg);border:1px solid var(--cr-bd)">
              <div style="font-family:var(--font-heading);font-size:.8rem;font-weight:700;color:#6d28d9;margin-bottom:.2rem">Creating</div>
              <div style="font-size:.71rem;color:var(--text2);line-height:1.65">${CFG.homeDims.creating}</div>
            </div>
            <div style="padding:.85rem 1rem;border-radius:6px;background:var(--pr-bg);border:1px solid var(--pr-bd)">
              <div style="font-family:var(--font-heading);font-size:.8rem;font-weight:700;color:#0369a1;margin-bottom:.2rem">Presenting</div>
              <div style="font-size:.71rem;color:var(--text2);line-height:1.65">${CFG.homeDims.presenting}</div>
            </div>
            <div style="padding:.85rem 1rem;border-radius:6px;background:var(--ev-bg);border:1px solid var(--ev-bd)">
              <div style="font-family:var(--font-heading);font-size:.8rem;font-weight:700;color:#0f766e;margin-bottom:.2rem">Evaluating</div>
              <div style="font-size:.71rem;color:var(--text2);line-height:1.65">${CFG.homeDims.evaluating}</div>
            </div>
            <div style="padding:.85rem 1rem;border-radius:6px;background:#fef9ee;border:1px solid #fcd34d">
              <div style="font-family:var(--font-heading);font-size:.8rem;font-weight:700;color:#92400e;margin-bottom:.2rem">Effort · Behaviour · Home Learning</div>
              <div style="font-size:.71rem;color:var(--text2);line-height:1.65">Attitudinal markers recorded alongside process scores for the full BGE tracking picture.</div>
            </div>
          </div>
          <div style="background:var(--bg);border-radius:5px;padding:.7rem 1rem;font-size:.71rem;color:var(--text2);line-height:1.8">
            <strong>Score scale:</strong>&nbsp;
            <span style="padding:.09rem .38rem;border-radius:3px;background:var(--s1-bg);color:var(--s1-text);font-weight:700;margin-right:.25rem">1</span>Working on Targets &nbsp;·&nbsp;
            <span style="padding:.09rem .38rem;border-radius:3px;background:var(--s2-bg);color:var(--s2-text);font-weight:700;margin-right:.25rem">2</span>Not Yet on Track &nbsp;·&nbsp;
            <span style="padding:.09rem .38rem;border-radius:3px;background:var(--s3-bg);color:var(--s3-text);font-weight:700;margin-right:.25rem">3</span>On Track &nbsp;·&nbsp;
            <span style="padding:.09rem .38rem;border-radius:3px;background:var(--s4-bg);color:var(--s4-text);font-weight:700;margin-right:.25rem">4</span>Above Expectations &nbsp;·&nbsp;
            <span style="padding:.09rem .38rem;border-radius:3px;background:#f1f5f9;color:var(--text2);font-weight:700;margin-right:.25rem">N/A</span>Not assessed this TP
          </div>
        </div>
      </details>

      <div class="yg-cards" id="yg-cards">
        <div class="yg-card" onclick="nav('tracker-s1')">
          <div class="yg-year">S1</div><div class="yg-sub">${SUBJ_HTML} · ${CFG.yearLevels.s1}</div>
          <div class="yg-meta" id="hm-s1">0 classes · 0 pupils</div>
          <div class="yg-foot"><span class="yg-go">Enter scores</span><button type="button" class="yg-setup" onclick="event.stopPropagation();nav('setup-s1')">Set up classes</button></div>
        </div>
        <div class="yg-card" onclick="nav('tracker-s2')">
          <div class="yg-year">S2</div><div class="yg-sub">${SUBJ_HTML} · ${CFG.yearLevels.s2}</div>
          <div class="yg-meta" id="hm-s2">0 classes · 0 pupils</div>
          <div class="yg-foot"><span class="yg-go">Enter scores</span><button type="button" class="yg-setup" onclick="event.stopPropagation();nav('setup-s2')">Set up classes</button></div>
        </div>
        <div class="yg-card" onclick="nav('tracker-s3')">
          <div class="yg-year">S3</div><div class="yg-sub">${SUBJ_HTML} · ${CFG.yearLevels.s3}</div>
          <div class="yg-meta" id="hm-s3">0 classes · 0 pupils</div>
          <div class="yg-foot"><span class="yg-go">Enter scores</span><button type="button" class="yg-setup" onclick="event.stopPropagation();nav('setup-s3')">Set up classes</button></div>
        </div>
      </div>
    </div>

    <div id="panel-setup-s1" class="panel"></div>
    <div id="panel-setup-s2" class="panel"></div>
    <div id="panel-setup-s3" class="panel"></div>
    <div id="panel-tracker-s1" class="panel"></div>
    <div id="panel-tracker-s2" class="panel"></div>
    <div id="panel-tracker-s3" class="panel"></div>

    <!-- PUPIL PROFILES -->
    <div id="panel-profiles" class="panel">
      <div class="sc">
        <div class="sc-header">
          <div><div class="sc-title">Pupil Profiles</div><div class="sc-sub">Choose a pupil, then add the conversation notes.</div></div>
        </div>
        <div class="sc-body" id="profiles-body"></div>
      </div>
    </div>

    <!-- BENCHMARK ANALYSIS -->
    <div id="panel-benchmarks" class="panel">
      <div class="sc">
        <div class="sc-header">
          <div><div class="sc-title">Benchmark Analysis</div><div class="sc-sub">Open a row to read the benchmark.</div></div>
          <button class="btn btn-ghost" onclick="renderBenchmarks()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refresh</button>
        </div>
        <div class="sc-body" id="bm-body"><div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg></div>Enter scores first, then refresh.</div></div>
      </div>
    </div>

    <!-- OVERVIEW -->
    <div id="panel-overview" class="panel">
      <div class="sc">
        <div class="sc-header">
          <div><div class="sc-title">Progress Overview</div><div class="sc-sub">Choose a year or class.</div></div>
          <button class="btn btn-ghost" onclick="renderOverview()"><svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>Refresh</button>
        </div>
        <div class="sc-body" style="padding:.85rem 1.5rem;border-bottom:1px solid var(--border)">
          <div id="ov-filter-bar" style="display:flex;gap:.85rem;align-items:center;flex-wrap:wrap">
            <div style="font-size:.58rem;font-weight:700;letter-spacing:.16em;text-transform:uppercase;color:var(--text3)">Filter</div>
            <div id="ov-yg-filters" style="display:flex;gap:.3rem;flex-wrap:wrap"></div>
            <div style="width:1px;height:18px;background:var(--border2);flex-shrink:0"></div>
            <div id="ov-cls-filters" style="display:flex;gap:.3rem;flex-wrap:wrap"><span style="font-size:.7rem;color:var(--text3)">Add pupils to see classes</span></div>
          </div>
        </div>
        <div class="sc-body" id="ov-body"><div class="empty-s"><div class="empty-icon"><svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg></div>Enter scores first, then refresh.</div></div>
      </div>
    </div>

    <!-- EXPORT -->
    <div id="panel-export" class="panel">
      <div class="export-lead">
        <button class="btn btn-primary" onclick="sendToReportBuilder()">Send to Report Builder</button>
        <p class="export-lead-note">Suggested report comments from the scores already entered.</p>
      </div>
      <div class="export-downloads">
        <button class="btn btn-green" onclick="exportCSV('s1')">Download S1</button>
        <button class="btn btn-green" onclick="exportCSV('s2')">Download S2</button>
        <button class="btn btn-green" onclick="exportCSV('s3')">Download S3</button>
        <button class="btn btn-ghost" onclick="exportCSV('all')">Download all years</button>
        <button class="btn btn-ghost" onclick="exportForFacultyHead()">Export for Faculty Head</button>
      </div>
      <details class="task-more">
        <summary>How to email or hand a class over</summary>
        <div class="task-more-body">
          <p>Email the file to <span class="mono">r.mccolm@knightswood.glasgow.sch.uk</span>. Subject: <span class="mono">${CFG.filePrefix} Tracker - [Year] - [TP] - [Your Name]</span></p>
          <p>To hand a class to another teacher, use Export on that class card in Class Setup. They use Import from teacher.</p>
        </div>
      </details>
      <details class="task-more">
        <summary>Preview</summary>
        <div class="task-more-body" id="exp-preview"><div class="empty-s">No scored data yet.</div></div>
      </details>
    </div>
</div>

<div class="modal-overlay" id="modal-overlay">
  <div class="modal">
    <div class="modal-title" id="m-title">Confirm</div>
    <div class="modal-desc" id="m-desc"></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
      <button class="btn btn-danger" id="m-ok">Confirm</button>
    </div>
  </div>
</div>
<div class="toast" id="toast"></div>

`;}
