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

const { error } = dotenv.config({ path: env_path })

if (error) {
    console.log('No fue posible leer las variables de entorno')
    throw error
}

const interval = 10 * 60 * 1000

const main = async () => {
    const log = await buildLogger()

    try {
        console.log('Servicio iniciado')
        log.info('Servicio iniciado')

        const client = buildImapClient()
        await client.connect()

        let lock = await client.getMailboxLock('INBOX').catch((e) => {
            console.error(e)
            log.error('El buzón no existe')
            process.exit(1)
        })

        if (!lock) {
            console.error('No fue posible bloquear el acceso al buzón')
            log.error('No fue posible bloquear el acceso al buzón')
            process.exit(1)
        }

        const billingParser = new BillingParser(log)
        const mailProcessor = new MailProcessor(client, log, billingParser)

        mailProcessor
            .processMessages()
            .then(() => {
                log.info('Lectura terminada')
            })
            .catch((error) => {
                console.log('Error al procesar mensajes')
                log.error({ error }, error.message ?? 'Error al procesar mensajes')
            })

        setInterval(() => {
            log.info('Interval tick')

            mailProcessor
                .processMessages()
                .then(() => {
                    log.info('Lectura terminada')
                })
                .catch((error) => {
                    console.log('Error al procesar mensajes')
                    log.error({ error }, error.message ?? 'Error al procesar mensajes')
                })
        }, interval)
    } catch (e) {
        console.error(e)
        log.error({ error: e }, e.message ?? 'Error de cliente')
    }
}

main()
