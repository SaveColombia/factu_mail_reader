import * as fs from 'node:fs/promises'
import unzipper from 'unzipper'
import { DateTime } from 'luxon'
import { ImapFlow } from 'imapflow'
import { buildCommand, exec } from './utils.js'
import BillingParser from './parser.js'
import { isIterable } from './utils.js'

export default class MailProcessor {
    #client
    #lock
    #log
    #parser

    /**
     * @param {ImapFlow} client
     * @param {import('imapflow').MailboxLockObject} lock
     * @param {import('pino').Logger} log
     * @param {BillingParser} parser
     */
    constructor(client, lock, log, parser) {
        this.#client = client
        this.#lock = lock
        this.#log = log
        this.#parser = parser
    }

    /**
     *
     * @param {string} uid
     * @param {string} mailbox
     */
    async #moveMessage(uid, mailbox) {
        try {
            this.#log.info({ message: ['Requesting move to', mailbox, '- MSG:', uid].join(' ') })

            const { destination } = await this.#client.messageMove(uid, mailbox, { uid: true })
            this.#log.info({ message: ['Message moved to', destination, '- MSG:', uid].join(' ') })
        } catch (e) {
            console.error(e)

            if (e instanceof Error) {
                this.#log.error({ error: e.message }, 'Error moving message')
                return
            }

            this.#log.error({}, 'Error moving message')
        }
    }

    /**
     *
     * @param {string} xmlNode
     * @param {string} pdfNode
     * @param {string} tmpdir
     * @param {import('imapflow').FetchMessageObject} msg
     */
    async #processXmlPdfNode(xmlNode, pdfNode, tmpdir, msg) {
        try {
            const [xmlDownload, pdfDownload] = await Promise.all([
                this.#client.download(msg.uid.toString(), xmlNode, { uid: true }),
                this.#client.download(msg.uid.toString(), pdfNode, { uid: true }),
            ])

            const xmlPath = `${tmpdir}/${xmlDownload.meta.filename}`
            const pdfPath = `${tmpdir}/${pdfDownload.meta.filename}`

            await fs.writeFile(xmlPath, xmlDownload.content)
            await fs.writeFile(pdfPath, pdfDownload.content)

            const jsonPath = xmlPath.replace('.xml', '.json')

            await exec(buildCommand(jsonPath, xmlPath, pdfPath))
            this.#moveMessage(msg.uid.toString(), process.env.GOOD_MAILBOX, client, this.#log)
        } catch (e) {
            console.error(e)

            if (e instanceof Error) {
                this.#log.error({ error: e.message }, 'Error processing Message')
            }

            this.#moveMessage(msg.uid.toString(), process.env.BAD_MAILBOX)
        }
    }

    /**
     *
     * @param {string} zipNode
     * @param {string} tmpdir
     * @param {import('imapflow').FetchMessageObject} msg
     */
    #processZipNode = async (zipNode, tmpdir, msg) => {
        try {
            const { content, meta } = await this.#client.download(msg.uid.toString(), zipNode, { uid: true })

            if (meta.expectedSize > 4 * 1024 * 1024) {
                throw new Error('Size too big')
            }

            const zip = content.pipe(unzipper.Parse({ forceStream: true }))

            /** @type {unzipper.Entry|null} xml */
            let xml = null
            let xmlPath = ''

            /** @type {unzipper.Entry|null} pdf */
            let pdf = null
            let pdfPath = ''

            let jsonPath = ''

            for await (const entry of zip) {
                if (entry.path.includes('.xml')) {
                    xml = entry
                    xmlPath = `${tmpdir}/${entry.path}`
                    jsonPath = xmlPath.replace('.xml', '.json')

                    await fs.writeFile(xmlPath, entry).catch((e) => {
                        console.error(e)
                    })
                }

                if (entry.path.includes('.pdf')) {
                    pdf = entry
                    pdfPath = `${tmpdir}/${entry.path}`

                    await fs.writeFile(`${tmpdir}/${entry.path}`, entry).catch((e) => {
                        if (e instanceof Error) {
                            this.#log.error(e.message)
                        }
                    })
                }

                // Required or the stream bonks
                entry.autodrain()
            }

            if (xml && pdf) {
                const data = await this.#parser.parse(xmlPath)

                if (!data) {
                    throw new Error('Could not get data from XML')
                }

                await fs.writeFile(jsonPath, JSON.stringify(data))
                await exec(buildCommand(jsonPath, xmlPath, pdfPath))
                this.#moveMessage(msg.uid.toString(), process.env.GOOD_MAILBOX)

                fs.rm(tmpdir, { recursive: true, force: true })
            } else {
                throw new Error('No contenía una factura válida')
            }
        } catch (e) {
            console.error(e)

            this.#log.error({ output: e.stdout?.trim() ?? '', error: e.message ?? '' }, 'Could not process mail data')
            fs.rm(tmpdir, { recursive: true, force: true })
            this.#moveMessage(msg.uid.toString(), process.env.BAD_MAILBOX)
        }
    }

    /**
     *
     * @param {import('imapflow').FetchMessageObject} msg
     * @param {string} timestampDir
     */
    async #processMessage(msg, timestampDir) {
        if (!isIterable(msg?.bodyStructure?.childNodes ?? null)) {
            this.#moveMessage(msg.uid.toString(), process.env.BAD_MAILBOX)
            return
        }

        let xmlNode,
            pdfNode,
            zipNode = null

        const tmpdir = await fs.mkdtemp(timestampDir)

        // Look for valid attachments
        for (const node of msg.bodyStructure.childNodes) {
            if (!node.dispositionParameters?.filename) {
                continue
            }

            if (node.dispositionParameters.filename.toLowerCase().includes('.xml')) {
                xmlNode = node.part
            }

            if (node.dispositionParameters.filename.toLowerCase().includes('.pdf')) {
                pdfNode = node.part
            }

            if (node.dispositionParameters.filename.toLowerCase().includes('.zip')) {
                zipNode = node.part
            }
        }

        if (xmlNode && pdfNode) {
            this.#processXmlPdfNode(xmlNode, pdfNode, tmpdir, msg)
        } // Download and process zip if exists
        else if (zipNode) {
            this.#processZipNode(zipNode, tmpdir, msg)
        }
    }

    /**
     * Fetches and queues messages to be proccesed
     * @throws {Error} when ATTACHMENTS_PATH undefined / not accesible / can't be created
     */
    async #fetchMessages() {
        if (!process.env.ATTACHMENTS_PATH) {
            throw new Error('No attachments path')
        }

        const timestampDir = `${process.env.ATTACHMENTS_PATH}/${DateTime.now().toFormat('yyyyMMddHHmm')}/`

        await fs.mkdir(timestampDir, { recursive: true })
        await fs.access(timestampDir, fs.constants.R_OK | fs.constants.W_OK)

        if (typeof this.#client.mailbox === 'boolean') {
            return
        }

        if (!this.#client.usable) {
            return
        }

        try {
            const messages = this.#client.fetch('1:*', { uid: true, bodyStructure: true })

            for await (const msg of messages) {
                try {
                    this.#processMessage(msg, timestampDir)
                } catch (error) {
                    this.#moveMessage(msg.uid.toString(), process.env.BAD_MAILBOX)
                    continue
                }
            }
        } catch (e) {
            console.error(e)

            if (e instanceof Error) {
                this.#log.error(e.message)
            }

            this.#lock.release()
            await this.#client.logout()
            process.exit(1)
        }
    }

    /**
     * Process messages in a given Mailbox
     */
    async processMessages() {
        this.#fetchMessages()
    }
}
