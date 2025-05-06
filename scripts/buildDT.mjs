import Logger from '@novice1/logger'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path'

async function buildDT() {
    Logger.info('scripts/buildDT')

    const destFilePath = `${dirname(fileURLToPath(import.meta.url))}/../index.d.ts`

    Logger.info(`destination = ${destFilePath}`)

    let content = await fs.promises.readFile(destFilePath, { encoding: 'utf-8' })

    content = `import './types/overrides.d.ts'
` + content

    await fs.promises.writeFile(destFilePath, content, { encoding: 'utf-8' })

    Logger.info('Done')
}

buildDT()