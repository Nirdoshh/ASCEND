import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = resolve(import.meta.dirname, '../..')

function filesUnder(directory: string): string[] {
  const result: string[] = []
  for (const entry of readdirSync(directory)) {
    const path = resolve(directory, entry)
    if (statSync(path).isDirectory()) result.push(...filesUnder(path))
    else if (/\.(css|tsx?|html)$/.test(entry)) result.push(path)
  }
  return result
}

describe('design token references', () => {
  it('only references CSS custom properties declared by the token file', () => {
    const tokenFile = readFileSync(resolve(root, 'src/styles/tokens.css'), 'utf8')
    const declared = new Set<string>()
    for (const match of tokenFile.matchAll(/(--[a-z0-9-]+)\s*:/gi)) {
      const token = match[1]
      if (token) declared.add(token)
    }

    const references = new Map<string, string[]>()
    for (const file of filesUnder(resolve(root, 'src'))) {
      const source = readFileSync(file, 'utf8')
      for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) {
        const token = match[1]
        if (!token) continue
        const files = references.get(token) ?? []
        files.push(file)
        references.set(token, files)
      }
    }

    const undefinedTokens = [...references.keys()].filter((token) => !declared.has(token))
    expect(undefinedTokens, `Undefined tokens used in: ${JSON.stringify(Object.fromEntries(references))}`).toEqual([])
  })
})
