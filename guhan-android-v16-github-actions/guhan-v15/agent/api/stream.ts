import { streamGuhan } from '../src/agent.js';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' };
export async function OPTIONS() { return new Response(null,{status:204,headers:cors}); }

export async function POST(req: Request): Promise<Response> {
  if (!process.env.AI_GATEWAY_API_KEY) return Response.json({error:'AI_GATEWAY_API_KEY is not configured.'},{status:500,headers:cors});
  try {
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages.filter((m:any)=>['user','assistant','system'].includes(m?.role)).slice(-40).map((m:any)=>({role:m.role,content:String(m.content??'')})) : [];
    if (!messages.length) return Response.json({error:'No messages supplied.'},{status:400,headers:cors});
    const memory = Array.isArray(body?.memory) ? body.memory.map(String).slice(-30) : [];
    const client = typeof body?.client === 'object' && body.client ? body.client : {};
    const result = streamGuhan(messages, memory, client);
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (value: unknown) => controller.enqueue(encoder.encode(JSON.stringify(value)+'\n'));
        try {
          for await (const part of result.fullStream) {
            if (part.type === 'text-delta') send({type:'text', delta:part.textDelta});
            else if (part.type === 'tool-result') send({type:'tool-result', toolName:part.toolName, result:part.result});
            else if (part.type === 'source') send({type:'source', source:part.source});
            else if (part.type === 'error') send({type:'error', error:String(part.error)});
            else if (part.type === 'finish') send({type:'finish', finishReason:part.finishReason});
          }
        } catch (error) {
          send({type:'error', error:error instanceof Error ? error.message : 'Streaming failed'});
        } finally { controller.close(); }
      }
    });
    return new Response(stream,{status:200,headers:{...cors,'Content-Type':'application/x-ndjson; charset=utf-8','Cache-Control':'no-cache, no-transform','X-Accel-Buffering':'no'}});
  } catch (error) {
    return Response.json({error:error instanceof Error ? error.message : 'Unknown error'},{status:500,headers:cors});
  }
}
