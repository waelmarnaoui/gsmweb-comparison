import {z} from 'zod';
export const researchReportSchema=z.object({summary:z.string().min(1).max(12000),findings:z.array(z.object({claim:z.string().max(2000),evidence:z.string().max(3000),confidence:z.enum(['low','medium','high'])}).strict()).max(30),limitations:z.array(z.string().max(1000)).max(30),recommendations:z.array(z.string().max(2000)).max(30)}).strict();
export const researchReportJsonSchema=z.toJSONSchema(researchReportSchema);
