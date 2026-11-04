import { json } from '@sveltejs/kit';
import { createParty } from '$lib/server/parties.js';

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const result = createParty(body.name, body.avatar);

  if (result.error) {
    return json({ message: result.error }, { status: 400 });
  }

  return json(result, { status: 201 });
}