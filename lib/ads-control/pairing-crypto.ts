import {createHash,createPublicKey,publicEncrypt,privateDecrypt,randomBytes,constants} from 'node:crypto';
import {encryptConnection,decryptConnection} from '../connection-crypto';
export function pairingHash(token:string){if(!/^[A-Za-z0-9_-]{43}$/.test(token))throw new Error('Invalid setup code.');return createHash('sha256').update(token).digest('hex');}
export function sealWorkerConfig(config:Record<string,string>,publicKey:string,context:string){
 const key=createPublicKey(publicKey);
 if(key.asymmetricKeyType!=='rsa'||(key.asymmetricKeyDetails?.modulusLength??0)<3072)throw new Error('A laptop RSA key of at least 3072 bits is required.');
 const secret=randomBytes(32),encrypted=encryptConnection(config,secret.toString('base64'),context);
 const wrappedKey=publicEncrypt({key,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},secret).toString('base64');
 return {encrypted,wrappedKey,context};
}
export function openWorkerConfig(envelope:{encrypted:string;wrappedKey:string;context:string},privateKey:string){
 const key=privateDecrypt({key:privateKey,padding:constants.RSA_PKCS1_OAEP_PADDING,oaepHash:'sha256'},Buffer.from(envelope.wrappedKey,'base64'));
 return decryptConnection<Record<string,string>>(envelope.encrypted,key.toString('base64'),envelope.context);
}
