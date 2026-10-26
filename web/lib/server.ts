import { createHash, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { AppError } from './validation';
const buckets=new Map<string,{count:number;until:number}>();
export function checkOrigin(request:Request){
  if(request.headers.get('origin')!==new URL(request.url).origin)throw new AppError('This request must come from the RoleReady website.',403);
}
export function rateLimit(request:Request,limit=30){
  const now=Date.now();const key=createHash('sha256').update(request.headers.get('x-forwarded-for')||'local').digest('hex');
  if(buckets.size>2000)for(const [k,v] of buckets)if(v.until<now)buckets.delete(k);
  let bucket=buckets.get(key);if(!bucket||bucket.until<now){bucket={count:0,until:now+3600000};buckets.set(key,bucket);}
  if(++bucket.count>limit)throw new AppError('Too many requests. Please try again later.',429);
}
export async function readBytes(request:Request,limit:number){
  if(Number(request.headers.get('content-length')||0)>limit)throw new AppError('The request is too large.',413);
  const reader=request.body?.getReader();if(!reader)throw new AppError('No request body was provided.');
  const chunks:Uint8Array[]=[];let total=0;
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>limit){await reader.cancel();throw new AppError('The request is too large.',413);}chunks.push(value);}
  const result=new Uint8Array(total);let offset=0;for(const chunk of chunks){result.set(chunk,offset);offset+=chunk.length;}return result.buffer;
}
export async function readJson(request:Request){if(!request.headers.get('content-type')?.includes('application/json'))throw new AppError('Use a JSON request.',415);try{return JSON.parse(new TextDecoder().decode(await readBytes(request,100000)));}catch(e){if(e instanceof AppError)throw e;throw new AppError('The request could not be read.');}}
export function liveReady(){return process.env.ROLEREADY_LIVE_ENABLED==='true'&&Boolean(process.env.OPENAI_API_KEY?.trim())&&Boolean(process.env.ROLEREADY_ACCESS_CODE?.trim());}
export function authorizeLive(code?:string){
  if(!liveReady())throw new AppError('Live reviews are not enabled yet. Your materials are unchanged; explore the fictional demo meanwhile.',503);
  const hash=(s:string)=>createHash('sha256').update(s).digest();
  if(!timingSafeEqual(hash(code||''),hash(process.env.ROLEREADY_ACCESS_CODE!.trim())))throw new AppError('Enter the private review access code to continue.',401);
}
export function failure(error:unknown){
  if(error instanceof AppError)return Response.json({error:error.message},{status:error.status,headers:{'Cache-Control':'no-store'}});
  if(error instanceof z.ZodError)return Response.json({error:'Some inputs or returned fields are invalid. Check the materials and try again.'},{status:422,headers:{'Cache-Control':'no-store'}});
  return Response.json({error:'This request could not be completed. Your previous review and drafts are unchanged.'},{status:500,headers:{'Cache-Control':'no-store'}});
}
export const privateHeaders={'Cache-Control':'no-store'};
