import { createHmac, timingSafeEqual } from 'node:crypto'

/** Tamable re-signs each attempt with a fresh sent_at, so a real retry is never this old. */
const MAX_AGE_MS = 10 * 60 * 1000
export const MAX_BODY_BYTES = 10_000

/** The header Tamable signs each webhook call with. */
export const SIGNATURE_HEADER = 'x-tamable-signature'

export function isFromTamable(rawBody: Uint8Array, header: string | null | undefined, secret: string): boolean {
  if (!secret || !header) return false
  const expected = Buffer.from(`sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`)
  const given = Buffer.from(header)
  // timingSafeEqual throws on different lengths, so compare those first.
  return given.length === expected.length && timingSafeEqual(given, expected)
}

export interface WebhookReply {
  status: number
  body: { ok: boolean, message: string }
}

export type WebhookCheck
  = | { kind: 'changed' }
    | { kind: 'reply', reply: WebhookReply }

export interface WebhookRequest {
  rawBody: Uint8Array | undefined
  signature: string | null | undefined
  secret: string
  now?: number
}

export function reply(status: number, message: string): WebhookReply {
  return { status, body: { ok: status < 300, message } }
}

/** Checks a webhook call. `changed` means published content changed; anything else is already answered. */
export function checkWebhook(request: WebhookRequest): WebhookCheck {
  const answer = (status: number, message: string): WebhookCheck => ({ kind: 'reply', reply: reply(status, message) })

  if (!request.secret) return answer(503, 'The deploy webhook is not configured.')

  const rawBody = request.rawBody ?? new Uint8Array()
  if (rawBody.length > MAX_BODY_BYTES) return answer(413, 'Too large.')
  if (!isFromTamable(rawBody, request.signature, request.secret)) return answer(401, 'Bad signature.')

  let payload: { event?: unknown, sent_at?: unknown }
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString('utf8'))
  }
  catch {
    return answer(400, 'Not JSON.')
  }

  const sentAt = typeof payload.sent_at === 'string' ? Date.parse(payload.sent_at) : Number.NaN
  if (!Number.isFinite(sentAt) || Math.abs((request.now ?? Date.now()) - sentAt) > MAX_AGE_MS) {
    return answer(401, 'Stale or missing sent_at.')
  }

  if (payload.event === 'test') return answer(200, 'Test received. Nothing deployed.')
  if (payload.event !== 'content.changed') return answer(200, 'Event ignored.')
  return { kind: 'changed' }
}

/** Asks the host to rebuild by calling its build hook with a POST. */
export async function callDeployHook(deployHookUrl: string, doFetch: typeof fetch = fetch): Promise<WebhookReply> {
  const hook = new URL(deployHookUrl)
  // Forge shows this message on the deployment; other hosts get a plain POST.
  if (hook.hostname === 'forge.laravel.com') hook.searchParams.set('forge_deploy_message', 'Tamable: published content changed')

  try {
    const response = await doFetch(hook, { method: 'POST', signal: AbortSignal.timeout(10_000) })
    if (!response.ok) return reply(502, `The deploy hook answered ${response.status}.`)
  }
  catch {
    return reply(502, 'The deploy hook did not answer.')
  }

  return reply(202, 'Deploy started.')
}

export interface DeployRequest extends WebhookRequest {
  deployHookUrl: string
  fetch?: typeof fetch
}

/** The whole webhook for sites that rebuild on change: check the call, then call the build hook. */
export async function handleDeploy(request: DeployRequest): Promise<WebhookReply> {
  if (!request.deployHookUrl) return reply(503, 'The deploy webhook is not configured.')
  const check = checkWebhook(request)
  if (check.kind === 'reply') return check.reply
  return callDeployHook(request.deployHookUrl, request.fetch)
}
