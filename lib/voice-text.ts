export function speechChunks(value:string,size=220){
 const result:string[]=[];let text=value.replace(/\s+/g,' ').trim();
 while(text){let end=Math.min(size,text.length);if(end<text.length){const boundary=text.lastIndexOf(' ',end);if(boundary>size/2)end=boundary;}result.push(text.slice(0,end).trim());text=text.slice(end).trim();}
 return result;
}
