import pkg from 'lutron-leap'
const { Device, LeapClient, OneDeviceStatus, Response, SmartBridge } = pkg
import { EventEmitter } from 'events'

import events from 'events'
import logging from 'homeautomation-js-lib/logging.js'
import _ from 'lodash'

var secrets = null
var connected = false
var emitter = new events.EventEmitter()
var leap = null
var bridge = null



const filterResponseArray = function(response, bodyKey, nodeIndex, exclude) {
    var body = response.Body[bodyKey]
    var result = []

    body.forEach(item => {
        var newItem = {}
        Object.keys(item).forEach(key => {
            if ( key == 'href' ) {
                const components = item[key].trim().split('/')
                newItem['device'] = components[nodeIndex + 1]
            } else if ( _.isNil(exclude) ) {
                // logging.info('nil exclude, skipping')
                return;
            } else if ( exclude.size == 0 ) {
                // logging.info('empty exclude, skipping')
                return;
            } else if ( exclude.includes(key) ) {
                // logging.info('key excluded, skipping')
                return;
            } else if ( !_.isNil(item[key]) ) {
                newItem[key] = item[key]
            }
        })

        result.push(newItem)
    })

    return result
}

export class LutronLeap  {

    constructor(inSecrets) {
        secrets = inSecrets
        connected = false
        this.lutronEvent = emitter
        this.connect()
    }

    async testCommandAndLog(requestType, URL) {
        var raw = await sendCommand(requestType, URL);
        logging.info('command: ' + URL + '     result: ' + JSON.stringify(raw))
        return true
    }

    async sendCommand(requestType, URL) {
        var raw = await leap.request(requestType, URL);
        return raw
    }

    async sendZoneOnOffCommand(zone, onOff) {
        return this.sendZoneLevelCommand(zone, onOff ? 100 : 0)
    }

    async sendZoneLevelCommand(zone, level) {
        var response = await leap.request('CreateRequest', '/zone/' + zone + '/commandprocessor', {"Command": {   "CommandType": "GoToLevel", 
                                                                                    "Parameter": [{"Type":"Level", "Value":level}]
                                                                                }
                                                                    })
       logging.info('command response: ' + JSON.stringify(response))
    }

    async readAndSubscribe(path, responseProcessor) {
        const result = await leap.request('ReadRequest', path)
        responseProcessor(result)
        leap.subscribe(path, responseProcessor, 'SubscribeRequest')
    }
    
    async isConnected() {
        return connected
    }

    async runTestCommands() {
        // await this.testCommandAndLog('ReadRequest', '/server/1/status/ping')
        // await this.testCommandAndLog('ReadRequest', '/area/24')
        // await this.testCommandAndLog('ReadRequest', '/area')
        // await this.testCommandAndLog('ReadRequest', '/areascene/734') // area scene
        // await this.testCommandAndLog('ReadRequest', '/preset/734') // preset scene
        // await this.testCommandAndLog('ReadRequest', '/device/615') // switch
        // await this.testCommandAndLog('ReadRequest', '/device/752') // motion
        // await this.testCommandAndLog('ReadRequest', '/device/752/status') // motions
        // await this.testCommandAndLog('ReadRequest', '/link')
        // await this.testCommandAndLog('ReadRequest', '/device/status')
        // await this.testCommandAndLog('ReadRequest', '/area/729') // loft
        // await this.testCommandAndLog('ReadRequest', '/area/24') // loft
        // await this.testCommandAndLog('ReadRequest', '/area/83') // Equuipmnent room
        // await this.testCommandAndLog('ReadRequest', '/area/3') // Home
        // await this.testCommandAndLog('ReadRequest', '/area/729/status') // Occupied status of loft
        // await this.testCommandAndLog('ReadRequest', '/zone')
        // await this.testCommandAndLog('ReadRequest', '/zone/622') // loft zone
        // await this.testCommandAndLog('ReadRequest', '/zone/622/status') // Status of a zone
        // await this.testCommandAndLog('ReadRequest', '/controlstation/613') // switch control
        // await this.testCommandAndLog('ReadRequest', '/controlstation/750') // motion control
        // await this.testCommandAndLog('ReadRequest', '/device/615/linknode/617')
        // await this.testCommandAndLog('ReadRequest', '/link/98')
        // await this.testCommandAndLog('ReadRequest', '/device/96') // Processor
        // await this.testCommandAndLog('ReadRequest', '/project')
        // zone is /zone/622 area is /area/729
        // this.testCommandAndLog('ReadRequest', '/controlstation/613')
        // var response = await leap.request('ReadResponse', '/device/615/status')
        // logging.info('command response: ' + JSON.stringify(response))
        // leap.subscribe('/occupancygroup/status', function(subscribeResponse) {
        //     logging.info('occupancy subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/occupancygroup/event', function(subscribeResponse) {
        //     logging.info('occupancy subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/areascene/status', function(subscribeResponse) { 
        //     logging.info('areascene subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/controlstation/750/event', function(subscribeResponse) {
        //     logging.info('controlstation subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/project/status', function(subscribeResponse) {
        //     logging.info('project subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/device/752', function(subscribeResponse) {
        //     logging.info('device subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/area/729', function(subscribeResponse) {
        //     logging.info('area subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/controlstation/613', function(subscribeResponse) {
        //     logging.info('controlstation subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/device/615', function(subscribeResponse) {
        //     logging.info('subscribe response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
        // leap.subscribe('/device/status/deviceheard', function(subscribeResponse) {
        //     logging.info('deviceheard response: ' + subscribeResponse)
        // }, 'SubscribeRequest')
    //    await this.sendZoneOnOffCommand(622, false)
    //     var response = await leap.request('CreateRequest', '/zone/622/commandprocessor', {"Command": {   "CommandType": "GoToLevel", 
    //                                                                                 "Parameter": [{"Type":"Level", "Value":0}]
    //                                                                             }
    //                                                                 })
    //    logging.info('command response: ' + JSON.stringify(response))
      
                                                                            
        // const bridgeInfo = await bridge.getBridgeInfo()
        // logging.info('bridge info: ' + JSON.stringify(bridgeInfo))
        // const deviceInfo = await bridge.getDeviceInfo()
        // logging.info('device info: ' + JSON.stringify(deviceInfo))
    }

    async ping() {
        var success = true
        try {
            this.sendCommand('ReadRequest', '/server/1/status/ping')
        } catch (error) {
            logging.error('ping failed: ' + error)
            connected = false
            success = false
        }

        return success
    }

    async connect() {
        if (connected) {
            return
        }
    
        try {
            const secrets = this.secrets()
            logging.info('Setting up LeapClient to IP: ' + secrets.ip)
            leap = new LeapClient(secrets.ip, 8081, secrets.cert, secrets.key, secrets.ca)
            
            await leap.connect()
            connected = true
            logging.info('LEAP client connected')
            bridge = new SmartBridge(secrets.ip, leap);

            await this.runTestCommands()

            await this.readAndSubscribe('/area/status', function(subscribeResponse) {
                logging.debug('area update response: ' + JSON.stringify(subscribeResponse))
                const results = filterResponseArray(subscribeResponse, 'AreaStatuses', 1, [])
                results.forEach(result => {
                    emitter.emit('area-status', result)
                })
            })

            await this.readAndSubscribe('/zone/status', function(subscribeResponse) {
                logging.debug('zone update response: ' + JSON.stringify(subscribeResponse))
                const results = filterResponseArray(subscribeResponse, 'ZoneStatuses', 1, ['Zone'])
                results.forEach(result => {
                    emitter.emit('zone-status', result)
                })
            })

            leap.on('unsolicited', (response) => {
                emitter.emit('unsolicited: ' + JSON.stringify(response))
            })

            leap.on('disconnected', () => {
                emitter.emit('disconnected')
                connected = false
            })

        } catch (error) {
            logging.error('error: ' + error)
            connected = false
        }
    }

    secrets() {
        var params = {
            ip: secrets.ip,
            ca: secrets.ca,
            key: secrets.key,
            cert: secrets.crt
        }

        return params
    }
}
