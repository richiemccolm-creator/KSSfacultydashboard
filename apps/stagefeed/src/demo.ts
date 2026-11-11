import {blankProject,uid} from './types';
import {imageData} from './storage';
export async function makeDemo() {
 const p=blankProject('character');
 const photos=await Promise.all(['portrait','green','window','flowers','courtyard','fabric','moon','door','dress'].map(n=>imageData(`./media/${n}.jpg`)));
 return {...p,name:'Adela Alba',username:'adela.alba',production:'The House of Bernarda Alba',author:'Federico García Lorca',bio:'They can lock the doors. Not the sky.\nA little green in a house of black. 🕊',avatar:photos[0],followers:218,following:86,demo:true,posts:[
 ['Some colours refuse to be quiet. And so do I. #GreenDress #Freedom',1,'Act I · The green dress','The green dress reveals Adela’s refusal to accept the mourning imposed by Bernarda.','Act I: Adela reveals her green dress.'],
 ['There is a whole world on the other side of this window. #BeyondTheseWalls',2,'Act II · At the window','The window is a boundary between her public obedience and private longing.','Act II: the sisters listen to the reapers outside.'],
 ['Even here, something finds a way to bloom. #SmallRebellions',3,'Act I · In the courtyard','',''],
 ['The house is quiet. My mind is anything but. #BernardaAlba',4,'Act II · Afternoon','',''],
 ['Keeping a little piece of the life I want. #Green #Hope',5,'Act I · A different future','',''],
 ['Some things only belong to the night. #Secrets',6,'Act III · After dark','',''],
 ['An open door. Imagine that. #Freedom',7,'Act III · The door','',''],
 ['Not everything has to be black. #AdelaAlba',8,'Act I · Refusing mourning','','']
 ].map(([caption,i,category,thinking,evidence],idx)=>({id:uid(),images:[photos[Number(i)]],caption:String(caption),date:`1936-06-${String(18-idx).padStart(2,'0')}`,likes:[42,31,28,19,36,24,18,45][idx],liked:false,saved:false,comments:idx===0?[{id:uid(),author:'martirio',text:'Mother will see this.'},{id:uid(),author:'adela.alba',text:'Let her.'}]:[],category:String(category),thinking:String(thinking),evidence:String(evidence),draft:false,ratio:'1 / 1'})),stories:[{id:uid(),image:photos[1],text:'A colour of my own.',color:'#273b2c',style:'serif',highlight:'Little rebellions'},{id:uid(),image:photos[2],text:'Beyond these walls',color:'#302b3d',style:'sans',highlight:'Daydreams'},{id:uid(),image:photos[3],text:'Still growing.',color:'#48312d',style:'serif',highlight:'The courtyard'}],conversations:[{id:uid(),name:'Martirio',username:'martirio',messages:[{id:uid(),side:'them' as const,text:'I saw the green dress.',time:'18:32'},{id:uid(),side:'me' as const,text:'Then you know I am not giving up everything.',time:'18:34'}]}]};
}
