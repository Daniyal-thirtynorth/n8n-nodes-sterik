import {
	NodeApiError,
	NodeConnectionTypes,
	NodeOperationError,
	type JsonObject,
	type IDataObject,
	type IExecuteFunctions,
	type INodeExecutionData,
	type INodeProperties,
	type INodeType,
	type INodeTypeDescription,
} from 'n8n-workflow';

import {
	getAgents,
	getWorkspaces,
	sterikRequest,
	sterikRequestAll,
} from './GenericFunctions';

const show = (resource: string, operation?: string[]) => ({
	show: operation ? { resource: [resource], operation } : { resource: [resource] },
});

const agentFields: INodeProperties[] = [
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
		displayOptions: {
			hide: { resource: ['agent'], operation: ['getAll'] },
		},
		description:
			'Choose from the list, or specify an ID using an <a href="https://docs.n8n.io/code/expressions/">expression</a>',
	},
];

const limitFields = (resource: string): INodeProperties[] => [
	{
		displayName: 'Return All',
		name: 'returnAll',
		type: 'boolean',
		default: false,
		displayOptions: show(resource, ['getAll']),
		description: 'Whether to return all results or only up to a given limit',
	},
	{
		displayName: 'Limit',
		name: 'limit',
		type: 'number',
		typeOptions: { minValue: 1 },
		default: 50,
		displayOptions: {
			show: { resource: [resource], operation: ['getAll'], returnAll: [false] },
		},
		description: 'Max number of results to return',
	},
];

export class Sterik implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Sterik',
		name: 'sterik',
		icon: { light: 'file:sterik.svg', dark: 'file:sterik.dark.svg' },
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Chat with Sterik AI agents and manage their leads and training data',
		defaults: { name: 'Sterik' },
		usableAsTool: true,
		inputs: [NodeConnectionTypes.Main],
		outputs: [NodeConnectionTypes.Main],
		credentials: [{ name: 'sterikApi', required: true }],
		properties: [
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Agent', value: 'agent' },
					{ name: 'Conversation', value: 'conversation' },
					{ name: 'Lead', value: 'lead' },
					{ name: 'Training Data', value: 'trainingData' },
				],
				default: 'agent',
			},

			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('agent'),
				options: [
					{
						name: 'Ask',
						value: 'ask',
						description: 'Send a message to an agent and get its reply',
						action: 'Ask an agent',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the agents of a workspace',
						action: 'Get many agents',
					},
					{
						name: 'Retrain',
						value: 'retrain',
						description: 'Re-embed all training data of an agent',
						action: 'Retrain an agent',
					},
				],
				default: 'ask',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('conversation'),
				options: [
					{
						name: 'Get',
						value: 'get',
						description: 'Get a conversation with its messages',
						action: 'Get a conversation',
					},
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the conversations of an agent',
						action: 'Get many conversations',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('lead'),
				options: [
					{ name: 'Get', value: 'get', description: 'Get a lead', action: 'Get a lead' },
					{
						name: 'Get Many',
						value: 'getAll',
						description: 'List the leads of an agent',
						action: 'Get many leads',
					},
					{
						name: 'Update',
						value: 'update',
						description: 'Change the status of a lead or pause its follow-ups',
						action: 'Update a lead',
					},
				],
				default: 'getAll',
			},
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: show('trainingData'),
				options: [
					{
						name: 'Add Q&A',
						value: 'addQna',
						description: 'Teach the agent the answer to a question',
						action: 'Add a q a pair',
					},
					{
						name: 'Add Text',
						value: 'addText',
						description: 'Train the agent on a block of text',
						action: 'Add text',
					},
				],
				default: 'addText',
			},

			...agentFields,

			{
				displayName: 'Message',
				name: 'message',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				displayOptions: show('agent', ['ask']),
				description: 'What to ask the agent',
			},
			{
				displayName: 'Channel',
				name: 'channel',
				type: 'options',
				options: [
					{ name: 'Android SDK', value: 'android_sdk' },
					{ name: 'Center Stage', value: 'center_stage' },
					{ name: 'Chat Widget', value: 'chat_widget' },
					{ name: 'Help Page', value: 'help_page' },
					{ name: 'iOS SDK', value: 'ios_sdk' },
					{ name: 'WhatsApp', value: 'whatsapp' },
				],
				default: 'chat_widget',
				displayOptions: show('agent', ['ask']),
				description: 'Whose instructions the agent follows',
			},
			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				default: '',
				displayOptions: show('agent', ['ask']),
				description: 'Continue this conversation. Leave empty to start a new one.',
			},

			{
				displayName: 'Conversation ID',
				name: 'conversationId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: show('conversation', ['get']),
			},

			{
				displayName: 'Lead ID',
				name: 'leadId',
				type: 'string',
				required: true,
				default: '',
				displayOptions: show('lead', ['get', 'update']),
			},
			{
				displayName: 'Update Fields',
				name: 'updateFields',
				type: 'collection',
				placeholder: 'Add Field',
				default: {},
				displayOptions: show('lead', ['update']),
				options: [
					{
						displayName: 'Follow-Ups Paused',
						name: 'followUpsPaused',
						type: 'boolean',
						default: false,
						description: 'Whether to pause the follow-ups of this lead',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Contacted', value: 'contacted' },
							{ name: 'Lost', value: 'lost' },
							{ name: 'New', value: 'new' },
							{ name: 'Won', value: 'won' },
						],
						default: 'contacted',
						description: 'Won and lost stop the follow-ups',
					},
				],
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: show('lead', ['getAll']),
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Matches name, email, phone and summary',
					},
					{
						displayName: 'Status',
						name: 'status',
						type: 'options',
						options: [
							{ name: 'Contacted', value: 'contacted' },
							{ name: 'Lost', value: 'lost' },
							{ name: 'New', value: 'new' },
							{ name: 'Won', value: 'won' },
						],
						default: 'new',
					},
				],
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'collection',
				placeholder: 'Add Filter',
				default: {},
				displayOptions: show('conversation', ['getAll']),
				options: [
					{
						displayName: 'Search',
						name: 'search',
						type: 'string',
						default: '',
						description: 'Matches the messages of the conversation',
					},
					{
						displayName: 'Source',
						name: 'source',
						type: 'options',
						options: [
							{ name: 'Phone', value: 'phone' },
							{ name: 'Playground', value: 'playground' },
							{ name: 'WhatsApp', value: 'whatsapp' },
							{ name: 'Widget', value: 'widget' },
						],
						default: 'widget',
					},
				],
			},

			{
				displayName: 'Name',
				name: 'name',
				type: 'string',
				default: '',
				displayOptions: show('trainingData', ['addText']),
				description: 'Label shown in the training data list',
			},
			{
				displayName: 'Text',
				name: 'content',
				type: 'string',
				typeOptions: { rows: 5 },
				required: true,
				default: '',
				displayOptions: show('trainingData', ['addText']),
			},
			{
				displayName: 'Question',
				name: 'question',
				type: 'string',
				required: true,
				default: '',
				displayOptions: show('trainingData', ['addQna']),
			},
			{
				displayName: 'Answer',
				name: 'answer',
				type: 'string',
				typeOptions: { rows: 3 },
				required: true,
				default: '',
				displayOptions: show('trainingData', ['addQna']),
			},

			...limitFields('agent'),
			...limitFields('conversation'),
			...limitFields('lead'),
		],
	};

	methods = {
		loadOptions: { getWorkspaces, getAgents },
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		for (let i = 0; i < items.length; i++) {
			try {
				const resource = this.getNodeParameter('resource', i) as string;
				const operation = this.getNodeParameter('operation', i) as string;
				const result = await run.call(this, resource, operation, i);
				const results = Array.isArray(result) ? result : [result];
				returnData.push(...results.map((json) => ({ json, pairedItem: { item: i } })));
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: { error: (error as Error).message },
						pairedItem: { item: i },
					});
					continue;
				}
				throw new NodeApiError(this.getNode(), error as JsonObject, { itemIndex: i });
			}
		}

		return [returnData];
	}
}

async function list(
	this: IExecuteFunctions,
	path: string,
	i: number,
	qs: IDataObject,
): Promise<IDataObject[]> {
	if (this.getNodeParameter('returnAll', i)) {
		return sterikRequestAll.call(this, path, qs);
	}
	const limit = this.getNodeParameter('limit', i) as number;
	const page = await sterikRequest.call(this, 'GET', path, undefined, { ...qs, limit });
	return (page.items as IDataObject[]) ?? [];
}

async function run(
	this: IExecuteFunctions,
	resource: string,
	operation: string,
	i: number,
): Promise<IDataObject | IDataObject[]> {
	const workspaceId = this.getNodeParameter('workspaceId', i) as string;
	const chatBotId =
		resource === 'agent' && operation === 'getAll'
			? ''
			: (this.getNodeParameter('chatBotId', i) as string);

	if (resource === 'agent') {
		if (operation === 'ask') {
			const conversationId = this.getNodeParameter('conversationId', i) as string;
			return sterikRequest.call(
				this,
				'POST',
				`/playground/${chatBotId}/chat`,
				{
					message: this.getNodeParameter('message', i) as string,
					channel: this.getNodeParameter('channel', i) as string,
					...(conversationId ? { conversationId } : {}),
				},
				{ stream: 'false' },
			);
		}
		if (operation === 'getAll') {
			return list.call(this, '/chat-bot/list', i, { workspaceId });
		}
		if (operation === 'retrain') {
			return sterikRequest.call(this, 'POST', `/chat-bot/${chatBotId}/retrain`);
		}
	}

	if (resource === 'conversation') {
		if (operation === 'get') {
			const conversationId = this.getNodeParameter('conversationId', i) as string;
			const result = await sterikRequest.call(
				this,
				'GET',
				`/playground/conversations/${conversationId}/get`,
			);
			return result.conversation as IDataObject;
		}
		if (operation === 'getAll') {
			const filters = this.getNodeParameter('filters', i) as IDataObject;
			return list.call(this, `/playground/${chatBotId}/conversations/list`, i, filters);
		}
	}

	if (resource === 'lead') {
		if (operation === 'get' || operation === 'update') {
			const leadId = this.getNodeParameter('leadId', i) as string;
			const result =
				operation === 'get'
					? await sterikRequest.call(this, 'GET', `/playground/${chatBotId}/leads/${leadId}/get`)
					: await sterikRequest.call(
							this,
							'PATCH',
							`/playground/${chatBotId}/leads/${leadId}/update`,
							this.getNodeParameter('updateFields', i) as IDataObject,
						);
			return result.lead as IDataObject;
		}
		if (operation === 'getAll') {
			const filters = this.getNodeParameter('filters', i) as IDataObject;
			return list.call(this, `/playground/${chatBotId}/leads/list`, i, filters);
		}
	}

	if (resource === 'trainingData') {
		const source =
			operation === 'addQna'
				? {
						sourceType: 'question_and_answer',
						question: this.getNodeParameter('question', i) as string,
						answer: this.getNodeParameter('answer', i) as string,
					}
				: {
						sourceType: 'text',
						content: this.getNodeParameter('content', i) as string,
						...((this.getNodeParameter('name', i) as string)
							? { name: this.getNodeParameter('name', i) as string }
							: {}),
					};
		return sterikRequest.call(this, 'POST', `/chat-bot/${chatBotId}/content/upload`, {
			sources: [source],
		});
	}

	throw new NodeOperationError(this.getNode(), `Unsupported operation "${operation}"`, {
		itemIndex: i,
	});
}
