import {describe,it,expect} from 'vitest';
import {parseBackup} from './storage';
import {blankProject,uid} from './types';
const image='data:image/jpeg;base64,aGVsbG8=';
function fixture(){const p=blankProject('character');p.name='Adela';p.username='adela';p.avatar=image;p.posts=[{id:uid(),images:[image,image,image],caption:'Green #Freedom',date:'1936-06-18',likes:42,liked:false,saved:true,comments:[{id:uid(),author:'martirio',text:'Mother will see this.'}],category:'',thinking:'Resistance',evidence:'Act I',draft:false,ratio:'1 / 1'}];return {format:'stagefeed',version:1,project:p};}
describe('portable backup validation',()=>{
 it('round trips media, captions, comments and evidence without losing data',()=>{const x=fixture();expect(parseBackup(JSON.stringify(x))).toEqual(x.project);});
 it('rejects unsupported versions',()=>{expect(()=>parseBackup(JSON.stringify({...fixture(),version:2}))).toThrow();});
 it('rejects truncated JSON',()=>{expect(()=>parseBackup('{"format":')).toThrow();});
 it('rejects externally hosted media',()=>{const x=fixture();x.project.avatar='https://example.com/tracker.jpg';expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
 it('rejects malformed comments',()=>{const x=fixture();(x.project.posts[0].comments as unknown[])=[{author:{bad:'data'}}];expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
 it('rejects negative fictional counts',()=>{const x=fixture();x.project.followers=-1;expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
 it('rejects non-image data URLs',()=>{const x=fixture();x.project.posts[0].images=['data:text/html;base64,aGVsbG8='];expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
 it('rejects malformed message sides',()=>{const x=fixture();x.project.conversations=[{id:'chat',name:'Martirio',username:'martirio',messages:[{id:'msg',side:'invalid' as 'me',text:'Hi',time:'18:32'}]}];expect(()=>parseBackup(JSON.stringify(x))).toThrow();});
});
