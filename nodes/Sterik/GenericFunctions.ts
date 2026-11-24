import type {
	IDataObject,
	IExecuteFunctions,
	IHookFunctions,
	IHttpRequestMethods,
	ILoadOptionsFunctions,
	INodePropertyOptions,
} from 'n8n-workflow';

type Context = IExecuteFunctions | IHookFunctions | ILoadOptionsFunctions;

/** Calls the Sterik API and returns what it put under `data`. */
export async function sterikRequest(
	this: Context,
	method: IHttpRequestMethods,
	path: string,
	body?: IDataObject,
	qs?: IDataObject,
): Promise<IDataObject> {
	const credentials = await this.getCredentials('sterikApi');
	const baseUrl = String(credentials.baseUrl).replace(/\/$/, '');
	const response = (await this.helpers.httpRequestWithAuthentication.call(this, 'sterikApi', {
		method,
		url: `${baseUrl}${path}`,
		body,
		qs,
		json: true,
	})) as { data: IDataObject };
	return response.data;
}

/** Every item of a Sterik list route, page by page. */
export async function sterikRequestAll(
	this: Context,
	path: string,
	qs: IDataObject = {},
): Promise<IDataObject[]> {
	const pageSize = 100;
	const items: IDataObject[] = [];
	for (let skip = 0; ; skip += pageSize) {
		const page = await sterikRequest.call(this, 'GET', path, undefined, {
			...qs,
			skip,
			limit: pageSize,
		});
		const pageItems = (page.items as IDataObject[]) ?? [];
		items.push(...pageItems);
		if (pageItems.length < pageSize || items.length >= Number(page.total)) return items;
	}
}

export async function getWorkspaces(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const workspaces = await sterikRequestAll.call(this, '/workspace/list');
	return workspaces.map((workspace) => ({
		name: String(workspace.name),
		value: String(workspace._id),
	}));
}

export async function getAgents(this: ILoadOptionsFunctions): Promise<INodePropertyOptions[]> {
	const workspaceId = this.getCurrentNodeParameter('workspaceId') as string;
	if (!workspaceId) return [];
	const agents = await sterikRequestAll.call(this, '/chat-bot/list', { workspaceId });
	return agents.map((agent) => ({
		name: String(agent.name),
		value: String(agent._id),
	}));
}
