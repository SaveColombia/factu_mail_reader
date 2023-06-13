import { exec as ex } from 'node:child_process'
import { promisify } from 'node:util'
import { ImapFlow } from 'imapflow'

/**
 * Promise version of exec
 */
export const exec = promisify(ex)

/**
 * Builds a XOAUTH token from an user(email) and access token
 *
 * @param {string} user
 * @param {string} accessToken
 * @returns {string}
 */
export const buildXOauthToken = (user, accessToken) =>
    Buffer.from([`user=${user}`, `auth=Bearer ${accessToken}`, '', ''].join('\x01'), 'utf-8').toString('base64')

/**
 * Builds the command to be executed by the backend to read the files
 * downloaded and parsed by the daemon
 *
 * @param {string} jsonPath
 * @param {string} xmlPath
 * @param {string} pdfPath
 * @returns {string}
 */
export const buildCommand = (jsonPath, xmlPath, pdfPath) =>
    [process.env.CLI_COMMAND, `json='${jsonPath}'`, `xml='${xmlPath}'`, `pdf='${pdfPath}'`].join(' ')

/**
 *
 * @returns {ImapFlow}
 */
export const buildImapClient = () => {
    if (process.env.CLIENT_TYPE === 'oauth') {
        return configureOauthImapClient()
    }

    return configureUserPasswordImapClient()
}

/**
 *
 * @returns {ImapFlow}
 */
const configureOauthImapClient = () => {
    const token = buildXOauthToken(process.env.IMAP_USER || '', '')

    return new ImapFlow({
        host: process.env.IMAP_HOST || '',
        port: Number(process.env.IMAP_PORT || 0),
        secure: true,
        auth: {
            user: process.env.IMAP_USER || '',
            accessToken: token,
        },
    })
}

/**
 *
 * @returns {ImapFlow}
 */
const configureUserPasswordImapClient = () =>
    new ImapFlow({
        host: process.env.IMAP_HOST || '',
        port: Number(process.env.IMAP_PORT || 0),
        secure: true,
        // emitLogs: false,
        // logger: false,
        auth: {
            user: process.env.IMAP_USER || '',
            pass: process.env.IMAP_PASSWORD || '',
        },
    })

/**
 * Determine whether the given `input` is iterable.
 *
 * @returns {Boolean}
 */
export const isIterable = (input) => {
    if (input === null || input === undefined) {
        return false
    }

    return typeof input[Symbol.iterator] === 'function'
}
