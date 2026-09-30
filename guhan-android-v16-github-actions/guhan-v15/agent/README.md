# G.U.H.A.N. Agent V3

Server-side AI agent for G.U.H.A.N. Android. It uses Vercel AI SDK `ToolLoopAgent` with GPT-5.6 Sol, bounded multi-step tool use, local-memory context, and optional real-time Exa web research.

## Deploy
1. Create a Vercel project from this `agent` directory.
2. Add `AI_GATEWAY_API_KEY` as a server-side environment variable.
3. Optionally add `EXA_API_KEY` for real-time web research.
4. Deploy the `agent` directory.
5. In G.U.H.A.N. Android, set the server once with:
   `set AI server URL https://your-project.vercel.app`

The Android app calls `/api/chat` over HTTPS. Server secrets never ship inside the APK.

## Agent behavior
The agent receives real conversation history rather than a flattened prompt, can use multiple tools in a bounded loop, and is instructed to clarify only when necessary, avoid fabrication, and use current web research when available.

## Safety contract
Tool results are action descriptors. The Android client checks `confirmation: required` before executing consequential actions. The agent never receives or stores payment credentials and does not bypass permissions, authentication, age restrictions, parental controls, or platform safety systems.


## V16 streaming
The Android client can POST to `/api/stream`. The endpoint emits newline-delimited JSON containing streamed text deltas plus tool-result actions. The client executes those actions with the same confirmation gates used by the non-streaming endpoint.

The backend uses AI SDK `streamText` with an 8-step tool loop. Private reasoning is not streamed to the client.


## V16 Unified Command Center
Voice, typed chat, system-assistant invocation, memory, tools, confirmations, and Android actions now pass through a single client command queue. Consequential actions remain confirmation-gated, and command state is surfaced as received, pending, approved/cancelled, or failed.
