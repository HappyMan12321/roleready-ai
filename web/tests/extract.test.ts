import { describe, expect, it } from 'vitest';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { zipSync, strToU8 } from 'fflate';
import { extractResume, inspectDocx } from '../lib/extract';
const text='Built a Python script to clean 500 survey responses. Used SQL to query sales data and summarize weekly sales trends.';
function docx(extra:Record<string,Uint8Array>={}){return Buffer.from(zipSync({'[Content_Types].xml':strToU8('<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'),'_rels/.rels':strToU8('<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'),'word/document.xml':strToU8(`<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>${text}</w:t></w:r></w:p></w:body></w:document>`),...extra}));}
describe('real document parsing',()=>{
 it('extracts a generated text PDF',async()=>{const pdf=await PDFDocument.create();const page=pdf.addPage();const font=await pdf.embedFont(StandardFonts.Helvetica);page.drawText(text,{x:20,y:600,font,size:8});expect(await extractResume(Buffer.from(await pdf.save()),'resume.pdf')).toContain('500 survey responses');});
 it('extracts a generated DOCX',async()=>{expect(await extractResume(docx(),'resume.docx')).toContain('Used SQL');});
 it('rejects scanned or blank PDFs',async()=>{const pdf=await PDFDocument.create();pdf.addPage();await expect(extractResume(Buffer.from(await pdf.save()),'scan.pdf')).rejects.toThrow(/more detail/);});
 it('rejects PDFs longer than 20 pages',async()=>{const pdf=await PDFDocument.create();for(let i=0;i<21;i++)pdf.addPage();await expect(extractResume(Buffer.from(await pdf.save()),'long.pdf')).rejects.toThrow(/20 pages/);});
 it.each(['resume.doc','resume.png','resume.exe'])('rejects unsupported %s',async name=>{await expect(extractResume(Buffer.from('data'),name)).rejects.toThrow(/PDF or DOCX/);});
 it('rejects a fake PDF',async()=>{await expect(extractResume(Buffer.from('not a PDF'),'fake.pdf')).rejects.toThrow();});
 it('rejects macro-containing archives',async()=>{await expect(inspectDocx(docx({'word/vbaProject.bin':strToU8('macro')}))).rejects.toThrow(/macro/);});
 it('rejects more than 200 archive members',async()=>{const extra:Record<string,Uint8Array>={};for(let i=0;i<201;i++)extra[`word/file${i}.xml`]=strToU8('text');await expect(inspectDocx(docx(extra))).rejects.toThrow(/complex/);});
 it('rejects expanded archives larger than 20 MB',async()=>{await expect(inspectDocx(docx({'word/large.xml':new Uint8Array(21*1024*1024)}))).rejects.toThrow();});
 it('rejects oversized input before parsing',async()=>{await expect(extractResume(Buffer.alloc(4*1024*1024+1),'big.pdf')).rejects.toThrow(/4 MB/);});
});
