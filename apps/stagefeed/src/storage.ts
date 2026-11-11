import Dexie, { type EntityTable } from 'dexie';
import type { Project } from './types';
export const db = new Dexie('stagefeed-v1') as Dexie & {projects:EntityTable<Project,'id'>};
db.version(1).stores({projects:'id, updated, name'});
export function saveProject(project:Project) { return db.projects.put(project); }
export function download(data:Blob,name:string) { const a=document.createElement('a');a.href=URL.createObjectURL(data);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000); }
export function backup(project:Project) { download(new Blob([JSON.stringify({format:'stagefeed',version:1,project})],{type:'application/json'}),`${project.username||'project'}.stagefeed.json`); }
function validImage(v:unknown):boolean { return typeof v==='string' && (v==='' || /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(v)); }
export function parseBackup(raw:string):Project {
 const x=JSON.parse(raw); const p=x?.project;
 const str=(v:unknown)=>typeof v==='string'&&v.length<=100000;
 const num=(v:unknown)=>typeof v==='number'&&Number.isFinite(v)&&v>=0;
 if(x.format!=='stagefeed'||x.version!==1||!p||!['character','designer'].includes(p.mode)||!['id','name','production','author','specialism','username','bio','updated','pupil'].every(k=>str(p[k]))||!validImage(p.avatar)||!num(p.followers)||!num(p.following)||!Array.isArray(p.posts)||!Array.isArray(p.stories)||!Array.isArray(p.conversations)||!Array.isArray(p.activity)) throw new Error('This is not a valid StageFeed version 1 project.');
 for(const post of p.posts) if(!['id','caption','date','category','thinking','evidence','ratio'].every(k=>str(post[k]))||!Array.isArray(post.images)||!post.images.every(validImage)||!num(post.likes)||!Array.isArray(post.comments)||!post.comments.every((c:any)=>['id','author','text'].every(k=>str(c[k])))||!['liked','saved','draft'].every(k=>typeof post[k]==='boolean')) throw new Error('The backup contains an invalid post.');
 for(const s of p.stories) if(!['id','text','color','style','highlight'].every(k=>str(s[k]))||!validImage(s.image)) throw new Error('The backup contains an invalid story.');
 for(const c of p.conversations) if(!str(c.id)||!str(c.name)||!str(c.username)||!Array.isArray(c.messages)||!c.messages.every((m:any)=>str(m.id)&&str(m.text)&&str(m.time)&&['me','them'].includes(m.side)&&(!m.image||validImage(m.image)))) throw new Error('The backup contains an invalid conversation.');
 if(!p.activity.every((a:any)=>str(a.id)&&str(a.text)&&str(a.date))) throw new Error('The backup contains invalid activity.');
 return {...p,demo:false,simplified:!!p.simplified};
}
export async function readImage(file:File):Promise<string> {
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)) throw new Error('Choose a JPEG, PNG or WebP image.');
 if(file.size>20*1024*1024) throw new Error('Choose an image smaller than 20 MB.');
 const url=URL.createObjectURL(file);
 try { const img=new Image();img.src=url;await img.decode(); const scale=Math.min(1,1600/Math.max(img.width,img.height));const canvas=document.createElement('canvas');canvas.width=img.width*scale;canvas.height=img.height*scale;canvas.getContext('2d')!.drawImage(img,0,0,canvas.width,canvas.height);return canvas.toDataURL('image/jpeg',0.86); } finally {URL.revokeObjectURL(url);}
}
export async function imageData(url:string) { const blob=await fetch(url).then(r=>r.blob()); return await new Promise<string>(resolve=>{ const r=new FileReader();r.onload=()=>resolve(r.result as string);r.readAsDataURL(blob); }); }
