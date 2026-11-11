/** Plain text clipboard boundary. Reads occur only after an explicit user action. NY-28: migrated from hand-written
 *  JavaScript (ADR-134); the behaviour is unchanged (`clipboard.test.mjs`). */
export async function readClipboard({limit=1024*1024,clipboard=globalThis.navigator?.clipboard}:{limit?:number;clipboard?:Pick<Clipboard,'readText'>|undefined}={}):Promise<string> {
 if(!clipboard?.readText)throw Error('A vágólap olvasása nem elérhető. Használd a Ctrl+V vagy ⌘V billentyűt a szerkesztőben.');
 let text:unknown;
 try{text=await clipboard.readText();}
 catch{throw Error('A böngésző nem engedélyezte a vágólap olvasását. Használd a Ctrl+V vagy ⌘V billentyűt a szerkesztőben.');}
 if(typeof text!=='string'||!text.length)throw Error('A vágólap üres.');
 if(text.length>limit)throw Error(`A vágólap tartalma túl hosszú (legfeljebb ${limit} karakter).`);
 return text.replace(/\r\n?/g,'\n');
}
/** The part of a document the copy fallback uses (the unit test passes a stand-in). */
type CopyDocument=Pick<Document,'activeElement'|'createElement'|'body'|'execCommand'>;
export async function copyToClipboard(value:string,{clipboard=globalThis.navigator?.clipboard,document=globalThis.document}:{clipboard?:Pick<Clipboard,'writeText'>|undefined;document?:CopyDocument}={}):Promise<boolean> {
 try{if(clipboard?.writeText){await clipboard.writeText(value);return true;}}catch{/* denied: the fallback below */}
 let temp:HTMLTextAreaElement|undefined,focused:Element|null|undefined;
 try{
  focused=document.activeElement;temp=document.createElement('textarea');temp.value=value;temp.style.cssText='position:fixed;left:-9999px';
  document.body.appendChild(temp);temp.select();return Boolean(document.execCommand('copy'));
 }catch{return false;}
 finally{temp?.remove();(focused as HTMLElement|null|undefined)?.focus?.({preventScroll:true});}
}
