import { EXAM_CODES, type ExamCode } from '../../shared/contracts.js'
import { getEnv, type Env, type UserKind } from '../env.js'

const API_ORIGIN = 'https://api.intra.42.fr'
const PAGE_SIZE = 100
const PISCINE_DURATION_MS = 28 * 24 * 60 * 60 * 1000
const EXAM_DURATION_MS = 4 * 60 * 60 * 1000

type ImageShape = {
  link?: string | null
  versions?: { small?: string | null; medium?: string | null }
}

export type FortyTwoUser = {
  id: number
  login: string
  displayname?: string
  usual_full_name?: string
  first_name?: string
  last_name?: string
  kind?: string
  image?: ImageShape
  'active?'?: boolean
  'alumni?'?: boolean
  'staff?'?: boolean
  campus?: Array<{ id: number; name: string; city?: string; display_name?: string }>
  campus_users?: Array<{ campus_id: number; is_primary: boolean }>
  cursus_users?: Array<{
    campus_id?: number
    begin_at?: string
    end_at?: string | null
    cursus_id?: number
    cursus?: { id: number; slug?: string; name?: string }
  }>
}

type Campus = {
  id: number
  name: string
  display_name?: string
  city?: string
}

type Cursus = { id: number; slug?: string; name?: string; kind?: string }

type CursusUser = {
  id: number
  begin_at: string
  end_at: string | null
  user: { id: number; login: string; url?: string }
}

type FortyTwoExam = {
  id: number
  name: string
  begin_at: string
  end_at?: string | null
  project?: { id: number; name?: string }
  projects?: Array<{ id: number; name?: string }>
}

type FortyTwoProject = {
  id: number
  name: string
  slug?: string
}

type ProjectUser = {
  id: number
  final_mark: number | null
  status?: string
  'validated?'?: boolean | null
  updated_at?: string
  user: { id: number; login: string }
}

export type LivePooler = {
  intraUserId: number
  login: string
  displayName: string
  avatarUrl: string
}

export type LiveExam = {
  code: ExamCode
  externalExamId: number | null
  externalProjectId: number | null
  lockAt: Date
  endsAt: Date
}

export type LivePoolSnapshot = {
  externalRef: string
  campusId: number
  cursusId: number
  startsAt: Date
  endsAt: Date
  poolers: LivePooler[]
  exams: LiveExam[]
}

export type LiveResult = {
  validated: boolean
  score: number | null
}

export class FortyTwoUnavailableError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'FortyTwoUnavailableError'
    this.status = status
  }
}

function displayName(user: FortyTwoUser | LivePooler) {
  if ('usual_full_name' in user && user.usual_full_name) return user.usual_full_name
  if ('displayname' in user && user.displayname) return user.displayname
  if ('first_name' in user) {
    const name = [user.first_name, user.last_name].filter(Boolean).join(' ')
    if (name) return name
  }
  return user.login
}

function avatarUrl(user: FortyTwoUser) {
  return user.image?.versions?.small ?? user.image?.versions?.medium ?? user.image?.link ?? ''
}

function examCodeFromName(name: string): ExamCode | null {
  const normalized = name.toLowerCase().replace(/[^a-z0-9]+/g, ' ')
  if (/\bfinal\s+exam\b/.test(normalized)) return '03'
  for (const code of EXAM_CODES) {
    const numeric = String(Number(code))
    const pattern = new RegExp(`\\bexam\\s*(?:${code}|${numeric})\\b`)
    if (pattern.test(normalized)) return code
  }
  return null
}

function partsInZone(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  })
  return Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<'year' | 'month' | 'day' | 'hour' | 'minute' | 'second', number>
}

function zonedDateTimeToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  timeZone: string
) {
  const target = Date.UTC(year, month - 1, day, hour, 0, 0)
  let candidate = new Date(target)
  for (let index = 0; index < 3; index += 1) {
    const parts = partsInZone(candidate, timeZone)
    const represented = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second
    )
    candidate = new Date(candidate.getTime() + (target - represented))
  }
  return candidate
}

function fallbackExamDates(poolStart: Date): LiveExam[] {
  const local = partsInZone(poolStart, 'Africa/Casablanca')
  const cursor = new Date(Date.UTC(local.year, local.month - 1, local.day))
  while (cursor.getUTCDay() !== 5) cursor.setUTCDate(cursor.getUTCDate() + 1)

  return EXAM_CODES.map((code, index) => {
    const date = new Date(cursor)
    date.setUTCDate(date.getUTCDate() + index * 7)
    const lockAt = zonedDateTimeToUtc(
      date.getUTCFullYear(),
      date.getUTCMonth() + 1,
      date.getUTCDate(),
      9,
      'Africa/Casablanca'
    )
    return {
      code,
      externalExamId: null,
      externalProjectId: null,
      lockAt,
      endsAt: new Date(lockAt.getTime() + EXAM_DURATION_MS),
    }
  })
}

export function selectActiveCohort(rows: CursusUser[], now: Date) {
  const groups = new Map<string, CursusUser[]>()
  for (const row of rows) {
    const key = row.begin_at.slice(0, 10)
    const group = groups.get(key) ?? []
    group.push(row)
    groups.set(key, group)
  }

  const candidates = [...groups.entries()].map(([key, users]) => {
    const startsAt = new Date(Math.min(...users.map((user) => new Date(user.begin_at).getTime())))
    // Piscine cursus_users frequently keep end_at null long after the pool.
    // Cohort timing is therefore derived from the standard four-week race.
    const endsAt = new Date(startsAt.getTime() + PISCINE_DURATION_MS)
    const active = startsAt <= now && endsAt >= now
    return { key, users, startsAt, endsAt, active }
  })

  return candidates
    .filter((candidate) => candidate.active)
    .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime())[0]
}

type EligibilityPolicy = {
  allowedCampusIds: ReadonlySet<number>
  allowedKinds: ReadonlySet<UserKind>
  allowPoolers: boolean
}

function userKind(user: FortyTwoUser): UserKind | null {
  if (user['staff?'] || user.kind === 'staff') return 'staff'
  if (user['alumni?']) return 'alumni'

  const activeCore = user.cursus_users?.some((entry) => {
    const slug = entry.cursus?.slug?.toLowerCase()
    const name = entry.cursus?.name?.toLowerCase()
    return (slug === '42' || name === '42') && !entry.end_at
  })
  return user['active?'] !== false && activeCore ? 'student' : null
}

export function isEligibleUser(
  user: FortyTwoUser,
  policy: EligibilityPolicy,
  activePoolerIds: ReadonlySet<number>
) {
  const primaryCampus = user.campus_users?.find((entry) => entry.is_primary)
  const kind = userKind(user)

  if (!primaryCampus || !policy.allowedCampusIds.has(primaryCampus.campus_id)) {
    return { eligible: false, reason: 'INELIGIBLE_CAMPUS' } as const
  }
  if (kind === 'staff' && !policy.allowedKinds.has(kind)) {
    return { eligible: false, reason: 'STAFF_ACCESS_DENIED' } as const
  }
  if (!kind || !policy.allowedKinds.has(kind)) {
    return { eligible: false, reason: 'INELIGIBLE_STUDENT' } as const
  }
  if (!policy.allowPoolers && activePoolerIds.has(user.id)) {
    return { eligible: false, reason: 'POOLER_ACCESS_DENIED' } as const
  }
  return { eligible: true, reason: null } as const
}

export class FortyTwoClient {
  private appToken: { value: string; expiresAt: number } | null = null
  private poolCache: { value: LivePoolSnapshot; expiresAt: number } | null = null
  private readonly env: Env

  constructor(env: Env = getEnv()) {
    this.env = env
  }

  private async token(params: URLSearchParams) {
    const response = await fetch(`${API_ORIGIN}/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params,
      signal: AbortSignal.timeout(15_000),
    })
    if (!response.ok) {
      throw new FortyTwoUnavailableError('42 token exchange failed', response.status)
    }
    return (await response.json()) as {
      access_token: string
      expires_in?: number
    }
  }

  async exchangeAuthorizationCode(code: string) {
    return this.token(
      new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.env.clientId,
        client_secret: this.env.clientSecret,
        code,
        redirect_uri: this.env.redirectUri,
      })
    )
  }

  private async getAppToken() {
    if (this.appToken && this.appToken.expiresAt > Date.now() + 60_000) {
      return this.appToken.value
    }
    const token = await this.token(
      new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: this.env.clientId,
        client_secret: this.env.clientSecret,
      })
    )
    this.appToken = {
      value: token.access_token,
      expiresAt: Date.now() + (token.expires_in ?? 7_200) * 1_000,
    }
    return token.access_token
  }

  private async request<T>(path: string, accessToken?: string, attempt = 0): Promise<T> {
    const token = accessToken ?? (await this.getAppToken())
    const response = await fetch(`${API_ORIGIN}${path}`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(20_000),
    })
    if (response.status === 429 && attempt < 3) {
      const retryAfter = Number(response.headers.get('retry-after'))
      const delay = Number.isFinite(retryAfter)
        ? Math.min(5_000, Math.max(500, retryAfter * 1_000))
        : Math.min(5_000, 1_000 * (attempt + 1))
      await new Promise((resolve) => setTimeout(resolve, delay))
      return this.request<T>(path, token, attempt + 1)
    }
    if (!response.ok) {
      throw new FortyTwoUnavailableError(`42 request failed: ${path}`, response.status)
    }
    return (await response.json()) as T
  }

  private async paginate<T>(path: string) {
    const rows: T[] = []
    for (let page = 1; page <= 20; page += 1) {
      const separator = path.includes('?') ? '&' : '?'
      const batch = await this.request<T[]>(
        `${path}${separator}page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`
      )
      rows.push(...batch)
      if (batch.length < PAGE_SIZE) break
    }
    return rows
  }

  private async recentCursusUsers(path: string, now: Date) {
    const rows: CursusUser[] = []
    const cutoff = now.getTime() - PISCINE_DURATION_MS
    for (let page = 1; page <= 20; page += 1) {
      const separator = path.includes('?') ? '&' : '?'
      const batch = await this.request<CursusUser[]>(
        `${path}${separator}page%5Bnumber%5D=${page}&page%5Bsize%5D=${PAGE_SIZE}`
      )
      rows.push(...batch)
      if (batch.length < PAGE_SIZE) break
      const oldest = batch.at(-1)
      if (oldest && new Date(oldest.begin_at).getTime() < cutoff) break
    }
    return rows
  }

  async getMe(accessToken: string) {
    return this.request<FortyTwoUser>('/v2/me', accessToken)
  }

  async getUser(intraUserId: number) {
    return this.request<FortyTwoUser>(`/v2/users/${intraUserId}`)
  }

  async getUsers(intraUserIds: number[]) {
    const uniqueIds = [...new Set(intraUserIds)]
    if (uniqueIds.length === 0) return []
    const chunks: number[][] = []
    for (let index = 0; index < uniqueIds.length; index += 100) {
      chunks.push(uniqueIds.slice(index, index + 100))
    }
    const batches = await Promise.all(
      chunks.map((chunk) =>
        this.request<FortyTwoUser[]>(
          `/v2/users?filter%5Bid%5D=${chunk.join(',')}&page%5Bsize%5D=100`
        )
      )
    )
    return batches.flat()
  }

  async getCurrentPool(): Promise<LivePoolSnapshot> {
    if (this.poolCache && this.poolCache.expiresAt > Date.now()) {
      return this.poolCache.value
    }
    const now = new Date()
    const campuses = await this.paginate<Campus>('/v2/campus')
    const campusId =
      this.env.campusId ??
      campuses.find((campus) => {
        const haystack = `${campus.name} ${campus.display_name ?? ''} ${campus.city ?? ''}`.toLowerCase()
        return haystack.includes('tetouan') || haystack.includes('tétouan') || haystack.includes('1337 med')
      })?.id
    if (!campusId) throw new FortyTwoUnavailableError('Tetouan campus was not found')

    const cursus = await this.paginate<Cursus>('/v2/cursus')
    const piscine = cursus.find((item) => {
      const slug = item.slug?.toLowerCase()
      const name = item.name?.toLowerCase()
      return (
        item.kind === 'piscine' &&
        (slug === 'c-piscine' || name === 'c piscine')
      )
    }) ?? cursus.find((item) => item.slug?.toLowerCase() === 'piscine-c')
    if (!piscine) throw new FortyTwoUnavailableError('Piscine C cursus was not found')

    const cursusUsers = await this.recentCursusUsers(
      `/v2/cursus/${piscine.id}/cursus_users?filter%5Bcampus_id%5D=${campusId}&sort=-begin_at`,
      now
    )
    const cohort = selectActiveCohort(cursusUsers, now)
    if (!cohort) throw new FortyTwoUnavailableError('No active Tetouan Piscine C cohort was found')

    let detailedUsers: FortyTwoUser[]
    try {
      detailedUsers = await this.getUsers(cohort.users.map((row) => row.user.id))
    } catch {
      detailedUsers = []
    }
    const detailById = new Map(detailedUsers.map((user) => [user.id, user]))
    const poolers = cohort.users.map((row) => {
      const detail = detailById.get(row.user.id)
      return {
        intraUserId: row.user.id,
        login: detail?.login ?? row.user.login,
        displayName: detail ? displayName(detail) : row.user.login,
        avatarUrl: detail ? avatarUrl(detail) : '',
      }
    })

    let officialExams: FortyTwoExam[] = []
    let projects: FortyTwoProject[] = []
    const examRange = [
      new Date(cohort.startsAt.getTime() - 24 * 60 * 60 * 1_000).toISOString(),
      new Date(cohort.endsAt.getTime() + 24 * 60 * 60 * 1_000).toISOString(),
    ].join(',')
    try {
      const rows = await this.paginate<FortyTwoExam>(
        `/v2/campus/${campusId}/cursus/${piscine.id}/exams?sort=begin_at&range%5Bbegin_at%5D=${encodeURIComponent(examRange)}`
      )
      officialExams = [...new Map(rows.map((exam) => [exam.id, exam])).values()]
    } catch {
      officialExams = []
    }
    try {
      projects = await this.paginate<FortyTwoProject>(
        `/v2/cursus/${piscine.id}/projects?sort=-id`
      )
    } catch {
      projects = []
    }

    const fallback = fallbackExamDates(cohort.startsAt)
    const exams = EXAM_CODES.map((code, index) => {
      const official = officialExams.find((exam) => {
        const examCode =
          examCodeFromName(exam.name) ??
          exam.projects?.map((project) => examCodeFromName(project.name ?? '')).find(Boolean) ??
          null
        const beginsAt = new Date(exam.begin_at)
        return (
          examCode === code &&
          beginsAt >= new Date(cohort.startsAt.getTime() - 24 * 60 * 60 * 1000) &&
          beginsAt <= new Date(cohort.endsAt.getTime() + 24 * 60 * 60 * 1000)
        )
      })
      const project = projects.find((item) => examCodeFromName(item.name) === code)
      const officialProject = official?.projects?.find(
        (item) => examCodeFromName(item.name ?? '') === code
      )
      const externalProjectId = official?.project?.id ?? officialProject?.id ?? project?.id ?? null
      if (!official) return { ...fallback[index], externalProjectId }
      const lockAt = new Date(official.begin_at)
      return {
        code,
        externalExamId: official.id,
        externalProjectId,
        lockAt,
        endsAt: official.end_at
          ? new Date(official.end_at)
          : new Date(lockAt.getTime() + EXAM_DURATION_MS),
      }
    })

    const snapshot = {
      externalRef: `piscine-c:${campusId}:${cohort.key}`,
      campusId,
      cursusId: piscine.id,
      startsAt: cohort.startsAt,
      endsAt: cohort.endsAt,
      poolers,
      exams,
    }
    this.poolCache = { value: snapshot, expiresAt: Date.now() + 60_000 }
    return snapshot
  }

  async getExamResults(snapshot: LivePoolSnapshot, exam: LiveExam) {
    if (!exam.externalProjectId) return new Map<number, LiveResult>()
    const rows = await this.paginate<ProjectUser>(
      `/v2/projects/${exam.externalProjectId}/projects_users?filter%5Bcampus%5D=${snapshot.campusId}`
    )
    const roster = new Set(snapshot.poolers.map((pooler) => pooler.intraUserId))
    const results = new Map<number, LiveResult>()
    for (const row of rows) {
      if (!roster.has(row.user.id)) continue
      const explicitlySettled = typeof row['validated?'] === 'boolean'
      if (row.final_mark === null && !explicitlySettled) continue
      results.set(row.user.id, {
        validated: row['validated?'] ?? (row.final_mark ?? 0) >= 50,
        score: row.final_mark,
      })
    }
    return results
  }
}

export function toPublicUser(user: FortyTwoUser) {
  return {
    intraUserId: user.id,
    login: user.login,
    displayName: displayName(user),
    avatarUrl: avatarUrl(user),
    campus: user.campus?.find((campus) =>
      user.campus_users?.some((entry) => entry.is_primary && entry.campus_id === campus.id)
    )?.name ?? '1337 MED',
  }
}
