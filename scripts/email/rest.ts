// The little of the Firestore and Firebase Auth REST APIs the sender needs. Requests go through `Request`, which is
// UrlFetchApp in Apps Script (synchronous) and a test double elsewhere. The caller is the project's owner, so these
// calls are not subject to the security rules.

export interface Response {
  status: number
  json: unknown
}
export type Request = (method: 'GET' | 'POST' | 'PATCH', url: string, body?: unknown) => Response

type Value = Record<string, unknown>
interface RestDoc {
  name: string
  fields?: Record<string, Value>
  updateTime?: string
}
export interface Doc {
  id: string
  /** The full resource name. */
  name: string
  updateTime: string
  data: Record<string, unknown>
}

function decode(value: Value): unknown {
  if ('stringValue' in value) return value.stringValue
  if ('booleanValue' in value) return value.booleanValue
  if ('integerValue' in value) return Number(value.integerValue)
  if ('doubleValue' in value) return value.doubleValue
  if ('timestampValue' in value) return value.timestampValue
  if ('arrayValue' in value)
    return ((value.arrayValue as { values?: Value[] }).values ?? []).map(decode)
  if ('mapValue' in value) return decodeFields((value.mapValue as RestDoc).fields)
  return null
}
function decodeFields(fields: Record<string, Value> = {}): Record<string, unknown> {
  return Object.fromEntries(Object.entries(fields).map(([key, value]) => [key, decode(value)]))
}

type Plain = string | number | boolean | Date
function encode(value: Plain): Value {
  if (value instanceof Date) return { timestampValue: value.toISOString() }
  if (typeof value === 'number') return { integerValue: String(value) }
  if (typeof value === 'boolean') return { booleanValue: value }
  return { stringValue: value }
}

const toDoc = (doc: RestDoc): Doc => ({
  id: doc.name.split('/').pop()!,
  name: doc.name,
  updateTime: doc.updateTime ?? '',
  data: decodeFields(doc.fields),
})

export interface Hosts {
  /** https://firestore.googleapis.com (or the emulator) */
  firestore: string
  /** https://identitytoolkit.googleapis.com (or the emulator's …/identitytoolkit.googleapis.com) */
  auth: string
}
export const GOOGLE_HOSTS: Hosts = {
  firestore: 'https://firestore.googleapis.com',
  auth: 'https://identitytoolkit.googleapis.com',
}

export function createStore(request: Request, hosts: Hosts, projectId: string, programId: string) {
  const root = `${hosts.firestore}/v1/projects/${projectId}/databases/(default)/documents`
  const program = `${root}/programs/${programId}`
  const fail = (what: string, response: Response) =>
    new Error(`${what} failed (${response.status}): ${JSON.stringify(response.json).slice(0, 300)}`)

  return {
    /** A document under the program ("" is the program itself), or null. */
    get(path: string): Doc | null {
      const response = request('GET', path ? `${program}/${path}` : program)
      if (response.status === 404) return null
      if (response.status !== 200) throw fail(`Reading ${path || 'the program'}`, response)
      return toDoc(response.json as RestDoc)
    },
    /** Every document in a collection under the program. */
    list(collection: string): Doc[] {
      const docs: Doc[] = []
      let pageToken = ''
      do {
        const page = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''
        const response = request('GET', `${program}/${collection}?pageSize=300${page}`)
        if (response.status !== 200) throw fail(`Listing ${collection}`, response)
        const json = response.json as { documents?: RestDoc[]; nextPageToken?: string }
        docs.push(...(json.documents ?? []).map(toDoc))
        pageToken = json.nextPageToken ?? ''
      } while (pageToken)
      return docs
    },
    /** Outbox items still waiting. */
    pending(limit: number): Doc[] {
      const response = request('POST', `${program}:runQuery`, {
        structuredQuery: {
          from: [{ collectionId: 'outbox' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'state' },
              op: 'EQUAL',
              value: { stringValue: 'pending' },
            },
          },
          limit,
        },
      })
      if (response.status !== 200) throw fail('Checking the outbox', response)
      return (response.json as { document?: RestDoc }[])
        .filter((row) => row.document)
        .map((row) => toDoc(row.document!))
    },
    /**
     * Sets a few fields. With `ifUnchangedSince` (a doc's updateTime) the write is refused if someone else changed
     * the doc first; returns false then.
     */
    patch(doc: Pick<Doc, 'name'>, fields: Record<string, Plain>, ifUnchangedSince?: string) {
      // The precondition goes in the body (a commit), not the URL: the emulator ignores it there.
      const response = request('POST', `${root}:commit`, {
        writes: [
          {
            update: {
              name: doc.name,
              fields: Object.fromEntries(
                Object.entries(fields).map(([key, value]) => [key, encode(value)]),
              ),
            },
            updateMask: { fieldPaths: Object.keys(fields) },
            ...(ifUnchangedSince ? { currentDocument: { updateTime: ifUnchangedSince } } : {}),
          },
        ],
      })
      if (ifUnchangedSince && (response.status === 400 || response.status === 409)) return false
      if (response.status !== 200) throw fail('Updating the outbox', response)
      return true
    },
    /** Tells the app whether email is set up (programs/{p}.email.on). */
    setEmailOn(on: boolean) {
      const response = request('PATCH', `${program}?updateMask.fieldPaths=email.on`, {
        fields: { email: { mapValue: { fields: { on: encode(on) } } } },
      })
      if (response.status !== 200) throw fail('Updating the program', response)
    },
    /** uid → the email each person signs in with (from Firebase Authentication, not the database). */
    emails(): Record<string, string> {
      const emails: Record<string, string> = {}
      let pageToken = ''
      do {
        const page = pageToken ? `&nextPageToken=${encodeURIComponent(pageToken)}` : ''
        const response = request(
          'GET',
          `${hosts.auth}/v1/projects/${projectId}/accounts:batchGet?maxResults=500${page}`,
        )
        if (response.status !== 200) throw fail('Reading sign-in emails', response)
        const json = response.json as {
          users?: { localId: string; email?: string; disabled?: boolean }[]
          nextPageToken?: string
        }
        for (const user of json.users ?? [])
          if (user.email && !user.disabled) emails[user.localId] = user.email
        pageToken = json.nextPageToken ?? ''
      } while (pageToken)
      return emails
    },
  }
}
export type Store = ReturnType<typeof createStore>
