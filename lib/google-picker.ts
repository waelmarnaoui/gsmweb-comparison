'use client';
type Result={action:string;docs?:{id:string}[]};
type View={setMimeTypes(value:string):View};
type Builder={setDeveloperKey(value:string):Builder;setAppId(value:string):Builder;setOAuthToken(value:string):Builder;setOrigin(value:string):Builder;setCallback(value:(result:Result)=>void):Builder;addView(view:View):Builder;build():{setVisible(value:boolean):void}};
declare global {interface Window {gapi?:{load(name:string,options:{callback:()=>void;onerror:()=>void;timeout:number;ontimeout:()=>void}):void};google?:{picker:{View:new(id:string)=>View;ViewId:{SPREADSHEETS:string};PickerBuilder:new()=>Builder;Action:{PICKED:string;CANCEL:string}}};}}
let scriptPromise:Promise<void>|undefined;
async function loadPicker(){
 if(window.google?.picker)return;
 if(!scriptPromise)scriptPromise=new Promise<void>((resolve,reject)=>{
 const script=document.createElement('script');script.src='https://apis.google.com/js/api.js';script.async=true;
 script.onload=()=>{if(!window.gapi){reject(new Error('Google Picker could not load.'));return;}window.gapi.load('picker',{callback:resolve,onerror:()=>reject(new Error('Google Picker could not load.')),timeout:15000,ontimeout:()=>reject(new Error('Google Picker timed out.'))});};script.onerror=()=>reject(new Error('Google Picker script could not load.'));document.head.appendChild(script);
 }).catch(error=>{scriptPromise=undefined;throw error;});return scriptPromise;
}
export async function pickSpreadsheet(config:{token:string;apiKey:string;appId:string}):Promise<string|null>{
 await loadPicker();const p=window.google?.picker;if(!p)throw new Error('Google Picker is unavailable.');
 return new Promise(resolve=>{const view=new p.View(p.ViewId.SPREADSHEETS).setMimeTypes('application/vnd.google-apps.spreadsheet');const picker=new p.PickerBuilder().setDeveloperKey(config.apiKey).setAppId(config.appId).setOAuthToken(config.token).setOrigin(window.location.origin).addView(view).setCallback(result=>{if(result.action===p.Action.PICKED)resolve(result.docs?.[0]?.id||null);else if(result.action===p.Action.CANCEL)resolve(null);}).build();picker.setVisible(true);});
}
