import {z} from 'zod';
import {researchReportSchema} from './research-report.mjs';
export {researchReportSchema} from './research-report.mjs';
export const researchRequestSchema=z.object({title:z.string().trim().min(3).max(200),instructions:z.string().trim().min(3).max(4000),hours:z.number().int().min(1).max(12)}).strict();
export const researchCheckpointSchema=z.object({stage:z.number().int().min(1).max(3),report:researchReportSchema}).strict();
export function researchSourceBlock(instructions:string){
 if(/competitor|concuren|browse|online|internet|web research/i.test(instructions))return 'Public web-search research is not connected yet. No task was queued. Saved-data analysis is available.';
 if(/30[\s-]*(?:days|day|zile|de zile)/i.test(instructions))return 'A complete last-30-day keyword feed is not connected yet. No task was queued. Saved-data analysis without that requirement is available.';
 return null;
}
