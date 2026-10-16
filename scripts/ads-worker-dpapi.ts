import {spawn} from 'node:child_process';
// DPAPI binds the encrypted file to this Windows user's profile. Secret material
// passes through anonymous pipes, never through command arguments or console logs.
export function windowsProtect(input:string,decrypt=false):Promise<string>{
 if(process.platform!=='win32')throw new Error('This laptop setup requires Windows. Use the environment-based recovery worker on other hosts.');
 const script=decrypt?
  "Add-Type -AssemblyName System.Security; $b=[Convert]::FromBase64String([Console]::In.ReadToEnd()); $p=[Security.Cryptography.ProtectedData]::Unprotect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Text.Encoding]::UTF8.GetString($p))":
  "Add-Type -AssemblyName System.Security; $b=[Text.Encoding]::UTF8.GetBytes([Console]::In.ReadToEnd()); $p=[Security.Cryptography.ProtectedData]::Protect($b,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser); [Console]::Out.Write([Convert]::ToBase64String($p))";
 return new Promise((resolve,reject)=>{
  const child=spawn('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{windowsHide:true,stdio:['pipe','pipe','ignore']});let output='';
  child.stdout.on('data',chunk=>{output+=chunk.toString();if(output.length>100000){child.kill();reject(new Error('Local secret storage failed.'));}});
  child.on('error',()=>reject(new Error('Local secret storage failed.')));
  child.on('exit',code=>code===0?resolve(output):reject(new Error('Local secret storage failed.')));child.stdin.on('error',()=>{});child.stdin.end(input);
 });
}
