import {useEffect,useRef,type ReactNode} from 'react';
import {X,Upload,UserRound} from 'lucide-react';
import {readImage} from './storage';
export function Avatar({src,name,size=42}:{src?:string;name:string;size?:number}) {return <span className="avatar" style={{width:size,height:size}}>{src?<img src={src} alt={`${name}'s profile`}/>:<UserRound size={size*.44}/>}</span>;}
export function Modal({title,onClose,children,wide=false}:{title:string;onClose:()=>void;children:ReactNode;wide?:boolean}) {
 const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const el=ref.current!;el.showModal();return()=>el.close();},[]);
 return <dialog ref={ref} className={wide?'modal wide':'modal'} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose();}} onKeyDown={e=>{if(e.key==='Escape')onClose();}}><header><h2>{title}</h2><button className="icon" aria-label="Close dialog" onClick={onClose}><X/></button></header><div className="modal-body">{children}</div></dialog>;
}
export function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}
export function ImageUpload({onImages,multiple=false,children,onError}:{onImages:(images:string[])=>void;multiple?:boolean;children?:ReactNode;onError:(message:string)=>void}) {return <label className="upload"><input type="file" accept="image/jpeg,image/png,image/webp" multiple={multiple} onChange={async e=>{try{const files=[...e.target.files||[]];if(files.length>12)throw new Error('Choose up to 12 images at a time.');onImages(await Promise.all(files.map(readImage)));}catch(err){onError((err as Error).message);}e.target.value='';}}/><Upload size={19}/>{children||'Upload image'}</label>;}
export function Empty({title,children}:{title:string;children:ReactNode}){return <div className="empty"><h2>{title}</h2><p>{children}</p></div>;}
