import { fromBuffer, Entry } from 'yauzl';
import { AppError, validateText } from './validation';
const expandedLimit=20*1024*1024;
export function inspectDocx(buffer:Buffer):Promise<void>{return new Promise((resolve,reject)=>{
  fromBuffer(buffer,{lazyEntries:true,validateEntrySizes:true},(error,zip)=>{
    if(error||!zip){reject(new AppError('This DOCX archive could not be read.'));return;}
    let count=0,total=0,found=false,finished=false;
    const fail=(e:unknown)=>{if(!finished){finished=true;zip.close();reject(e instanceof AppError?e:new AppError('The DOCX archive is damaged or unsupported.'));}};
    zip.on('error',fail);
    zip.on('entry',(entry:Entry)=>{
      if(++count>200||entry.generalPurposeBitFlag&1||/vbaproject|\.bin$/i.test(entry.fileName)||entry.fileName.includes('..')||entry.uncompressedSize>expandedLimit){fail(new AppError('Encrypted, macro-containing, oversized, or unusually complex DOCX files are not supported.'));return;}
      if(entry.fileName==='word/document.xml')found=true;
      if(entry.fileName.endsWith('/')){zip.readEntry();return;}
      zip.openReadStream(entry,(streamError,stream)=>{
        if(streamError||!stream){fail(streamError);return;}
        stream.on('data',(chunk:Buffer)=>{total+=chunk.length;if(total>expandedLimit){stream.destroy();fail(new AppError('The expanded DOCX is too large. Paste the text instead.'));}});
        stream.on('error',fail);stream.on('end',()=>{if(!finished)zip.readEntry();});
      });
    });
    zip.on('end',()=>{if(finished)return;finished=true;zip.close();if(!found)reject(new AppError('Choose a valid DOCX resume.'));else resolve();});zip.readEntry();
  });
});}
export async function extractResume(buffer:Buffer,name:string){
  if(!buffer.length||buffer.length>4*1024*1024)throw new AppError('Choose a resume up to 4 MB.');
  const extension=name.split('.').pop()?.toLowerCase();let text='';
  try{
    if(extension==='pdf'){
      if(buffer.subarray(0,5).toString()!=='%PDF-')throw new AppError('This file is not a readable PDF.');
      const {getDocumentProxy,extractText}=await import('unpdf');
      const pdf=await getDocumentProxy(new Uint8Array(buffer),{useSystemFonts:false,disableFontFace:true});
      try{if(pdf.numPages>20)throw new AppError('PDF resumes can contain at most 20 pages.');const result=await extractText(pdf,{mergePages:true});text=result.text;}finally{await pdf.loadingTask.destroy();}
    }else if(extension==='docx'){
      await inspectDocx(buffer);const mammoth=await import('mammoth');text=(await mammoth.extractRawText({buffer})).value;
    }else throw new AppError('Use a text-based PDF or DOCX resume.');
  }catch(error){if(error instanceof AppError)throw error;throw new AppError('The document could not be read. Use an unlocked text-based PDF or DOCX, or paste the text.');}
  return validateText(text,'Extracted resume',24000);
}
