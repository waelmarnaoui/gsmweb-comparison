export const CHAT_MESSAGE_LIMIT=4000;
export const CHAT_DRAFT_LIMIT=40000;
export const LONG_REVIEW_MESSAGE='Read the attached requirements and give a read-only architecture assessment, missing capabilities and a staged implementation plan. Do not change settings, publish ads, create jobs or deploy code.';
export function savedChatMessage(message:string,names:string[]){
 const note=names.length?'\n[Attached: '+names.join(', ')+'. Contents available for this turn only.]':'';
 const saved=message.trim()+note;
 if(!message.trim()||saved.length>CHAT_MESSAGE_LIMIT)throw new Error('Message and attachment names exceed 4,000 characters. Shorten the message or attach the full text for a read-only review. Nothing was sent to the AI.');
 return saved;
}
export function needsAgentSummary(stepNumber:number,elapsedMs:number){return stepNumber>=7||elapsedMs>=150000;}
