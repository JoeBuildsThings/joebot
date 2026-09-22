import {Composio} from '@composio/core';

const apiKey = process.env.COMPOSIO_API_KEY;
const userId = process.env.COMPOSIO_USER_ID || 'default';

let client = null;

function getClient() {
  if (!apiKey) {
    return null;
  }

  if (!client) {
    client = new Composio({apiKey});
  }

  return client;
}

export async function searchComposioAction(request, app) {
  const composio = getClient();

  if (!composio) {
    return {
      action: null,
      needsConnection: false,
      app: app || 'unknown',
      message: 'Composio is not configured yet. Add COMPOSIO_API_KEY to .env first.'
    };
  }

  if (app) {
    const connection = await composio.connectedAccounts.list({userId, toolkit: app});

    if (!connection || connection.items.length === 0) {
      const link = await composio.toolkits.authorize(userId, app);

      return {
        action: null,
        needsConnection: true,
        app,
        connectUrl: link.redirectUrl
      };
    }
  }

  const results = await composio.tools.get(userId, {
    search: request,
    toolkits: app ? [app] : undefined,
    limit: 1
  });

  if (!results || results.length === 0) {
    return {
      action: null,
      needsConnection: false,
      app: app || 'unknown'
    };
  }

  return {
    action: results[0],
    needsConnection: false,
    app: app || 'unknown',
    args: {}
  };
}

export async function executeComposioAction(action, args = {}) {
  const composio = getClient();

  if (!composio) {
    return {
      status: 'error',
      message: 'Composio is not configured yet.'
    };
  }

  const result = await composio.tools.execute(action.slug, {
    userId,
    arguments: args
  });

  return {
    status: result.successful ? 'ok' : 'error',
    data: result.data,
    message: result.error || 'Action completed.'
  };
}
