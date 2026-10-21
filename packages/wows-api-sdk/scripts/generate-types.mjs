// Generates TypeScript response types from a cleaned API reference JSON snapshot.
// Set WG_API_DOC_PATH to override the default local snapshot location.

import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
const documentPath =
  process.env.WG_API_DOC_PATH ??
  join(rootDir, '..', '..', 'tools', 'wg-wows-api-doc-clean', 'data', 'api.json')
const outDir = join(rootDir, 'src', 'official', 'types', 'generated')

const documents = [
  { id: 'account_achievements', root: 'AccountAchievements', out: 'account' },
  { id: 'account_info', root: 'AccountInfo', out: 'account' },
  { id: 'account_list', root: 'AccountListEntry', out: 'account' },
  { id: 'clans_accountinfo', root: 'ClanAccountInfo', out: 'clans' },
  { id: 'clans_glossary', root: 'ClansGlossary', out: 'clans' },
  { id: 'clans_info', root: 'ClanInfo', out: 'clans' },
  { id: 'clans_list', root: 'ClanListEntry', out: 'clans' },
  { id: 'clans_season', root: 'ClanSeason', out: 'clans' },
  { id: 'clans_seasonstats', root: 'ClanSeasonStats', out: 'clans' },
  { id: 'encyclopedia_accountlevels', root: 'AccountLevel', out: 'encyclopedia' },
  { id: 'encyclopedia_achievements', root: 'EncyclopediaAchievement', out: 'encyclopedia' },
  { id: 'encyclopedia_battlearenas', root: 'BattleArena', out: 'encyclopedia' },
  { id: 'encyclopedia_battletypes', root: 'BattleType', out: 'encyclopedia' },
  { id: 'encyclopedia_collectioncards', root: 'CollectionCard', out: 'encyclopedia' },
  { id: 'encyclopedia_collections', root: 'Collection', out: 'encyclopedia' },
  { id: 'encyclopedia_consumables', root: 'Consumable', out: 'encyclopedia' },
  { id: 'encyclopedia_crewranks', root: 'CrewRank', out: 'encyclopedia' },
  { id: 'encyclopedia_crewskills', root: 'CrewSkill', out: 'encyclopedia' },
  { id: 'encyclopedia_info', root: 'EncyclopediaInfo', out: 'encyclopedia' },
  { id: 'encyclopedia_modules', root: 'Module', out: 'encyclopedia' },
  { id: 'encyclopedia_shipprofile', root: 'ShipProfile', out: 'encyclopedia' },
  { id: 'encyclopedia_ships', root: 'EncyclopediaShip', out: 'encyclopedia' },
  { id: 'seasons_acocuntinfo', root: 'SeasonAccountInfo', out: 'seasons' },
  { id: 'seasons_info', root: 'RankedSeason', out: 'seasons' },
  { id: 'seasons_ship_stats', root: 'SeasonShipStats', out: 'seasons' },
  { id: 'ships_badges', root: 'ShipBadge', out: 'ships' },
  { id: 'ships_stats', root: 'ShipStats', out: 'ships' },
]

// Containers the documentation renders as nested tables but that the API returns as arrays.
// Verified against live responses; everything else is an object keyed by id/name.
const arrayContainers = new Set([
  'clans_season:leagues',
  'clans_seasonstats:seasons',
  'encyclopedia_crewskills:customization.perks',
])

// Containers the API returns as objects keyed by id, name, or ship type.
// The value type is the interface generated for that container's children.
const recordContainers = new Set([
  'clans_glossary:building_types',
  'clans_glossary:buildings',
  'clans_info:members',
  'encyclopedia_achievements:battle',
  'encyclopedia_crewskills:customization',
  'encyclopedia_shipprofile:anti_aircraft.slots',
  'encyclopedia_shipprofile:artillery.slots',
  'encyclopedia_shipprofile:atbas.slots',
  'encyclopedia_shipprofile:torpedoes.slots',
  'encyclopedia_ships:default_profile.anti_aircraft.slots',
  'encyclopedia_ships:default_profile.artillery.slots',
  'encyclopedia_ships:default_profile.atbas.slots',
  'encyclopedia_ships:default_profile.torpedoes.slots',
  'seasons_info:leagues',
  'seasons_info:leagues.ranks',
])

const associativeOverrides = new Map([
  ['account_achievements:battle', 'Record<string, unknown>'],
  ['account_achievements:progress', 'Record<string, unknown>'],
  ['account_info:private.grouped_contacts.groups', 'Record<string, string>'],
  ['account_info:statistics.oper_div.wins_by_tasks', 'Record<string, number>'],
  ['account_info:statistics.oper_div_hard.wins_by_tasks', 'Record<string, number>'],
  ['account_info:statistics.oper_solo.wins_by_tasks', 'Record<string, number>'],
  ['clans_glossary:clans_roles', 'Record<string, string>'],
  ['encyclopedia_crewranks:names', 'Record<string, string>'],
  ['encyclopedia_info:languages', 'Record<string, string>'],
  ['encyclopedia_info:ship_modifications', 'Record<string, string>'],
  ['encyclopedia_info:ship_modules', 'Record<string, string>'],
  ['encyclopedia_info:ship_nations', 'Record<string, string>'],
  ['encyclopedia_info:ship_types', 'Record<string, string>'],
  ['encyclopedia_ships:next_ships', 'Record<string, number>'],
  ['seasons_acocuntinfo:rank_info', 'Record<string, unknown>'],
  ['seasons_acocuntinfo:seasons', 'Record<string, unknown>'],
  ['seasons_ship_stats:seasons', 'Record<string, unknown>'],
  ['ships_stats:oper_div.wins_by_tasks', 'Record<string, number>'],
  ['ships_stats:oper_div_hard.wins_by_tasks', 'Record<string, number>'],
  ['ships_stats:oper_solo.wins_by_tasks', 'Record<string, number>'],
])

const primitiveTypes = new Map([
  ['numeric', 'number'],
  ['timestamp', 'number'],
  ['float', 'number'],
  ['string', 'string'],
  ['boolean', 'boolean'],
  ['list of integers', 'number[]'],
  ['list of strings', 'string[]'],
  ['list of dicts', 'Array<Record<string, string>>'],
])

function pascalCase(segment) {
  return segment
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

function createTree(rootName, fields) {
  const root = { path: '', name: rootName, type: '', children: new Map() }

  for (const field of fields) {
    const segments = field.path.split('.')
    let node = root
    for (const [index, segment] of segments.entries()) {
      const path = segments.slice(0, index + 1).join('.')
      let child = node.children.get(segment)
      if (!child) {
        child = {
          path,
          name: `${rootName}${path.split('.').map(pascalCase).join('')}`,
          children: new Map(),
        }
        node.children.set(segment, child)
      }
      if (index === segments.length - 1) {
        child.type = field.type
        child.description = field.description
      }
      node = child
    }
  }

  return root
}

function renderType(id, node) {
  if (node.children.size > 0) {
    const key = `${id}:${node.path}`
    if (arrayContainers.has(key)) return `Array<${node.name}>`
    if (recordContainers.has(key)) return `Record<string, ${node.name}>`
    return node.name
  }
  if (node.type === 'associative array') {
    return associativeOverrides.get(`${id}:${node.path}`) ?? 'Record<string, unknown>'
  }
  return primitiveTypes.get(node.type) ?? 'unknown'
}

function renderEndpoint(document, endpoint) {
  const root = createTree(document.root, endpoint.response)
  const interfaces = []

  function emit(node) {
    const fields = [...node.children.values()].map((child) => {
      const type = renderType(document.id, child)
      return `  ${child.path.split('.').at(-1)}?: ${type}`
    })
    interfaces.push(`export interface ${node.name} {\n${fields.join('\n')}\n}`)
    for (const child of node.children.values()) {
      if (child.children.size > 0) emit(child)
    }
  }

  emit(root)
  return interfaces.join('\n\n')
}

const document = JSON.parse(await readFile(documentPath, 'utf8'))
const endpoints = new Map(document.endpoints.map((endpoint) => [endpoint.id, endpoint]))
const outputs = new Map()

for (const entry of documents) {
  const endpoint = endpoints.get(entry.id)
  if (!endpoint || endpoint.response.length === 0) {
    console.warn(`No response fields found for ${entry.id}, skipping`)
    continue
  }
  outputs.set(entry.out, `${outputs.get(entry.out) ?? ''}${renderEndpoint(entry, endpoint)}\n\n`)
}

await mkdir(outDir, { recursive: true })
for (const [name, source] of outputs) {
  const header = `// Generated by scripts/generate-types.mjs from wg-wows-api-doc-clean/data/api.json.\n// Do not edit this file manually.\n\n`
  await writeFile(join(outDir, `${name}.generated.ts`), header + source.trimEnd() + '\n')
  console.log(`Wrote src/types/generated/${name}.generated.ts`)
}
