// Program-wide changes made by program coaches (Program settings): teams, seasons, and moving or removing people.
// Each touches many documents, so writes go out in batches (Firestore allows 500 per batch; we stay under 400).
// Goals always stay with the student.
import {
  arrayUnion,
  doc,
  getDocs,
  query,
  serverTimestamp,
  where,
  writeBatch,
  type DocumentReference,
  type Firestore,
  type UpdateData,
} from 'firebase/firestore'
import { buildSprints } from '@/model/sprints'
import { slugify } from '@/model/slug'
import type { Member, Season, Subteam, Task, Team } from '@/model/types'
import type { Refs } from './refs'

type Write =
  | { kind: 'set'; ref: DocumentReference; data: object }
  | { kind: 'update'; ref: DocumentReference; data: object }
  | { kind: 'delete'; ref: DocumentReference }

async function commitAll(db: Firestore, writes: Write[]) {
  for (let i = 0; i < writes.length; i += 400) {
    const batch = writeBatch(db)
    writes.slice(i, i + 400).forEach((write) => {
      if (write.kind === 'set') batch.set(write.ref, write.data)
      else if (write.kind === 'update') batch.update(write.ref, write.data as UpdateData<object>)
      else batch.delete(write.ref)
    })
    await batch.commit()
  }
}

export interface NewTeam {
  name: string
  number: string
  color: string
  sprintDays: number
}

export function createAdmin(refs: Refs, currentUid: () => string) {
  const db = refs.program().firestore

  /** Sprint docs for a team in a season, from `start` to the season's end. */
  function sprintWrites(
    teamId: string,
    season: Season & { id: string },
    start: string,
    sprintDays: number,
  ): Write[] {
    return buildSprints(start, season.end, sprintDays).map((sprint) => ({
      kind: 'set' as const,
      ref: refs.sprint(teamId, `${season.id}-s${sprint.index + 1}`),
      data: { ...sprint, seasonId: season.id, objectives: [] },
    }))
  }

  /** People who are on a team's tasks: take them off (tasks and subtasks). */
  async function unassignWrites(teamId: string, uid: string): Promise<Write[]> {
    const snap = await getDocs(
      query(refs.tasks(teamId), where('assigneeIds', 'array-contains', uid)),
    )
    return snap.docs.map((d) => {
      const task = d.data()
      return {
        kind: 'update' as const,
        ref: refs.task(teamId, task.id),
        data: {
          assigneeIds: task.assigneeIds.filter((id) => id !== uid),
          subtasks: task.subtasks.map((s) => ({
            ...s,
            assigneeIds: s.assigneeIds.filter((id) => id !== uid),
          })),
          updatedAt: serverTimestamp(),
        },
      }
    })
  }

  return {
    /** A new team in the current season: Sprint 1 starts today, subteams copied from the program's defaults. */
    async createTeam(
      fields: NewTeam,
      season: Season & { id: string },
      subteamDefaults: Subteam[],
      today: string,
    ) {
      let id = slugify(fields.name) || 'team'
      const taken = new Set((await getDocs(refs.teams())).docs.map((d) => d.id))
      while (taken.has(id)) id = `${id}-${fields.number}`
      const team: Team & { id: string } = {
        id,
        ...fields,
        seasonIds: [season.id],
        subteams: subteamDefaults.map((s) => ({ ...s })),
        github: { repo: null, importIssues: true, closeOnDone: true },
        createdAt: serverTimestamp() as never,
      }
      await commitAll(db, [
        { kind: 'set', ref: refs.team(id), data: team },
        ...sprintWrites(id, season, today, fields.sprintDays),
      ])
      return id
    },

    /** Brings a team from an earlier season into this one (Sprint 1 starts today). */
    async addTeamToSeason(
      team: Team & { id: string },
      season: Season & { id: string },
      today: string,
    ) {
      await commitAll(db, [
        { kind: 'update', ref: refs.team(team.id), data: { seasonIds: arrayUnion(season.id) } },
        ...sprintWrites(team.id, season, today, team.sprintDays),
      ])
    },

    /**
     * Deletes a team: its tasks (with comments), sprints, events, and Team Home. Its people stay in the program with
     * no team; students keep their goals. Tasks are archived first, since only archived tasks can be deleted.
     */
    async deleteTeam(teamId: string, members: readonly (Member & { id: string })[]) {
      const tasks = (await getDocs(refs.tasks(teamId))).docs.map((d) => d.data())
      await commitAll(
        db,
        tasks
          .filter((task) => !task.archived)
          .map((task) => ({
            kind: 'update' as const,
            ref: refs.task(teamId, task.id),
            data: { archived: { by: currentUid(), at: serverTimestamp(), from: 'Team deleted' } },
          })),
      )
      const writes: Write[] = []
      for (const task of tasks) {
        const comments = await getDocs(refs.comments(teamId, task.id))
        comments.docs.forEach((c) => writes.push({ kind: 'delete', ref: c.ref }))
        writes.push({ kind: 'delete', ref: refs.task(teamId, task.id) })
      }
      ;(await getDocs(refs.sprints(teamId))).docs.forEach((d) =>
        writes.push({ kind: 'delete', ref: d.ref }),
      )
      ;(await getDocs(refs.teamEvents(teamId))).docs.forEach((d) =>
        writes.push({ kind: 'delete', ref: d.ref }),
      )
      writes.push({ kind: 'delete', ref: refs.homePage(teamId) })
      members
        .filter((m) => m.teamIds.includes(teamId))
        .forEach((m) => {
          const subteams = { ...m.subteams }
          delete subteams[teamId]
          writes.push({
            kind: 'update',
            ref: refs.member(m.id),
            data: { teamIds: m.teamIds.filter((id) => id !== teamId), subteams },
          })
        })
      ;(
        await getDocs(query(refs.invites(), where('teamIds', 'array-contains', teamId)))
      ).docs.forEach((d) =>
        writes.push({
          kind: 'update',
          ref: d.ref,
          data: { teamIds: d.data().teamIds.filter((id) => id !== teamId) },
        }),
      )
      writes.push({ kind: 'delete', ref: refs.team(teamId) })
      await commitAll(db, writes)
    },

    /** Changes someone's teams, taking them off the tasks of teams they leave. */
    async setTeams(member: Member & { id: string }, teamIds: string[]) {
      const leaving = member.teamIds.filter((id) => !teamIds.includes(id))
      const subteams = Object.fromEntries(
        Object.entries(member.subteams).filter(([id]) => teamIds.includes(id)),
      )
      const writes: Write[] = [
        { kind: 'update', ref: refs.member(member.id), data: { teamIds, subteams } },
      ]
      for (const teamId of leaving) writes.push(...(await unassignWrites(teamId, member.id)))
      await commitAll(db, writes)
    },

    /** Removes someone from the program (off their tasks first). Their goals follow your retention rules. */
    async removeFromProgram(member: Member & { id: string }) {
      const writes: Write[] = []
      for (const teamId of member.teamIds) writes.push(...(await unassignWrites(teamId, member.id)))
      writes.push({ kind: 'delete', ref: refs.member(member.id) })
      await commitAll(db, writes)
    },

    /**
     * Starts a new season: the season doc (ending the old one the day before if they overlap), the program's current
     * season, carried-over teams with new sprints from the season's first day, people kept / moved to No team /
     * removed, and unfinished tasks moved to each team's Backlog or archived.
     */
    async startSeason(plan: {
      season: { name: string; start: string; end: string }
      old: Season & { id: string }
      carried: (Team & { id: string })[]
      people: { member: Member & { id: string }; choice: 'stay' | 'none' | 'remove' }[]
      tasks: 'backlog' | 'archive'
    }) {
      let id = slugify(plan.season.name.replace(/[–—]/g, '-')) || plan.season.start.slice(0, 4)
      if (id === plan.old.id) id = `${id}-2`
      const season = { id, ...plan.season }
      const writes: Write[] = [
        { kind: 'set', ref: doc(refs.seasons(), id), data: season },
        { kind: 'update', ref: refs.program(), data: { currentSeasonId: id } },
      ]
      if (plan.old.end >= plan.season.start) {
        const end = new Date(`${plan.season.start}T00:00:00Z`)
        end.setUTCDate(end.getUTCDate() - 1)
        writes.push({
          kind: 'update',
          ref: doc(refs.seasons(), plan.old.id),
          data: { end: end.toISOString().slice(0, 10) },
        })
      }
      // People first, while their teams are still known.
      for (const { member, choice } of plan.people) {
        if (choice === 'remove') {
          for (const teamId of member.teamIds)
            writes.push(...(await unassignWrites(teamId, member.id)))
          writes.push({ kind: 'delete', ref: refs.member(member.id) })
        } else if (choice === 'none' && member.teamIds.length) {
          for (const teamId of member.teamIds)
            writes.push(...(await unassignWrites(teamId, member.id)))
          writes.push({
            kind: 'update',
            ref: refs.member(member.id),
            data: { teamIds: [], subteams: {} },
          })
        }
      }
      for (const team of plan.carried) {
        writes.push({
          kind: 'update',
          ref: refs.team(team.id),
          data: { seasonIds: arrayUnion(id) },
        })
        writes.push(...sprintWrites(team.id, season, plan.season.start, team.sprintDays))
        const tasks = (
          await getDocs(query(refs.tasks(team.id), where('archived', '==', null)))
        ).docs.map((d) => d.data() as Task & { id: string })
        tasks
          .filter((task) => task.status !== 'Done' && task.sprintId !== null)
          .forEach((task) =>
            writes.push({
              kind: 'update',
              ref: refs.task(team.id, task.id),
              data:
                plan.tasks === 'backlog'
                  ? { sprintId: null, updatedAt: serverTimestamp() }
                  : {
                      archived: {
                        by: currentUid(),
                        at: serverTimestamp(),
                        from: `${plan.old.name} season`,
                      },
                      updatedAt: serverTimestamp(),
                    },
            }),
          )
      }
      await commitAll(db, writes)
      return id
    },
  }
}

export type Admin = ReturnType<typeof createAdmin>
