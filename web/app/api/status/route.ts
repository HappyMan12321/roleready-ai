import { liveReady, privateHeaders } from '@/lib/server';
export const dynamic='force-dynamic';
export function GET(){return Response.json({liveEnabled:liveReady()},{headers:privateHeaders});}
