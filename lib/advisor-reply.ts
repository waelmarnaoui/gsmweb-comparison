import {z} from 'zod';
export const agentReplySchema=z.object({reply:z.string().max(12000),evidence:z.array(z.string().max(2000)).max(30),recommendation:z.string().max(12000),expectedImpact:z.string().max(12000),risks:z.string().max(12000),confidence:z.enum(['low','medium','high']),missingData:z.array(z.string().max(2000)).max(30)}).strict();
export type AdvisoryReply=z.infer<typeof agentReplySchema>;
