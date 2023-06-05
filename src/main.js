import dotenv from 'dotenv'
import { setInterval } from 'node:timers'
import { buildLogger } from './log.js'
import { buildImapClient } from './utils.js'
import MailProcessor from './processor.js'
import BillingParser from './parser.js'
import * as fs from 'node:fs'
import { access } from 'node:fs/promises'

const env_path = process.env.ENV_PATH

if (!env_path) {
    throw new Error('ENV_PATH not found')
}

access(env_path, fs.constants.R_OK).catch((e) => {
    console.error(e)
    process.exit(1)
})

const { parsed, error } = dotenv.config({ path: env_path })

if (error) {
    throw error
}

const interval = 10 * 60 * 1000

const main = async () => {
    const log = await buildLogger()

    try {
        console.log('Daemon started')

        const client = buildImapClient()
        await client.connect()

        let lock = await client.getMailboxLock('INBOX').catch((e) => {
            console.error(e)
            log.error('Mailbox does not exist')
            process.exit(1)
        })

        if (!lock) {
            console.error('Lock not acquired')
            log.error('Lock not acquired')
            return
        }

        const billingParser = new BillingParser(log)
        const mailProcessor = new MailProcessor(client, lock, log, billingParser)

        mailProcessor.processMessages()

        setInterval(() => {
            log.info('Interval tick')
            mailProcessor.processMessages()
        }, interval)
    } catch (e) {
        console.error(e)
        if (e instanceof Error) {
            log.error(e.message)
        }
    }
}

main()
