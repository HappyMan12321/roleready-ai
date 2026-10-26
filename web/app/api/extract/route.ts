import { checkOrigin, rateLimit, readBytes, failure, privateHeaders } from '@/lib/server';
import { extractResume } from '@/lib/extract';
import { AppError } from '@/lib/validation';
export const runtime='nodejs';
export const maxDuration=30;
export async function POST(request:Request){try{checkOrigin(request);rateLimit(request,60);const buffer=await readBytes(request,4*1024*1024+64000);const data=await new Response(buffer,{headers:{'content-type':request.headers.get('content-type')||''}}).formData();const file=data.get('file');if(!(file instanceof File))throw new AppError('Choose a resume document.');return Response.json({text:await extractResume(Buffer.from(await file.arrayBuffer()),file.name)},{headers:privateHeaders});}catch(error){return failure(error);}}
