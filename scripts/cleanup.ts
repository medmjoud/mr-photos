/** Daily maintenance (retention deletes, expired sessions). Schedule with cron:  npm run jobs:cleanup */
import { runDailyCleanup } from '../src/server/jobs/cleanup'

const result = await runDailyCleanup()
console.info('[cleanup]', result)
process.exit(0)
