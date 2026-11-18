import {useEffect,useState} from 'react';
import {Copy,Maximize2,Share2,X} from 'lucide-react';
import {Modal} from './ui';

/** The address pupils open: wherever StageFeed is hosted, without any query string. */
export function appUrl(){return `${location.origin}${location.pathname.replace(/[^/]*$/,'')}index.html`;}
const shortUrl=(u:string)=>u.replace(/^https?:\/\//,'').replace(/\/index\.html$/,'');

async function qrSvg(text:string){const QR=await import('qrcode');return QR.toString(text,{type:'svg',margin:1,errorCorrectionLevel:'M',color:{dark:'#111114',light:'#ffffff'}});}

/** Share StageFeed with a link or QR code, e.g. on the class board. */
export function ShareSheet({onClose}:{onClose:()=>void}){
 const url=appUrl();
 const [svg,setSvg]=useState(''),[board,setBoard]=useState(false),[note,setNote]=useState('');
 useEffect(()=>{qrSvg(url).then(setSvg).catch(()=>setNote('The QR code could not be drawn. Share the link instead.'));},[url]);
 useEffect(()=>{if(!board)return;const k=(e:KeyboardEvent)=>{if(e.key==='Escape')setBoard(false);};addEventListener('keydown',k);return()=>removeEventListener('keydown',k);},[board]);
 const copy=async()=>{try{await navigator.clipboard.writeText(url);setNote('Link copied');}catch{setNote('Copy failed. Select the link and copy it.');}};
 if(board)return <div className="share-board" role="dialog" aria-modal="true" aria-label="QR code for StageFeed" onClick={()=>setBoard(false)}><button className="icon share-board-close" aria-label="Close" onClick={()=>setBoard(false)}><X size={28}/></button><h2>Scan to open StageFeed</h2><div className="share-board-qr" dangerouslySetInnerHTML={{__html:svg}}/><p className="share-board-url">{shortUrl(url)}</p></div>;
 return <Modal title="Share StageFeed" onClose={onClose}><div className="share">
  <p className="muted">Anyone can use StageFeed from this link. No account is needed, and each person's projects stay on their own device.</p>
  <div className="share-qr" role="img" aria-label="QR code for StageFeed" dangerouslySetInnerHTML={{__html:svg}}/>
  <p className="share-url">{url}</p>
  <div className="share-actions"><button onClick={copy}><Copy size={16}/>Copy link</button>{'share' in navigator&&<button onClick={()=>navigator.share({title:'StageFeed',url}).catch(()=>{})}><Share2 size={16}/>Share…</button>}<button className="primary" onClick={()=>setBoard(true)}><Maximize2 size={16}/>Show on board</button></div>
  {note&&<p className="share-note" role="status">{note}</p>}
  <p className="hint">Tip: on iPad, open the link in Safari and choose <strong>Share › Add to Home Screen</strong> to install it like an app. It then works offline.</p>
 </div></Modal>;
}
