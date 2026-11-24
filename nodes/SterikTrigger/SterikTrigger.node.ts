import { createHmac, timingSafeEqual } from 'crypto';
import {
	NodeConnectionTypes,
	type IDataObject,
	type IHookFunctions,
	type INodeType,
	type INodeTypeDescription,
	type IWebhookFunctions,
	type IWebhookResponseData,
} from 'n8n-workflow';

import { getAgents, getWorkspaces, sterikRequest } from '../Sterik/GenericFunctions';

const EVENTS = [
	{ name: 'Conversation Ended', value: 'conversation.ended' },
	{ name: 'Follow-Up Sent', value: 'follow_up.sent' },
	{ name: 'Handover Requested', value: 'handover.requested' },
	{ name: 'Lead Submitted', value: 'lead.submitted' },
	{ name: 'Lead Updated', value: 'lead.updated' },
	{ name: 'Meeting Booked', value: 'meeting.booked' },
	{ name: 'Meeting Cancelled', value: 'meeting.cancelled' },
	{ name: 'Meeting No-Show', value: 'meeting.no_show' },
	{ name: 'Message Created', value: 'message.created' },
	{ name: 'Review Replied', value: 'review.replied' },
	{ name: 'Source Failed', value: 'source.failed' },
	{ name: 'Source Trained', value: 'source.trained' },
	{ name: 'Ticket Solved', value: 'ticket.solved' },
];

/** Whether `header` is `sha256=<hex HMAC-SHA256 of body>` under `secret`. */
const validSignature = (secret: string, body: Buffer | string, header: string | undefined) => {
	if (!header) return false;
	const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(body).digest('hex')}`);
	const received = Buffer.from(header);
	return expected.length === received.length && timingSafeEqual(expected, received);
};

export class SterikTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sterik Trigger',
		name: 'sterikTrigger',
		icon: { light: 'file:sterik.svg', dark: 'file:sterik.dark.svg' },
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["events"].join(", ")}}',
		description: 'Starts the workflow when something happens on a Sterik agent',
		defaults: { name: 'Sterik Trigger' },
		inputs: [],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'sterikApi', required: true }],
		webhooks: [
			{
				name: 'default',
				httpMethod: 'POST',
				responseMode: 'onReceived',
				path: 'webhook',
			},
		],
		properties: [
			{
				displayName: 'Workspace Name or ID',
				name: 'workspaceId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getWorkspaces' },
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Agent Name or ID',
				name: 'chatBotId',
				type: 'options',
				typeOptions: { loadOptionsMethod: 'getAgents', loadOptionsDependsOn: ['workspaceId'] },
				required: true,
				default: '',
				description:
					'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				options: EVENTS,
				required: true,
				default: ['lead.submitted'],
				description: 'The events that start the workflow',
			},
			{
				displayName:
					'The workflow URL must be public HTTPS. Sterik refuses localhost and private addresses.',
				name: 'notice',
				type: 'notice',
				default: '',
			},
		],
	};

	methods = {
		loadOptions: { getWorkspaces, getAgents },
	};

	webhookMethods = {
		default: {
			// Adding is idempotent on the API side, so it is always (re)done on
			// activation; that also restores a URL someone removed in the dashboard.
			async checkExists(this: IHookFunctions): Promise<boolean> {
				return false;
			},
			async create(this: IHookFunctions): Promise<boolean> {
				const chatBotId = this.getNodeParameter('chatBotId') as string;
				const url = this.getNodeWebhookUrl('default') as string;
				const result = await sterikRequest.call(
					this,
					'POST',
					`/chat-bot/${chatBotId}/webhooks/add`,
					{ url },
				);
				const staticData = this.getWorkflowStaticData('node');
				staticData.webhookSecret = (result.webhook as IDataObject).webhookSecret;
				staticData.chatBotId = chatBotId;
				return true;
			},
			async delete(this: IHookFunctions): Promise<boolean> {
				const staticData = this.getWorkflowStaticData('node');
				const chatBotId =
					(staticData.chatBotId as string) ?? (this.getNodeParameter('chatBotId') as string);
				const url = this.getNodeWebhookUrl('default') as string;
				try {
					await sterikRequest.call(this, 'POST', `/chat-bot/${chatBotId}/webhooks/remove`, {
						url,
					});
				} catch (error) {
					this.logger.warn(`Could not remove the Sterik webhook: ${(error as Error).message}`);
					return false;
				}
				delete staticData.webhookSecret;
				delete staticData.chatBotId;
				return true;
			},
		},
	};

	async webhook(this: IWebhookFunctions): Promise<IWebhookResponseData> {
		const request = this.getRequestObject();
		const secret = this.getWorkflowStaticData('node').webhookSecret as string | undefined;
		const rawBody = (request as unknown as { rawBody?: Buffer }).rawBody;

		if (
			!secret ||
			!rawBody ||
			!validSignature(secret, rawBody, this.getHeaderData()['x-webhook-signature'] as string)
		) {
			this.getResponseObject().status(401).send('Invalid signature');
			return { noWebhookResponse: true };
		}

		const body = this.getBodyData();
		const events = this.getNodeParameter('events') as string[];
		if (!events.includes(body.event as string)) {
			return {};
		}

		return { workflowData: [this.helpers.returnJsonArray(body)] };
	}
}
