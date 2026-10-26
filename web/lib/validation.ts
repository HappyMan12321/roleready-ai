import { Analysis, AnalysisSchema, Revision, RevisionSchema } from './schema';
export class AppError extends Error { constructor(message:string,public status=400){super(message);} }
export function normalize(text:string){return text.normalize('NFKC').replace(/\0/g,'').replace(/\r\n/g,'\n').trim();}
export function validateText(text:string,label:string,max:number,min=80){
  if(text.length>max)throw new AppError(`${label} must be at most ${max.toLocaleString()} characters.`);
  const clean=normalize(text);
  if(clean.length<min||(clean.match(/[\p{L}\p{N}_]+/gu)||[]).length<Math.min(12,Math.floor(min/3)))throw new AppError(`${label} needs more detail: at least ${min} characters and ${Math.min(12,Math.floor(min/3))} words.`);
  return clean;
}
export function quoteIn(quote:string,source:string){const compact=(v:string)=>normalize(v).replace(/\s+/g,' ');return Boolean(quote.trim())&&compact(source).includes(compact(quote));}
export function validateRevision(value:unknown,resume:string,expectedOriginal?:string):Revision{
  const revision=RevisionSchema.parse(value);
  if(expectedOriginal&&revision.original!==expectedOriginal)throw new AppError('The source bullet changed. Your current draft is unchanged.',422);
  if(!quoteIn(revision.original,resume))throw new AppError('A source bullet did not match the resume. No draft was accepted.',422);
  const numbers=(v:string)=>new Set(v.match(/(?<!\w)[$€£]?\d[\d,]*(?:\.\d+)?%?/g)||[]);
  const original=numbers(revision.original);
  if([...numbers(revision.rewritten)].some(v=>!original.has(v)))throw new AppError('A draft introduced an unsupported number. No draft was accepted.',422);
  return revision;
}
export function validateAnalysis(value:unknown,resume:string,job:string):Analysis{
  const result=AnalysisSchema.parse(value);const seen=new Set<string>();
  for(const r of result.requirements){const key=r.requirement.toLowerCase().replace(/\s+/g,' ').trim();
    if(seen.has(key))throw new AppError('The review repeated a requirement. Please try again.',422);seen.add(key);
    if(!quoteIn(r.job_quote,job))throw new AppError('A requirement lacked an exact job quote. No new review was accepted.',422);
    if(r.status==='missing'?Boolean(r.resume_evidence.trim()):!quoteIn(r.resume_evidence,resume))throw new AppError('A match lacked valid resume evidence. No new review was accepted.',422);
  }
  result.bullet_rewrites.forEach(r=>validateRevision(r,resume));return result;
}
export function matchScore(analysis:Analysis){let earned=0,total=0;for(const r of analysis.requirements){const weight=r.importance==='required'?2:1;total+=weight;earned+=weight*({matched:1,partial:.5,missing:0}[r.status]);}return Math.round(100*earned/total);}
