// Requirements
import mqtt from 'mqtt'
import _ from 'lodash'

import logging from 'homeautomation-js-lib/logging.js'
import health from 'homeautomation-js-lib/health.js'
import mqtt_helpers from 'homeautomation-js-lib/mqtt_helpers.js'
import interval from 'interval-promise'
import * as lutronLib from './lutron.js'
const { LutronLeap } = lutronLib
import fs from 'fs'
import pth from "path"
import { exit } from 'process'

// Config
const pathToBridgeKey = process.env.BRIDGE_KEY_PATH

const pathToBridgeCA = process.env.BRIDGE_CA_PATH
const pathToBridgeCert = process.env.BRIDGE_CERT_PATH

var mqttOptions = { qos: 1, retain: true }

const bridgeIP = process.env.BRIDGE_IP
var bridgeCA = null
var bridgeKey = null
var bridgeCert = null

const host = process.env.MQTT_HOST
var topic_prefix = process.env.TOPIC_PREFIX

const loadFileData = function (filePath) {
    logging.info('Loading file at path: ' + filePath)
    return fs.readFileSync(filePath, 'ASCII')
}

// Check basics
if (_.isNil(bridgeIP)) {
    logging.warn('empty BRIDGE_IP, not starting')
    process.abort()
} else {
}

if (_.isNil(pathToBridgeCA)) {
    logging.warn('empty BRIDGE_CA_PATH, not starting')
    process.abort()
} else {
    bridgeCA = loadFileData(pathToBridgeCA)
    if (_.isNil(bridgeCA)) {
        logging.warn('empty file at BRIDGE_CA_PATH, not starting')
        process.abort()
    }
}

if (_.isNil(pathToBridgeKey)) {
    logging.warn('empty BRIDGE_KEY_PATH, not starting')
    process.abort()
} else {
    bridgeKey = loadFileData(pathToBridgeKey)
    if (_.isNil(bridgeKey)) {
        logging.warn('empty file at BRIDGE_KEY_PATH, not starting')
        process.abort()
    }
}

if (_.isNil(pathToBridgeCert)) {
    logging.warn('empty BRIDGE_CERT_PATH, not starting')
    process.abort()
} else {
    bridgeCert = loadFileData(pathToBridgeCert)
    if (_.isNil(bridgeCert)) {
        logging.warn('empty file at BRIDGE_CERT_PATH, not starting')
        process.abort()
    }
}

if (_.isNil(host)) {
    logging.warn('empty MQTT_HOST, not starting')
    process.abort()
}

if (_.isNil(topic_prefix)) {
    logging.warn('empty TOPIC_PREFIX, using /isy')
    topic_prefix = '/leap/'
}

// Setup Lutron
const lutron = new LutronLeap({ ip: bridgeIP, ca: bridgeCA, cert: bridgeCert, key: bridgeKey })


// MQTT Event Handlers
var connectedEvent = function () {
    var topic = topic_prefix + '/+/+/+/set'
    logging.info('Subscribing to topic: ' + topic)
    client.subscribe(topic, { qos: 1 })

    topic = topic_prefix + '/+/+/+/press'
    logging.info('Subscribing to topic: ' + topic)
    client.subscribe(topic, { qos: 1 })
    health.healthyEvent()
}

var disconnectedEvent = function () {
    logging.error('Reconnecting...')
    health.unhealthyEvent()
}

// Setup MQTT
var client = mqtt_helpers.setupClient(connectedEvent, disconnectedEvent)

if (_.isNil(client)) {
    logging.warn('MQTT Client Failed to Startup')
    process.abort()
}

// MQTT Observation
client.on('message', (topic, message) => {
    var components = topic.split('/')

    // topic_prefix/zone/NUMBER/COMMAND = VALUE
    const scope = components[components.length - 4]
    const number = components[components.length - 3]
    const command = components[components.length - 2]
    logging.info(' => topic: ' + topic + '  message: ' + message + ' scope: ' + scope + ' scope: ' + number + ' scope: ' + command)

    if (_.isNil(scope) || _.isNil(number) || _.isNil(command)) {
        logging.error('malformed MQTT command')
        return
    }

    switch (scope) {
        case 'zone':
            switch (command) {
                case 'on_off':
                    lutron.sendZoneOnOffCommand(number, message == '1' ? true : false)
                    break;

                case 'level':
                    lutron.sendZoneLevelCommand(number, Number(message))
                    break;

                default:
                    logging.error('unhandled command: ' + command)
                    break;
            }
            break;

        default:
            logging.error('unhandled scope: ' + scope)
            break;
    }
})

lutron.lutronEvent.on('zone-status', (update) => {
    logging.info('zone-status: ' + JSON.stringify(update))
    const device = update.device

    if (_.isNil(device))
        return

    const switchedLevel = update.SwitchedLevel
    const level = update.Level
    const deviceTopic = mqtt_helpers.generateTopic(topic_prefix, 'zone', device.toString())

    if (!_.isNil(switchedLevel)) {
        client.smartPublish(mqtt_helpers.generateTopic(deviceTopic, 'on_off'), switchedLevel == 'On' ? "1" : "0", mqttOptions)
    }
    if (!_.isNil(level)) {
        client.smartPublish(mqtt_helpers.generateTopic(deviceTopic, 'level'), level, mqttOptions)
    }
})

lutron.lutronEvent.on('area-status', (update) => {
    logging.info('area-status: ' + JSON.stringify(update))
    const device = update.device
    const occupancyStatus = update.OccupancyStatus
    const deviceTopic = mqtt_helpers.generateTopic(topic_prefix, 'areas', device.toString())


    if (!_.isNil(occupancyStatus)) {
        client.smartPublish(mqtt_helpers.generateTopic(deviceTopic, 'occupancy'), occupancyStatus == 'Occupied' ? "1" : "0", mqttOptions)
    }
})

lutron.lutronEvent.on('led-status', (led, status) => {
    logging.info('led-status: ' + led + '   status: ' + status)
    const deviceTopic = mqtt_helpers.generateTopic(topic_prefix, 'led', led.toString())

    client.smartPublish(mqtt_helpers.generateTopic(deviceTopic), status == 1 ? "1" : "0", mqttOptions)
    // const occupancyStatus = update.OccupancyStatus
    // const deviceTopic = mqtt_helpers.generateTopic(topic_prefix, 'areas', device.toString())


    // if (!_.isNil(occupancyStatus)) {
    //     client.smartPublish(mqtt_helpers.generateTopic(deviceTopic, 'occupancy'), occupancyStatus == 'Occupied' ? "1" : "0", mqttOptions)
    // }
})

lutron.lutronEvent.on('unsolicited', (update) => {
    logging.info('unsolicited: ' + JSON.stringify(update))
})


lutron.lutronEvent.on('disconnected', () => {
    logging.info('disconnected')
    process.exit(1)
})


lutron.lutronEvent.on('connected', () => {
    logging.info('connected')
    setupSubscriptions()
})


interval(async () => {
    logging.debug('checking connection')
    await lutron.ping()
    const connected = await lutron.isConnected()

    if (!connected) {
        logging.info('reconnecting, connection dead')
        lutron.connect()
    } else {
        logging.debug('already connected')
    }
}, 1000 * 10)

const filterResponse = function (response, bodyKey, nodeIndex, exclude) {
    var item = response.Body[bodyKey]
    var result = {}

    // logging.info('item: ' + JSON.stringify(item))

    if (!_.isNil(item)) {
        Object.keys(item).forEach(key => {
            if (key == 'href') {
                const components = item[key].trim().split('/')
                result['device'] = components[1]
            } else if (_.isNil(exclude)) {
                // logging.info('nil exclude, skipping')
                return;
            } else if (exclude.size == 0) {
                // logging.info('empty exclude, skipping')
                return;
            } else if (exclude.includes(key)) {
                // logging.info('key excluded, skipping')
                return;
            } else if (!_.isNil(item[key])) {
                result[key] = item[key]
            }
        })
    }
    return result
}

interval(async () => {
    const connected = await lutron.isConnected()

    if (connected) {
        // Insert ping response here
    }
}, 100)



const setupSubscriptions = function () {

}


