import { jsPDF } from 'jspdf';
import type { Project } from './types';
export async function exportPDF(project:Project,evidence:boolean,messages:boolean) {
 const doc=new jsPDF();
 const font=await fetch('./fonts/NotoSans-Regular.ttf').then(r=>{if(!r.ok)throw new Error('Font unavailable');return r.arrayBuffer();});
 const bytes=new Uint8Array(font);let binary='';for(let i=0;i<bytes.length;i++)binary+=String.fromCharCode(bytes[i]);doc.addFileToVFS('NotoSans.ttf',btoa(binary));doc.addFont('NotoSans.ttf','NotoSans','normal');doc.addFont('NotoSans.ttf','NotoSans','bold');doc.setFont('NotoSans');let y=22;const margin=18;const width=174;
 function page(need=20){if(y+need>276){doc.addPage();y=22;}}
 function text(value:string,size=11,bold=false){doc.setFont('NotoSans',bold?'bold':'normal');value=value.replace(/\p{Extended_Pictographic}|\uFE0F/gu,'');doc.setFontSize(size);const lines=doc.splitTextToSize(value,width);for(const line of lines){page(7);doc.text(line,margin,y);y+=size*.48;}y+=4;}
 function image(src:string,maxH=110){if(!src)return;try{const props=doc.getImageProperties(src);const w=Math.min(width,maxH*props.width/props.height);const h=w*props.height/props.width;page(h+8);doc.addImage(src,'JPEG',margin,y,w,h);y+=h+7;}catch{text('[Image could not be rendered]');}}
 text('StageFeed',25,true);text(evidence?'Full evidence portfolio':'Visual profile',15);text('Fictional social media simulation · All conversations and counts are authored fiction.',9);
 text(project.name,22,true);text(`@${project.username} · ${project.production}`);if(project.pupil)text(`Submitted by: ${project.pupil}`);if(project.mode==='designer')text(`Specialism: ${project.specialism}`);image(project.avatar,45);text(project.bio);text(`${project.posts.filter(p=>!p.draft).length} posts · ${project.followers} fictional followers · ${project.following} fictional following`,9);
 const posts=project.posts.filter(p=>!p.draft);if(posts.length){page(62);text('Profile grid',15,true);const size=54;for(let i=0;i<posts.length;i+=3){page(size+7);posts.slice(i,i+3).forEach((p,j)=>{try{const props=doc.getImageProperties(p.images[0]);const factor=Math.min(size/props.width,size/props.height);const w=props.width*factor,h=props.height*factor;doc.addImage(p.images[0],'JPEG',margin+j*58,y,w,h);}catch{}});y+=size+7;}}
 for(const p of [...posts].sort((a,b)=>a.date.localeCompare(b.date))){doc.addPage();y=22;text(`${p.date} · @${project.username}`,11,true);if(p.category)text(p.category,10);p.images.forEach(src=>image(src));text(p.caption);text(`${p.likes} fictional likes`,9);for(const c of p.comments)text(`${c.author}: ${c.text}`,10);if(evidence){if(p.thinking){text(project.mode==='character'?'Character Thinking':'Design Thinking',13,true);text(p.thinking);}if(p.evidence){text('Script evidence / research references',12,true);text(p.evidence);}}}
 if(project.stories.length){doc.addPage();y=22;text('Stories & highlights',18,true);for(const s of project.stories){text(s.highlight||'Story',12,true);image(s.image,75);text(s.text);}}
 if(messages){for(const c of project.conversations){doc.addPage();y=22;text(`Fictional conversation with ${c.name}`,16,true);for(const m of c.messages){text(`${m.time} · ${m.side==='me'?project.name:c.name}: ${m.text}`,10);if(m.image)image(m.image,60);}}}
 const pages=doc.getNumberOfPages();for(let i=1;i<=pages;i++){doc.setPage(i);doc.setFontSize(8);doc.setTextColor(100);doc.text(`StageFeed · Fictional project · ${i} / ${pages}`,18,289);doc.setTextColor(0);}
 doc.save(`${project.username}-${evidence?'evidence':'profile'}.pdf`);
}
