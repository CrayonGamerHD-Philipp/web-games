import { json } from '@sveltejs/kit';
import { closeGame, makeMove, requestGameEndAction, restartGame, startGame } from '$lib/server/parties.js';

export async function POST({ params, request }) {
  const body = await request.json().catch(() => ({}));
  let result;

  if (body.action === 'start') {
    result = startGame(params.code, body.playerId, body.gameId);
  } else if (body.action === 'restart') {
    result = restartGame(params.code, body.playerId);
  } else if (body.action === 'close') {
    result = closeGame(params.code, body.playerId);
  } else if (body.action === 'request-rematch') {
    result = requestGameEndAction(params.code, body.playerId, 'rematch');
  } else if (body.action === 'request-new-game') {
    result = requestGameEndAction(params.code, body.playerId, 'newGame');
  } else if (body.action === 'move') {
    result = makeMove(params.code, body.playerId, body.move ?? { cellIndex: body.cellIndex });
  } else {
    result = { status: 400, error: 'Diese Spielaktion ist nicht bekannt.' };
  }

  if (result.error) {
    return json({ message: result.error }, { status: result.status ?? 400 });
  }

  return json(result);
}