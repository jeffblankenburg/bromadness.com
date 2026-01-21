// Script to download team logos from ESPN CDN
// Run with: npx tsx scripts/download-logos.ts

import { D1_TEAMS } from '../src/lib/data/d1-teams'
import * as fs from 'fs'
import * as path from 'path'
import * as https from 'https'

const LOGOS_DIR = path.join(process.cwd(), 'public', 'logos')

// Ensure logos directory exists
if (!fs.existsSync(LOGOS_DIR)) {
  fs.mkdirSync(LOGOS_DIR, { recursive: true })
  console.log('Created logos directory')
}

function downloadLogo(espnId: number, abbreviation: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = `https://a.espncdn.com/i/teamlogos/ncaa/500/${espnId}.png`
    const filename = `${abbreviation.toLowerCase()}.png`
    const filepath = path.join(LOGOS_DIR, filename)

    // Skip if already exists
    if (fs.existsSync(filepath)) {
      console.log(`Skipping ${abbreviation} - already exists`)
      resolve()
      return
    }

    const file = fs.createWriteStream(filepath)

    https.get(url, (response) => {
      if (response.statusCode === 200) {
        response.pipe(file)
        file.on('finish', () => {
          file.close()
          console.log(`Downloaded ${abbreviation}`)
          resolve()
        })
      } else {
        fs.unlink(filepath, () => {})
        console.log(`Failed ${abbreviation}: ${response.statusCode}`)
        resolve() // Don't reject, just continue
      }
    }).on('error', (err) => {
      fs.unlink(filepath, () => {})
      console.log(`Error ${abbreviation}: ${err.message}`)
      resolve() // Don't reject, just continue
    })
  })
}

async function main() {
  const teamsWithLogos = D1_TEAMS.filter(t => t.espnId)
  console.log(`Downloading ${teamsWithLogos.length} logos...\n`)

  // Download in batches to avoid overwhelming the server
  const batchSize = 10
  for (let i = 0; i < teamsWithLogos.length; i += batchSize) {
    const batch = teamsWithLogos.slice(i, i + batchSize)
    await Promise.all(
      batch.map(team => downloadLogo(team.espnId!, team.abbreviation))
    )
    // Small delay between batches
    if (i + batchSize < teamsWithLogos.length) {
      await new Promise(r => setTimeout(r, 500))
    }
  }

  console.log('\nDone!')
}

main().catch(console.error)
