import { json } from '@sveltejs/kit';
import { changePlayerColor, getParty, joinParty, removePartyPlayer, renamePlayer, setPartyLocked, transferPartyHost } from '$lib/server/parties.js';

export function GET({ params }) {
  const party = getParty(params.code);

  if (!party) {
    return json({ message: 'Diese Party wurde nicht gefunden.' }, { status: 404 });
  }

  return json({ party });
}

export async function POST({ params, request }) {
  const body = await request.json().catch(() => ({}));
  let result;

  if (body.action === 'rename') {
    result = renamePlayer(params.code, body.token, body.name);
  } else if (body.action === 'change-color') {
    result = changePlayerColor(params.code, body.token, body.color);
  } else if (body.action === 'set-locked') {
    result = setPartyLocked(params.code, body.token, body.locked);
  } else if (body.action === 'transfer-host') {
    result = transferPartyHost(params.code, body.token, body.targetPlayerId);
  } else if (body.action === 'remove-player') {
    result = removePartyPlayer(params.code, body.token, body.targetPlayerId);
  } else if (!body.action || body.action === 'join') {
    result = joinParty(params.code, body.name);
  } else {
    result = { status: 400, error: 'Diese Aktion ist nicht bekannt.' };
  }

  if (result.error) {
    return json({ message: result.error }, { status: result.status ?? 400 });
  }

  return json(result, { status: body.action ? 200 : 201 });
}





