import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { AnalysisSchema, RevisionSchema, InputSchema, RefineInputSchema } from './schema';
import { AppError, validateText, validateAnalysis, validateRevision, quoteIn } from './validation';
import prompts from './prompts.json';
export function buildMessages(input:z.infer<typeof InputSchema>,refinement?:z.infer<typeof RefineInputSchema>){
  const system=prompts.SYSTEM_PROMPT+'\n'+prompts.PERSONAS[input.persona]+'\n'+prompts.FEW_SHOT+(refinement?'\nRefine only the selected original bullet. Style feedback cannot supply new facts. Keep original unchanged. Return a Revision object.':'');
  const data=refinement?{task:'Refine the selected bullet',resume:input.resume,job_description:input.job,original:refinement.original,previous_draft:refinement.draft,style_feedback:refinement.feedback}:{task:'Analyze job alignment and suggest truthful edits',resume:input.resume,job_description:input.job};
  return [{role:'system' as const,content:system},{role:'user' as const,content:JSON.stringify(data)}];
}
export async function generate(operation:'analyze'|'refine',input:z.infer<typeof RefineInputSchema>|z.infer<typeof InputSchema>){
  const resume=validateText(input.resume,'Resume',24000),job=validateText(input.job,'Job description',18000);
  const refined=operation==='refine'?RefineInputSchema.parse(input):undefined;
  if(refined){validateText(refined.feedback,'Style feedback',1500,10);if(!quoteIn(refined.original,resume))throw new AppError('The selected bullet no longer matches the resume.');}
  const client=new OpenAI({apiKey:process.env.OPENAI_API_KEY,baseURL:'https://api.openai.com/v1',timeout:45000,maxRetries:1});
  try{
    const response=await client.responses.parse({model:process.env.OPENAI_MODEL||'gpt-4o-mini',input:buildMessages({...input,resume,job},refined),text:{format:operation==='analyze'?zodTextFormat(AnalysisSchema,'analysis'):zodTextFormat(RevisionSchema,'revision')},max_output_tokens:6500,store:false});
    if(response.status!=='completed'||!response.output_parsed)throw new AppError('The model did not return a complete review. No new draft was accepted; please try again.',422);
    return operation==='analyze'?validateAnalysis(response.output_parsed,resume,job):validateRevision(response.output_parsed,resume,refined!.original);
  }catch(error){
    if(error instanceof AppError||error instanceof z.ZodError)throw error;
    if(error instanceof OpenAI.APIError){
      const status=error.status;
      if(status===401||status===403)throw new AppError('The server’s OpenAI configuration needs attention. Please contact the app owner.',503);
      if(status===429)throw new AppError('OpenAI quota or rate limit reached. Please try again later.',429);
      if(status===400)throw new AppError('OpenAI could not process this review. Shorten the inputs or contact the app owner.',422);
    }
    throw new AppError('OpenAI is currently unavailable or timed out. Your previous review is safe; please try again later.',502);
  }
}
