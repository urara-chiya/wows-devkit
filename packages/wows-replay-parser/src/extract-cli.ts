#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { extractConstantsFromFile } from './extract/constants.js'
import type { BattleResultsMapping } from './types.js'

interface CliOptions {
  scriptsZip: string
  outDir: string
  previous?: string
  version?: string
  build?: number
  patch?: number
  noWrite: boolean
}

const args = process.argv.slice(2)
if (args.includes('--help') || args.includes('-h')) {
  printUsage()
  process.exit(0)
}

const options = parseArgs(args)
if (!options.scriptsZip) {
  console.error('missing --scripts-zip (or WOWS_SCRIPTS_ZIP)')
  printUsage()
  process.exit(1)
}

const previousMapping = options.previous ? readMapping(options.previous) : undefined
const result = extractConstantsFromFile(options.scriptsZip, {
  previousMapping,
  version: options.version,
  build: options.build,
  patch: options.patch,
  onProgress: (done, total) => {
    if (done === total) process.stderr.write(`\rdecrypted ${done}/${total} modules\n`)
  },
})

const serialized = `${JSON.stringify(result.mapping, null, 2)}\n`
if (!options.noWrite) {
  mkdirSync(options.outDir, { recursive: true })
  const versionedPath = resolve(options.outDir, `${result.mapping.version}.json`)
  const latestPath = resolve(options.outDir, 'latest.json')
  writeFileSync(versionedPath, serialized)
  writeFileSync(latestPath, serialized)
  console.log(`wrote ${versionedPath}`)
  console.log(`wrote ${latestPath}`)
}

console.log(`version ${result.mapping.version} (build ${result.mapping.build})`)
console.log(
  `commonResults=${result.commonResults.length} ` +
    `clientPublicResults=${result.clientPublicResults.length} ` +
    `interactionDetails=${result.clientVehInteractionDetails.length} ` +
    `ribbonTail=${result.ribbonTailSource}`,
)
for (const warning of result.warnings) console.warn(`warning: ${warning}`)

function parseArgs(argv: string[]): CliOptions {
  const defaultOut = fileURLToPath(new URL('../constants', import.meta.url))
  const options: CliOptions = {
    scriptsZip: process.env.WOWS_SCRIPTS_ZIP ?? '',
    outDir: defaultOut,
    noWrite: false,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    switch (arg) {
      case '--scripts-zip':
        options.scriptsZip = requireValue(argv, ++index, arg)
        break
      case '--out':
        options.outDir = resolve(requireValue(argv, ++index, arg))
        break
      case '--previous':
        options.previous = resolve(requireValue(argv, ++index, arg))
        break
      case '--version':
        options.version = requireValue(argv, ++index, arg)
        break
      case '--build':
        options.build = Number(requireValue(argv, ++index, arg))
        break
      case '--patch':
        options.patch = Number(requireValue(argv, ++index, arg))
        break
      case '--no-write':
        options.noWrite = true
        break
      default:
        throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.previous === undefined) {
    const candidate = resolve(options.outDir, 'latest.json')
    if (existsSync(candidate)) options.previous = candidate
  }

  return options
}

function requireValue(argv: string[], index: number, flag: string): string {
  const value = argv[index]
  if (!value) throw new Error(`${flag} requires a value`)
  return value
}

function readMapping(path: string): BattleResultsMapping {
  return JSON.parse(readFileSync(path, 'utf8')) as BattleResultsMapping
}

function printUsage(): void {
  const defaultOut = fileURLToPath(new URL('../constants', import.meta.url))
  console.log(
    [
      'usage: wows-scripts-constants --scripts-zip <scripts.zip> [options]',
      '',
      'options:',
      '  --out <dir>        output directory (default: ' + defaultOut + ')',
      '  --previous <file>  previous mapping used for the ribbon tail (default: <out>/latest.json)',
      '  --version <x.y>    override VERSION',
      '  --build <number>   override BUILD',
      '  --patch <number>   override PATCH',
      '  --no-write         extract and print a summary without writing files',
      '',
      'environment:',
      '  WOWS_SCRIPTS_ZIP   default path to scripts.zip',
    ].join('\n'),
  )
}
