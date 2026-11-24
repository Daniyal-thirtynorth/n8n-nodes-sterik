import type {
	IAuthenticateGeneric,
	Icon,
	ICredentialTestRequest,
	ICredentialType,
	INodeProperties,
} from 'n8n-workflow';

export class SterikApi implements ICredentialType {
	name = 'sterikApi';

	displayName = 'Sterik API';

	icon: Icon = {
		light: 'file:../nodes/Sterik/sterik.svg',
		dark: 'file:../nodes/Sterik/sterik.dark.svg',
	};

	documentationUrl = 'https://github.com/Daniyal-thirtynorth/n8n-nodes-sterik#credentials';

	properties: INodeProperties[] = [
		{
			displayName: 'API Key',
			name: 'apiKey',
			type: 'string',
			typeOptions: { password: true },
			required: true,
			default: '',
			placeholder: 'sb_...',
			description: 'Create one in the Sterik dashboard under API keys. It is shown only once.',
		},
		{
			displayName: 'API URL',
			name: 'baseUrl',
			type: 'string',
			required: true,
			default: 'https://api.sterik.ai',
			description: 'Address of the Sterik API, without a trailing slash',
		},
	];

	authenticate: IAuthenticateGeneric = {
		type: 'generic',
		properties: {
			headers: {
				Authorization: '=Bearer {{$credentials.apiKey}}',
			},
		},
	};

	test: ICredentialTestRequest = {
		request: {
			baseURL: '={{$credentials.baseUrl.replace(/\\/$/, "")}}',
			url: '/user/profile',
		},
	};
}
