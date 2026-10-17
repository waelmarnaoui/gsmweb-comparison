'use client';
import {useEffect,useRef,useState} from 'react';
import {FileText,Mic,Paperclip,Send,Square,Volume2,X} from 'lucide-react';
import type {ChatAttachment} from '@/lib/chat-attachments';
import {speechChunks} from '@/lib/voice-text';
import {CHAT_MESSAGE_LIMIT,CHAT_DRAFT_LIMIT,LONG_REVIEW_MESSAGE} from '@/lib/chat-policy';
type Recognition={lang:string;continuous:boolean;interimResults:boolean;onresult:((event:{results:ArrayLike<{isFinal:boolean;[key:number]:{transcript:string}}>})=>void)|null;onend:(()=>void)|null;onerror:((event:{error:string})=>void)|null;start:()=>void;stop:()=>void;abort:()=>void};
type SpeechWindow=Window&{SpeechRecognition?:new()=>Recognition;webkitSpeechRecognition?:new()=>Recognition};
type Upload=ChatAttachment&{preview?:string};
export default function AgentComposer({busy,enabled,onSend,onVoiceChange}:{busy:boolean;enabled:boolean;onSend:(text:string,files:ChatAttachment[],readOnly?:boolean)=>Promise<string|null>;onVoiceChange:(active:boolean)=>void}){
 const [message,setMessage]=useState(''),[files,setFiles]=useState<Upload[]>([]),[notice,setNotice]=useState(''),[live,setLive]=useState(false),[phase,setPhase]=useState('idle'),[interim,setInterim]=useState(''),[language,setLanguage]=useState('ro-RO'),[spoken,setSpoken]=useState(false),[pending,setPending]=useState(false);
 const input=useRef<HTMLInputElement>(null),textarea=useRef<HTMLTextAreaElement>(null),recognition=useRef<Recognition|null>(null),liveRef=useRef(false),busyRef=useRef(false),turn=useRef(0),mounted=useRef(true),filesRef=useRef(files),spokenRef=useRef(false),listenRef=useRef<()=>void>(()=>{}),externalBusy=useRef(busy),enabledRef=useRef(enabled);
 filesRef.current=files;spokenRef.current=spoken;externalBusy.current=busy;enabledRef.current=enabled;
 const available=!busy&&!pending&&enabled;
 const [readOnlyReview,setReadOnlyReview]=useState(false);
 const tooLong=message.length>CHAT_MESSAGE_LIMIT;
 function stop(){liveRef.current=false;turn.current++;setLive(false);onVoiceChange(false);setPhase('idle');setInterim('');recognition.current?.abort();recognition.current=null;window.speechSynthesis?.cancel();}
 useEffect(()=>{if(busy&&liveRef.current&&!busyRef.current){stop();setNotice('Voice paused while the agent finishes another request.');}},[busy]);
 useEffect(()=>{mounted.current=true;const hidden=()=>{if(document.hidden){liveRef.current=false;turn.current++;recognition.current?.abort();window.speechSynthesis?.cancel();setLive(false);onVoiceChange(false);setPhase('idle');setInterim('');}};document.addEventListener('visibilitychange',hidden);return()=>{mounted.current=false;liveRef.current=false;turn.current++;recognition.current?.abort();window.speechSynthesis?.cancel();document.removeEventListener('visibilitychange',hidden);};},[]);
 function speak(text:string,after?:()=>void){
  if(!('speechSynthesis' in window)){setNotice('Spoken replies are unavailable in this browser.');stop();return;}
  window.speechSynthesis.cancel();setPhase('speaking');const chunks=speechChunks(text),current=turn.current;
  const play=(index:number)=>{if(!mounted.current||current!==turn.current)return;if(index>=chunks.length){setPhase('idle');after?.();return;}const utterance=new SpeechSynthesisUtterance(chunks[index]);utterance.lang=language;const match=window.speechSynthesis.getVoices().find(voice=>voice.lang===language);if(match)utterance.voice=match;utterance.onend=()=>play(index+1);utterance.onerror=()=>{if(!mounted.current||current!==turn.current)return;stop();setNotice('Voice playback stopped. The written reply is in chat.');};window.speechSynthesis.speak(utterance);};play(0);
 }
 async function submit(text:string,voiceTurn=false){
  if(text.length>CHAT_MESSAGE_LIMIT){setNotice('The full draft is preserved. Attach it for a read-only review or shorten it before sending.');return;}
  if(busyRef.current||externalBusy.current||!enabledRef.current||(!text.trim()&&!filesRef.current.length))return;
  busyRef.current=true;setPending(true);setPhase('thinking');setNotice('');const current=turn.current;
  try{
   const attached=filesRef.current.map(({name,mediaType,data})=>({name,mediaType,data}));
   const reply=await onSend(text.trim()||'Please review the attached files.',attached,readOnlyReview);
   if(!mounted.current)return;
   if(reply===null){stop();setNotice('Conversation paused. Review the chat result before sending again.');return;}
   setMessage('');setFiles([]);setReadOnlyReview(false);
   if(current===turn.current&&(liveRef.current||(!voiceTurn&&spokenRef.current)))speak(reply,()=>{if(liveRef.current)listenRef.current();});else setPhase('idle');
  }catch{if(mounted.current){stop();setNotice('The request could not be confirmed. Check chat activity before retrying.');}}finally{busyRef.current=false;if(mounted.current){setPending(false);if(!voiceTurn&&!liveRef.current)requestAnimationFrame(()=>textarea.current?.focus());}}
 }
 function listen(){
  if(!liveRef.current||document.hidden)return;
  const Ctor=(window as SpeechWindow).SpeechRecognition||(window as SpeechWindow).webkitSpeechRecognition;
  if(!Ctor){stop();setNotice('Live voice is not supported by this browser. Use current Chrome or Edge, or type your message.');return;}
  window.speechSynthesis?.cancel();const r=new Ctor();recognition.current=r;r.lang=language;r.continuous=false;r.interimResults=true;let transcript='';const current=turn.current;
  setPhase('listening');setInterim('');
  r.onresult=event=>{if(!liveRef.current||current!==turn.current)return;let final='',draft='';for(let i=0;i<event.results.length;i++){const value=event.results[i][0].transcript;if(event.results[i].isFinal)final+=value;else draft+=value;}transcript=final;setInterim(final||draft);if(final){setMessage(final.slice(0,4000));r.stop();}};
  r.onerror=event=>{if(current!==turn.current)return;stop();setNotice(event.error==='not-allowed'?'Microphone permission was denied. Allow microphone access in your browser to start voice.':event.error==='no-speech'?'No speech detected. Start voice when you are ready.':'Voice recognition stopped ('+event.error+'). Your written conversation is unchanged.');};
  r.onend=()=>{if(recognition.current===r)recognition.current=null;if(!liveRef.current||current!==turn.current)return;setInterim('');if(transcript.trim())void submit(transcript.slice(0,4000),true);else{stop();setNotice('Voice paused. Start a conversation when you are ready.');}};
  try{r.start();}catch{stop();setNotice('Microphone could not start. Check browser permissions and try again.');}
 }
 listenRef.current=listen;
 function start(){
  if(!available)return;
  if(!window.confirm('Start a live voice conversation? Your browser may send audio to its speech service. Spoken turns are sent to the AI and can request supported account actions under your saved permissions. You can stop at any time.'))return;
  liveRef.current=true;turn.current++;setLive(true);onVoiceChange(true);setNotice('');listen();
 }
 async function attach(selected:File[]){
  if(!available||liveRef.current)return;
  busyRef.current=true;setPending(true);
  try{
   if(files.length+selected.length>3)throw new Error('Attach up to three files.');
   const accepted:Upload[]=[];
   for(const file of selected){if(!file.size||file.size>2_500_000)throw new Error('Attachments must total 2.5 MB or less.');const extension=file.name.split('.').pop()?.toLowerCase(),mediaType=({'txt':'text/plain','csv':'text/csv','md':'text/markdown','json':'application/json'} as Record<string,string>)[extension||'']||file.type;
    if(!['image/png','image/jpeg','image/webp','application/pdf','text/plain','text/csv','application/json','text/markdown'].includes(mediaType))throw new Error('Use images, PDF, TXT, CSV, JSON or Markdown files.');
    const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('File could not be read.'));reader.readAsDataURL(file);});accepted.push({name:file.name,mediaType,data:data.split(',')[1],...(mediaType.startsWith('image/')?{preview:data}:{})});
   }
   if([...files,...accepted].reduce((sum,file)=>sum+Math.floor(file.data.length*3/4),0)>2_500_000)throw new Error('Attachments must total 2.5 MB or less.');setFiles([...files,...accepted]);setNotice('Attachments are sent to your AI provider with this message. Keep passwords and customer secrets out of files.');return true;
  }catch(error){setNotice(error instanceof Error?error.message:'Could not attach files.');return false;}finally{busyRef.current=false;if(mounted.current)setPending(false);}
 }
 async function attachLongDraft(){if(message.length>CHAT_DRAFT_LIMIT||!available||live)return;const saved=await attach([new File([message],'requirements.txt',{type:'text/plain'})]);if(saved){setMessage(LONG_REVIEW_MESSAGE);setReadOnlyReview(true);setNotice('The complete draft is attached. This request is read-only; account changes and jobs are blocked.');}}
 return <form className="agent-composer" onSubmit={event=>{event.preventDefault();if(!live)void submit(message);}} onDragOver={event=>event.preventDefault()} onDrop={event=>{event.preventDefault();void attach(Array.from(event.dataTransfer.files));}}>
 {live&&<div className="agent-voice-status" data-live="true" role="status"><Mic size={16}/><span>{phase==='listening'?'Listening':phase==='thinking'?'Agent is working':phase==='speaking'?'Agent is speaking':'Voice connected'}{interim?' · '+interim:''}</span><button type="button" className="workspace-icon" aria-label="Stop voice conversation" title="Stop voice conversation" onClick={stop}><Square size={15}/></button></div>}
 {notice&&<p role="status" className="agent-small">{notice}</p>}
 {tooLong&&<div role="alert" className="agent-notice"><p>Your full draft is preserved ({message.length.toLocaleString()} characters). Chat messages allow 4,000. Attach the complete text for a read-only review, or shorten it.</p><button type="button" className="secondary" disabled={!available||live} onClick={()=>void attachLongDraft()}>Attach full message for read-only review</button></div>}
 {readOnlyReview&&<p className="agent-small">Read-only requirements review. Changes and queued jobs are blocked for this request.</p>}
 <div className="agent-attachments">{files.map((file,index)=><div className="agent-attachment" key={index}>{file.preview?<img src={file.preview} alt={'Attached '+file.name}/>:<FileText size={19}/>}<span title={file.name}>{file.name}</span><button type="button" disabled={busy||pending||live} aria-label={'Remove '+file.name} title="Remove attachment" onClick={()=>setFiles(files.filter((_,i)=>i!==index))}><X size={15}/></button></div>)}</div>
 <label htmlFor="agent-message">Message your marketing agent</label><textarea ref={textarea} id="agent-message" value={message} disabled={busy||pending||live} onChange={event=>{if(event.target.value.length>CHAT_DRAFT_LIMIT){setNotice('Drafts can contain up to 40,000 characters. Nothing was truncated or sent.');return;}setMessage(event.target.value);}} onPaste={event=>{const images=Array.from(event.clipboardData.files).filter(file=>file.type.startsWith('image/'));if(images.length){event.preventDefault();void attach(images);}else{const field=event.currentTarget,next=message.slice(0,field.selectionStart)+event.clipboardData.getData('text/plain')+message.slice(field.selectionEnd);if(next.length>CHAT_DRAFT_LIMIT){event.preventDefault();setNotice('This paste exceeds the 40,000-character draft limit. Attach a smaller text file or split the requirements. Your current draft is unchanged.');}}}} onKeyDown={event=>{if(event.key==='Enter'&&!event.shiftKey&&!event.nativeEvent.isComposing){event.preventDefault();if(available&&!live)void submit(message);}}} placeholder="Ask a question or describe the ad you want to prepare"/>
 <input hidden ref={input} type="file" multiple accept="image/png,image/jpeg,image/webp,.pdf,.txt,.csv,.json,.md" aria-label="Attach images or files" onChange={event=>{void attach(Array.from(event.target.files||[]));event.target.value='';}}/>
 <div className="agent-compose-actions"><div className="agent-chat-tools"><button type="button" className="workspace-icon" title="Attach images or files" aria-label="Attach images or files" disabled={!available||live} onClick={()=>input.current?.click()}><Paperclip size={17}/></button><button type="button" className="secondary" disabled={!available&&!live} onClick={()=>live?stop():start()}>{live?<Square size={16}/>:<Mic size={16}/>} {live?'End voice':'Start voice conversation'}</button><select aria-label="Voice language" value={language} disabled={live} onChange={event=>setLanguage(event.target.value)}><option value="ro-RO">Romanian</option><option value="en-GB">English</option><option value="fr-FR">French</option></select><button type="button" className="workspace-icon" title={phase==='speaking'?'Stop speaking':'Spoken replies'} aria-label={phase==='speaking'?'Stop speaking':'Spoken replies'} aria-pressed={spoken} onClick={()=>{if(phase==='speaking'){stop();}else setSpoken(!spoken);}}>{phase==='speaking'?<Square size={16}/>:<Volume2 size={17}/>}</button></div><button className="primary" type="submit" disabled={!available||live||tooLong||(!message.trim()&&!files.length)}><Send size={16}/>{pending||busy?'Working':'Send'}</button></div>
 </form>;
}
