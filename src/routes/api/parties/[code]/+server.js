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
  const result = body.action === 'rename'
    ? renamePlayer(params.code, body.playerId, body.name)
    : body.action === 'change-color'
      ? changePlayerColor(params.code, body.playerId, body.color)
      : body.action === 'set-locked'
        ? setPartyLocked(params.code, body.playerId, body.locked)
        : body.action === 'transfer-host'
          ? transferPartyHost(params.code, body.playerId, body.targetPlayerId)
          : body.action === 'remove-player'
            ? removePartyPlayer(params.code, body.playerId, body.targetPlayerId)
            : joinParty(params.code, body.name);

  if (result.error) {
    return json({ message: result.error }, { status: result.status ?? 400 });
  }

  return json(result, { status: body.action ? 200 : 201 });
}





