export function googleReply(output:unknown,finishReason='STOP'){
 return Response.json({candidates:[{content:{role:'model',parts:[{text:JSON.stringify(output)}]},finishReason}],usageMetadata:{promptTokenCount:10,candidatesTokenCount:20,totalTokenCount:30}});
}
