import {createCipheriv,createDecipheriv,randomBytes} from 'node:crypto';
export function encryptConnection(value:unknown,key:string,context:string){
 const bytes=Buffer.from(key,'base64');if(bytes.length!==32)throw new Error('Connection encryption key must contain 32 bytes');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',bytes,iv);cipher.setAAD(Buffer.from(context));
 const encrypted=Buffer.concat([cipher.update(JSON.stringify(value),'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),encrypted].map(b=>b.toString('base64url')).join('.');
}
export function decryptConnection<T>(value:string,key:string,context:string):T{
 const [iv,tag,encrypted]=value.split('.').map(v=>Buffer.from(v,'base64url'));
 const cipher=createDecipheriv('aes-256-gcm',Buffer.from(key,'base64'),iv);cipher.setAAD(Buffer.from(context));cipher.setAuthTag(tag);
 return JSON.parse(Buffer.concat([cipher.update(encrypted),cipher.final()]).toString('utf8')) as T;
}
