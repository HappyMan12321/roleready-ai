import { RefineInputSchema } from '@/lib/schema';
import { checkOrigin, rateLimit, readJson, authorizeLive, failure, privateHeaders } from '@/lib/server';
import { generate } from '@/lib/openai';
export const runtime='nodejs';
export const maxDuration=120;
export async function POST(request:Request){try{checkOrigin(request);rateLimit(request);const input=RefineInputSchema.parse(await readJson(request));authorizeLive(input.accessCode);return Response.json({revision:await generate('refine',input)},{headers:privateHeaders});}catch(error){return failure(error);}}
