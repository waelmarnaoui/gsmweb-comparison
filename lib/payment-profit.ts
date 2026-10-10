export function moneyCents(value:unknown):number|null{
 const text=String(value??'');
 if(!/^\d{1,8}(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,fraction='']=text.split('.');return Number(whole)*100+Number(fraction.padEnd(2,'0'));
}
export function allocatePaymentCosts(payments:{id:string;amount:number}[],totalCost:number){
 const total=payments.reduce((n,p)=>n+Math.round(p.amount*100),0),cost=Math.round(totalCost*100);
 if(!Number.isSafeInteger(total)||total<=0||!Number.isSafeInteger(cost)||cost<0)throw new Error('Invalid payment cost allocation');
 const rows=payments.map(p=>{
  const numerator=BigInt(cost)*BigInt(Math.round(p.amount*100));
  return {id:p.id,cents:Number(numerator/BigInt(total)),remainder:numerator%BigInt(total),paid:Math.round(p.amount*100)};
 });
 // Allocate the remaining cents deterministically; each settlement cost is counted once.
 const ordered=[...rows].sort((a,b)=>a.remainder===b.remainder?a.id.localeCompare(b.id):a.remainder>b.remainder?-1:1);
 const remaining=cost-rows.reduce((n,p)=>n+p.cents,0);
 for(let i=0;i<remaining;i++)ordered[i].cents++;
 return new Map(rows.map(p=>[p.id,{allocatedCost:p.cents/100,profit:(p.paid-p.cents)/100}]));
}

