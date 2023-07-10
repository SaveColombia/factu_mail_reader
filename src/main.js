import dotenv from 'dotenv'
import { setInterval } from 'node:timers/promises'
import { buildLogger } from './log.js'
import { buildImapClient } from './utils.js'
import MailProcessor from './processor.js'
import BillingParser from './parser.js'

const { error } = dotenv.config()

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

        for await (const time of setInterval(interval, Date.now())) {
            console.log('Tick at ' + time)

            mailProcessor
                .processMessages()
                .then(() => {
                    log.info('Lectura terminada')
                })
                .catch((error) => {
                    console.log('Error al procesar mensajes')
                    log.error({ error }, error.message ?? 'Error al procesar mensajes')
                })
        }
    } catch (e) {
        console.error(e)
        log.error({ error: e }, e.message ?? 'Error de cliente')
    }
}

main()
