export type Mode = 'character' | 'designer';
export const categories = ['Inspiration','Research','Initial Idea','Experimentation','Development','Feedback','Final Design','Evaluation'];
export const specialisms = ['Costume','Make-up and hair','Set','Lighting','Sound','Props'];
export interface Comment { id:string; author:string; text:string }
export interface Post { id:string; images:string[]; caption:string; date:string; likes:number; liked:boolean; saved:boolean; comments:Comment[]; category:string; thinking:string; evidence:string; draft:boolean; ratio:string }
export interface Story { id:string; image:string; text:string; color:string; style:string; highlight:string }
export interface Message { id:string; side:'me'|'them'; text:string; image?:string; time:string }
export interface Conversation { id:string; name:string; username:string; messages:Message[] }
export interface Activity { id:string; text:string; date:string; postId?:string }
export interface Project { id:string; name:string; mode:Mode; production:string; author:string; specialism:string; username:string; bio:string; avatar:string; followers:number; following:number; posts:Post[]; stories:Story[]; conversations:Conversation[]; activity:Activity[]; updated:string; demo:boolean; simplified:boolean; pupil:string }
export const uid = () => crypto.randomUUID();
export const today = () => new Date().toISOString().slice(0,10);
export function blankProject(mode:Mode):Project { return {id:uid(),name:'',mode,production:'',author:'',specialism:'Costume',username:'',bio:'',avatar:'',followers:0,following:0,posts:[],stories:[],conversations:[],activity:[],updated:new Date().toISOString(),demo:false,simplified:false,pupil:''}; }
