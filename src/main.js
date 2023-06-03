import dotenv from 'dotenv'
import { setInterval } from 'node:timers'
import { buildLogger } from './log.js'
import { buildImapClient } from './utils.js'
import MailProcessor from './processor.js'
import BillingParser from './parser.js'

dotenv.config()

const interval = 10 * 60 * 1000

const main = async () => {
    const log = await buildLogger()

    try {
        const client = buildImapClient()
        await client.connect()

        let lock = await client.getMailboxLock('INBOX').catch((e) => {
            log.error('Mailbox does not exist')
            process.exit(1)
        })

        if (!lock) {
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
