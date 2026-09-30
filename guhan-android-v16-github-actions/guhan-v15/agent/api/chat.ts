import { runGuhan } from '../src/agent.js';

const cors = { 'Access-Control-Allow-Origin':'*', 'Access-Control-Allow-Methods':'POST,OPTIONS', 'Access-Control-Allow-Headers':'Content-Type' };
export async function OPTIONS() { return new Response(null,{status:204,headers:cors}); }
export async function POST(req: Request): Promise<Response> {
  try {
    if (!process.env.AI_GATEWAY_API_KEY) return Response.json({error:'AI_GATEWAY_API_KEY is not configured.'},{status:500,headers:cors});
    const body = await req.json();
    const messages = Array.isArray(body?.messages) ? body.messages.filter((m:any)=>['user','assistant','system'].includes(m?.role)).slice(-40).map((m:any)=>({role:m.role,content:String(m.content??'')})) : [];
    if (!messages.length) return Response.json({error:'No messages supplied.'},{status:400,headers:cors});
    const memory = Array.isArray(body?.memory) ? body.memory.map(String).slice(-30) : [];
    const client = typeof body?.client === 'object' && body.client ? body.client : {};
    const result = await runGuhan(messages,memory,client);
    return Response.json(result,{headers:{...cors,'Cache-Control':'no-store'}});
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return Response.json({error:message},{status:500,headers:cors});
  }
}
