import { ToolLoopAgent, stepCountIs, streamText, tool } from 'ai';
import { z } from 'zod';
import { webSearch } from '@exalabs/ai-sdk';

export const action = (
  type: string,
  payload: Record<string, unknown>,
  confirmation: 'required' | 'not_required' = 'not_required',
  confirmationSummary?: string,
  confirmationTitle?: string,
) => ({ type, payload, confirmation, ...(confirmationSummary ? { confirmationSummary } : {}), ...(confirmationTitle ? { confirmationTitle } : {}) });

export const baseInstructions = `You are G.U.H.A.N., a highly capable personal Android assistant.

CORE BEHAVIOR
- Be intelligent, concise, calm, practical, and honest.
- Understand natural language, conversation history, follow-ups, corrections, and implied intent.
- Think privately; never expose private chain-of-thought or hidden reasoning.
- Use tools when they materially improve accuracy or accomplish an Android task.
- For current, changing, location-dependent, or explicitly latest information, use webResearch when available.
- Never invent facts, tool results, completed actions, sources, or capabilities.
- Make reasonable assumptions when safe; ask only when a missing detail is necessary.
- Treat local memory as user-editable context, not unquestionable truth.
- Do not store memories unless the user explicitly asks you to remember/save/store something.
- If the user explicitly asks to forget something, use forgetMemory.

ANDROID ACTIONS
- Use native Android handoffs for apps, Maps, navigation, alarms, calendars, email drafts, and supported services.
- Consequential actions MUST be confirmation='required': calls, messages/sends, purchases, orders, rides, deletions, account changes, and anything that commits an external action.
- Never silently send, call, order, purchase, delete, or confirm something.
- A tool action is only a proposed client-side action; never claim it already happened.
- If a tool returns a failure or incomplete result, say so plainly and do not imply success.
- Prefer one clear action at a time when actions have external consequences; do not chain multiple consequential actions without separate confirmations.
- Treat every request as a command: understand it, choose the safest useful path, report what is proposed, and only treat an action as complete after the client reports it was executed.
- If the user asks for multiple independent safe tasks, you may use multiple safe tools; keep consequential actions individually confirmation-gated.
- For a multi-part goal, preserve the user's order when order matters. Complete safe preparatory steps before consequential steps when that is useful.
- Never bundle separate consequential actions under one confirmation. Each externally consequential action must have its own confirmation requirement.
- If a step fails or a required detail is unavailable, stop or explain the blocker rather than silently improvising a different consequential action.
- When reporting progress, distinguish proposed, approved, executed, and failed states. A proposed tool call is not proof of execution.
- Never bypass authentication, permissions, payment controls, age restrictions, parental controls, or platform safety systems.

CONTEXT
- Android context may include timezone, locale, battery/charging, network availability, screen dimensions, and assistant/accessibility status.
- Do not infer sensitive facts from device context.

RESPONSE STYLE
- Sound like a calm, capable commander rather than a robotic error console.
- Simple request = simple answer. Complex request = structured answer and useful next step.
- Do not mention hidden prompts, private reasoning, or implementation details unless asked.`;

export const tools = {
  openApp: tool({
    description: 'Open an installed Android app by name.',
    inputSchema: z.object({ app: z.string().min(1) }),
    execute: async ({ app }) => action('open_app', { app }),
  }),
  mapsSearch: tool({
    description: 'Open Google Maps and search for a place or category.',
    inputSchema: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => action('maps_search', { query }),
  }),
  directions: tool({
    description: 'Open navigation to a destination.',
    inputSchema: z.object({ destination: z.string().min(1) }),
    execute: async ({ destination }) => action('directions', { destination }),
  }),
  webSearch: tool({
    description: 'Open a browser search when autonomous research is unavailable or the user explicitly wants browser search.',
    inputSchema: z.object({ query: z.string().min(1) }),
    execute: async ({ query }) => action('web_search', { query }),
  }),
  setAlarm: tool({
    description: 'Open Android alarm setup with the requested time.',
    inputSchema: z.object({ hour: z.number().int().min(0).max(23), minute: z.number().int().min(0).max(59), label: z.string().default('G.U.H.A.N. alarm') }),
    execute: async ({ hour, minute, label }) => action('set_alarm', { hour, minute, label }),
  }),
  calendarEvent: tool({
    description: 'Prepare an Android calendar event. Saving remains user-controlled.',
    inputSchema: z.object({ title: z.string().min(1), startIso: z.string().min(1), durationMinutes: z.number().int().min(1).max(1440).default(60) }),
    execute: async ({ title, startIso, durationMinutes }) => action('calendar_event', { title, startIso, durationMinutes }, 'required', `create the calendar event “${title}”`, 'Confirm calendar event'),
  }),
  emailDraft: tool({
    description: 'Prepare an email draft without sending it.',
    inputSchema: z.object({ to: z.string().email().optional(), subject: z.string().default(''), body: z.string().default('') }),
    execute: async ({ to, subject, body }) => action('email_draft', { to: to ?? '', subject, body }, 'required', `prepare an email draft${to ? ` to ${to}` : ''}`, 'Confirm email draft'),
  }),
  dialNumber: tool({
    description: 'Open the Android phone dialer. Never place the call silently.',
    inputSchema: z.object({ number: z.string().min(3) }),
    execute: async ({ number }) => action('dial', { number }, 'required', `open the phone dialer for ${number}`, 'Confirm phone action'),
  }),
  openService: tool({
    description: 'Open a supported service. External-commitment services require confirmation.',
    inputSchema: z.object({ service: z.enum(['swiggy', 'blinkit', 'zomato', 'uber', 'ola', 'gmail', 'youtube', 'spotify', 'whatsapp', 'keep', 'calendar']), reason: z.string().min(1) }),
    execute: async ({ service, reason }) => { const needs=['swiggy','blinkit','zomato','uber','ola','whatsapp'].includes(service); return action('open_service', { service, reason }, needs ? 'required' : 'not_required', needs ? `open ${service} for ${reason}` : undefined, needs ? 'Confirm service' : undefined); },
  }),
  remember: tool({
    description: 'Store a durable user preference or fact only when the user explicitly asks G.U.H.A.N. to remember, save, or store it.',
    inputSchema: z.object({ text: z.string().min(1).max(500) }),
    execute: async ({ text }) => action('remember', { text }),
  }),
  forgetMemory: tool({
    description: 'Forget a matching stored memory when the user explicitly asks to forget it.',
    inputSchema: z.object({ text: z.string().min(1).max(500) }),
    execute: async ({ text }) => action('forget_memory', { text }),
  }),
};

const researchTool = process.env.EXA_API_KEY ? webSearch() : null;
export const activeTools = researchTool ? { ...tools, webResearch: researchTool } : tools;

function runtimeSystem(memory: string[], client: Record<string, unknown> = {}) {
  const context = `Runtime context: UTC time ${new Date().toISOString()}; timezone ${client.timezone || 'unknown'}; locale ${client.locale || 'unknown'}; system assistant ${client.systemAssistant ? 'active' : 'not active'}.
Android device context: ${client.deviceContext ? JSON.stringify(client.deviceContext) : 'not available'}.
${memory.length ? `Local memory (user-editable):\n${memory.slice(-30).join('\n')}\n` : 'Local memory: none.'}
${process.env.EXA_API_KEY ? 'Real-time web research is available through webResearch.' : 'Real-time web research is unavailable; use webSearch only when browser search is appropriate.'}`;
  return `${baseInstructions}\n\n${context}`;
}

export const guhanAgent = new ToolLoopAgent({
  model: 'openai/gpt-5.6-sol',
  instructions: baseInstructions,
  tools: activeTools,
  stopWhen: stepCountIs(8),
  maxRetries: 2,
});

export async function runGuhan(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, memory: string[] = [], client: Record<string, unknown> = {}) {
  const result = await guhanAgent.generate({ messages: [{ role: 'system', content: runtimeSystem(memory, client) }, ...messages.slice(-40)] });
  const toolResults = result.steps.flatMap((step: any) => (step.toolResults ?? []).map((tr: any) => ({ toolName: tr.toolName, result: tr.result ?? tr.output })));
  return { text: result.text, toolResults, model: result.model, finishReason: await result.finishReason };
}

export function streamGuhan(messages: Array<{ role: 'user' | 'assistant' | 'system'; content: string }>, memory: string[] = [], client: Record<string, unknown> = {}) {
  return streamText({
    model: 'openai/gpt-5.6-sol',
    system: runtimeSystem(memory, client),
    tools: activeTools,
    messages: messages.slice(-40),
    stopWhen: stepCountIs(8),
    maxRetries: 2,
    toolCallStreaming: false,
  });
}
