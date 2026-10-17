import type {AdvisoryReply} from './advisor-reply';
import {advisorFailure} from './advisor-settings';
export function chatFailureMessage(error:unknown){
 const detail=error as {name?:unknown;statusCode?:unknown}|null;
 if(typeof detail?.statusCode==='number')return advisorFailure(detail.statusCode,null);
 const name=typeof detail?.name==='string'?detail.name:'';
 if(['TimeoutError','AbortError'].includes(name))return 'The AI request reached its time limit before a final reply was available.';
 if(/(?:NoOutputGeneratedError|NoObjectGeneratedError|JSONParseError|ZodError)$/.test(name))return 'The AI did not return a complete, valid final reply after its tool work.';
 return 'The chat could not finish or its final reply could not be saved.';
}
export function chatFailureReply(error:unknown,receipts:{tool:string;state:string}[]|null):AdvisoryReply{
 return {reply:chatFailureMessage(error)+' Nothing will be automatically resent. Check recorded activity before retrying account actions.',evidence:receipts===null?['Tool history could not be read; execution status is unknown.']:receipts.slice(0,30).filter(r=>/^[a-z_]{1,60}$/.test(r.tool)&&['pending','completed','failed'].includes(r.state)).map(r=>r.tool+': '+r.state),recommendation:'Open Settings & activity to inspect action and job receipts. Split broad work into a read-only assessment and separately approved stages.',expectedImpact:'No final outcome is confirmed by this failed chat request.',risks:'A tool or queued job may have completed before the reply failed. Do not assume changes were rolled back.',confidence:'low',missingData:['A completed final AI reply.']};
}
