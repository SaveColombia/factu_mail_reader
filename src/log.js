import { mkdirSync, existsSync } from 'node:fs'
import { DateTime } from 'luxon'
import pino from 'pino'

export const buildLogger = async () => pino(pino.destination(buildLogPath()))

/**
 * Builds a path to a log file based on the current time stamp in format
 * LOG_FOLDER/yyyyMMdd/HHmm.log
 *
 * @returns {string}
 */
const buildLogPath = () => {
    if (!process.env.LOGGING_PATH) {
        throw new Error('MUST SETUP A LOGGING PATH')
    }

    const date = DateTime.now().toFormat('yyyyMMdd')
    const directory = process.env.LOGGING_PATH

    if (!mkdirSync(directory, { recursive: true })) {
        if (!existsSync(directory)) {
            throw new Error('Could not create logs directory')
        }
    }

    return `${directory}/${date}.log`
}
