# n8n-nodes-sterik

[n8n](https://n8n.io) nodes for [Sterik](https://sterik.ai): chat with your AI agents, manage their leads and training data, and start workflows when something happens on an agent.

- [Installation](#installation)
- [Credentials](#credentials)
- [Nodes](#nodes)
- [Development](#development)
- [Releasing](#releasing)

## Installation

**Self-hosted n8n:** Settings → Community Nodes → Install → `n8n-nodes-sterik`.

**n8n Cloud:** search "Sterik" in the nodes panel (available once n8n has verified the node).

See n8n's [community nodes guide](https://docs.n8n.io/integrations/community-nodes/installation/).

## Credentials

1. In the Sterik dashboard, open **API keys** and create a key. Copy it: it is shown only once.
2. In n8n, add a **Sterik API** credential and paste the key.
3. Leave **API URL** as it is, unless you run your own Sterik API.

A key acts as the user who created it, on every workspace they can open. Revoke it in the dashboard at any time.

## Nodes

### Sterik

| Resource      | Operations                                             |
| ------------- | ------------------------------------------------------ |
| Agent         | Ask (send a message, get the reply), Get many, Retrain |
| Conversation  | Get, Get many                                          |
| Lead          | Get, Get many, Update (status, pause follow-ups)       |
| Training Data | Add text, Add Q&A                                      |

Workspaces and agents are picked from dropdowns. Each Ask costs the agent model's credits, like any other chat. To continue a conversation, pass the `conversationId` from the previous reply.

The node can also be used as a tool by n8n's AI Agent.

### Sterik Trigger

Pick an agent and the events to listen to:

`lead.submitted`, `lead.updated`, `conversation.ended`, `handover.requested`, `message.created`, `ticket.solved`, `meeting.booked`, `meeting.cancelled`, `meeting.no_show`, `follow_up.sent`, `source.trained`, `source.failed`, `review.replied`.

Activating the workflow adds its URL to the agent's webhooks, and deactivating removes it. Every call is checked against the agent's signing secret, so forged calls are refused.

- The n8n URL must be public HTTPS. Sterik refuses `localhost` and private addresses, so test with n8n Cloud or a tunnel.
- Events are sent once with a 5 second timeout and are not retried.
- An agent can have at most 10 webhooks.

Output:

```json
{ "event": "lead.submitted", "chatBotId": "...", "createdAt": "...", "data": { ... } }
```

## Development

```bash
npm install
npm run dev     # starts n8n at http://localhost:5678 with these nodes loaded
npm run build
npm run lint
```

On an Intel Mac `npm run dev` fails (n8n's `isolated-vm` has no Intel macOS binary), so run n8n in Docker with the build mounted:

```bash
npm run build
docker run -d --name n8n-sterik -p 5678:5678 \
  -v n8n_sterik_data:/home/node/.n8n \
  -v "$PWD/dist":/home/node/.n8n/custom/n8n-nodes-sterik:ro \
  -e N8N_SECURE_COOKIE=false \
  docker.n8n.io/n8nio/n8n:latest
# after code changes: npm run build && docker restart n8n-sterik
```

From inside Docker, a Sterik API on your machine is `http://host.docker.internal:3000`.

Backend routes used: `GET /user/profile` (credential test), `GET /workspace/list`, `GET /chat-bot/list`, `POST /playground/:chatBotId/chat?stream=false`, `POST /chat-bot/:chatBotId/retrain`, `POST /chat-bot/:chatBotId/content/upload`, conversation and lead routes under `/playground`, and `POST /chat-bot/:chatBotId/webhooks/add` / `remove`.

## Releasing

npm releases go through GitHub Actions with npm provenance (`.github/workflows/publish.yml`), which n8n requires for verification:

1. One time: create the package on npm and add this repository as a Trusted Publisher (or set an `NPM_TOKEN` secret). Steps are at the top of `publish.yml`.
2. `npm run release`: lints, builds, bumps the version, updates the changelog, tags and pushes. The tag push publishes to npm.
3. Submit the package for verification in the [n8n Creator Portal](https://creators.n8n.io) to make it available on n8n Cloud.

## License

[MIT](LICENSE)
