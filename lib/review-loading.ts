export async function reviewSection<T>(label:string,load:()=>Promise<T>):Promise<{data:T;error:null}|{data:null;error:string}>{
 try{return {data:await load(),error:null};}
 catch(error){return {data:null,error:label+': '+(error instanceof Error?error.message:'Unavailable. Refresh before retrying.')};}
}
