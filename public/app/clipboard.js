/** Plain text clipboard boundary. Reads occur only after an explicit user action. */
export async function readClipboard({limit=1024*1024,clipboard=globalThis.navigator?.clipboard}={}){
 if(!clipboard?.readText)throw Error('A vágólap olvasása nem elérhető. Használd a Ctrl+V vagy ⌘V billentyűt a szerkesztőben.');
 let text;
 try{text=await clipboard.readText();}
 catch{throw Error('A böngésző nem engedélyezte a vágólap olvasását. Használd a Ctrl+V vagy ⌘V billentyűt a szerkesztőben.');}
 if(typeof text!=='string'||!text.length)throw Error('A vágólap üres.');
 if(text.length>limit)throw Error(`A vágólap tartalma túl hosszú (legfeljebb ${limit} karakter).`);
 return text.replace(/\r\n?/g,'\n');
}
export async function copyToClipboard(value,{clipboard=globalThis.navigator?.clipboard,document=globalThis.document}={}){
 try{if(clipboard?.writeText){await clipboard.writeText(value);return true;}}catch{}
 let temp,focused;
 try{
  focused=document.activeElement;temp=document.createElement('textarea');temp.value=value;temp.style.cssText='position:fixed;left:-9999px';
  document.body.appendChild(temp);temp.select();return Boolean(document.execCommand('copy'));
 }catch{return false;}
 finally{temp?.remove();focused?.focus?.({preventScroll:true});}
}
