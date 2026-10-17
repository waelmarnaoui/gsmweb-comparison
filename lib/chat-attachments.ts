import {sourceContent} from './agent-source-policy';
export type ChatAttachment={name:string;mediaType:string;data:string};
export const CHAT_UPLOAD_BYTES=2_500_000;
export function parseChatAttachments(input:unknown):ChatAttachment[]{
 if(input===undefined)return [];
 if(!Array.isArray(input)||input.length>3)throw new Error('Attach up to three files.');
 let total=0;
 return input.map(item=>{
  if(!item||typeof item.name!=='string'||!item.name||item.name.length>120||/[\x00-\x1f\\/]/.test(item.name)||typeof item.mediaType!=='string'||typeof item.data!=='string'||!item.data||item.data.length>3_400_000||item.data.length%4!==0||!/^[A-Za-z0-9+/]*={0,2}$/.test(item.data))throw new Error('Invalid attachment.');
  sourceContent(item.name);
  const bytes=Buffer.from(item.data,'base64');if(bytes.toString('base64')!==item.data)throw new Error('Invalid attachment encoding.');total+=bytes.length;
  if(total>CHAT_UPLOAD_BYTES)throw new Error('Attachments must total 2.5 MB or less.');
  const signature=bytes.subarray(0,16),type=item.mediaType;
  const valid=type==='image/png'?signature.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/jpeg'?signature[0]===255&&signature[1]===216&&signature[2]===255:type==='image/webp'?signature.toString('ascii',0,4)==='RIFF'&&signature.toString('ascii',8,12)==='WEBP':type==='application/pdf'?signature.toString('ascii',0,5)==='%PDF-':false;
  if(['text/plain','text/csv','application/json','text/markdown'].includes(type)){
   const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);if(text.length>40000||text.includes('\0'))throw new Error('Text attachments must be UTF-8 and under 40,000 characters.');sourceContent(text);
  }else if(!valid)throw new Error('Use PNG, JPEG, WebP, PDF, TXT, CSV, JSON or Markdown files with matching content.');
  return {name:item.name,mediaType:type,data:item.data};
 });
}
