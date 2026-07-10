import { json } from '@sveltejs/kit';
import { getParty, joinParty } from '$lib/server/parties.js';

export function GET({ params }) {
  const party = getParty(params.code);

  if (!party) {
    return json({ message: 'Diese Party wurde nicht gefunden.' }, { status: 404 });
  }

  return json({ party });
}

export async function POST({ params, request }) {
  const body = await request.json().catch(() => ({}));
  const result = joinParty(params.code, body.name);

  if (result.error) {
    return json({ message: result.error }, { status: result.status ?? 400 });
  }

  return json(result, { status: 201 });
}
