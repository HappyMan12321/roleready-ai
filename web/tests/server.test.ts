import { afterEach, describe, expect, it, vi } from 'vitest';
import { authorizeLive, checkOrigin, liveReady, readBytes, failure } from '../lib/server';
import { AppError } from '../lib/validation';
import { generate } from '../lib/openai';
import { POST as analyze } from '../app/api/analyze/route';
import { POST as refine } from '../app/api/refine/route';
import { GET as status } from '../app/api/status/route';
import demo from '../lib/demo.json';
const input={resume:demo.resume,job:demo.job,persona:'Supportive career coach' as const,consent:true as const,accessCode:'private-test-code'};
function req(body:unknown,origin='https://roleready.test'){return new Request('https://roleready.test/api/analyze',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals();});
describe('safe hosted API',()=>{
 it('requires all server configuration before enabling live reviews',()=>{vi.stubEnv('OPENAI_API_KEY','');vi.stubEnv('ROLEREADY_LIVE_ENABLED','false');expect(liveReady()).toBe(false);expect(()=>authorizeLive('anything')).toThrow(/not enabled/);expect(status().headers.get('cache-control')).toBe('no-store');});
 it('requires a correct private access code',()=>{vi.stubEnv('OPENAI_API_KEY','not-a-real-key');vi.stubEnv('ROLEREADY_LIVE_ENABLED','true');vi.stubEnv('ROLEREADY_ACCESS_CODE','private-test-code');expect(()=>authorizeLive('wrong')).toThrow(/access code/);expect(()=>authorizeLive(input.accessCode)).not.toThrow();});
 it('rejects cross-origin requests',()=>{expect(()=>checkOrigin(req(input,'https://untrusted.test'))).toThrow();});
 it('rejects JSON without explicit sharing consent before any network call',async()=>{const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher);const response=await analyze(req({...input,consent:false}));expect(response.status).toBe(422);expect(fetcher).not.toHaveBeenCalled();});
 it('returns safe disabled-live feedback instead of fake AI output',async()=>{vi.stubEnv('ROLEREADY_LIVE_ENABLED','false');const response=await analyze(req(input));expect(response.status).toBe(503);expect(await response.json()).not.toHaveProperty('analysis');});
 it('protects refinement as well as initial analysis',async()=>{vi.stubEnv('ROLEREADY_LIVE_ENABLED','false');const b=demo.analysis.bullet_rewrites[0];const response=await refine(req({...input,original:b.original,draft:b.rewritten,feedback:'Make it shorter, please.'}));expect(response.status).toBe(503);});
 it('bounds bodies even without a declared content length',async()=>{const request=new Request('https://roleready.test',{method:'POST',body:'x'.repeat(100)});await expect(readBytes(request,20)).rejects.toThrow(/too large/);});
 it('never reveals raw exception data',async()=>{expect(await failure(new Error('secret-key-and-resume')).text()).not.toContain('secret-key-and-resume');expect(failure(new AppError('Helpful',413)).status).toBe(413);});
});
describe('real SDK, mocked HTTP transport — no live API',()=>{
 it('sends structured outputs with store=false and validates grounded responses',async()=>{
   vi.stubEnv('OPENAI_API_KEY','fake-test-key');let payload:any;
   vi.stubGlobal('fetch',vi.fn(async(_url,options)=>{payload=JSON.parse(options.body);return Response.json({id:'resp_test',object:'response',created_at:1,status:'completed',model:'gpt-4o-mini',output:[{id:'msg_test',type:'message',role:'assistant',status:'completed',content:[{type:'output_text',text:JSON.stringify(demo.analysis),annotations:[]}]}],usage:{input_tokens:1,output_tokens:1,total_tokens:2}});}));
   expect(await generate('analyze',input)).toEqual(demo.analysis);expect(payload.store).toBe(false);expect(payload.text.format.type).toBe('json_schema');expect(payload.text.format.strict).toBe(true);expect(JSON.stringify(payload)).not.toContain('private-test-code');
 });
 it.each([401,429,500])('maps HTTP %i to safe feedback without a fabricated review',async status=>{vi.stubEnv('OPENAI_API_KEY','fake-test-key');vi.stubGlobal('fetch',vi.fn(async()=>Response.json({error:{message:'secret raw payload'}},{status})));await expect(generate('analyze',input)).rejects.not.toThrow('secret raw payload');});
});
