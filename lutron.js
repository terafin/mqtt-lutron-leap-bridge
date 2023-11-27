import pkg from '@terafin2/lutron-leap'
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
var allLEDs = []


const filterResponseArray = function (response, bodyKey, nodeIndex, exclude) {
    var body = response.Body[bodyKey]
    var result = []

    body.forEach(item => {
        var newItem = {}
        Object.keys(item).forEach(key => {
            if (key == 'href') {
                const components = item[key].trim().split('/')
                newItem['device'] = components[nodeIndex + 1]
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
                newItem[key] = item[key]
            }
        })

        result.push(newItem)
    })

    return result
}

export class LutronLeap {

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

    async sendButtonPress(button) {
        var response = await leap.request('CreateRequest', '/button/' + button + '/commandprocessor', {
            "Command": {
                "CommandType": "PressAndRelease"
            }
        })
        logging.info('command response: ' + JSON.stringify(response))
    }

    async sendZoneLevelCommand(zone, level) {
        var response = await leap.request('CreateRequest', '/zone/' + zone + '/commandprocessor', {
            "Command": {
                "CommandType": "GoToLevel",
                "Parameter": [{ "Type": "Level", "Value": level }]
            }
        })
        logging.info('command response: ' + JSON.stringify(response))
    }

    async read(path, responseProcessor) {
        var result = null

        try {
            result = await leap.request('ReadRequest', path)
            responseProcessor(result)
        } catch (error) {
            logging.error('read failed: ' + error)
        }

        return result
    }

    async readAndSubscribe(path, responseProcessor) {
        var result = null

        try {
            result = await leap.request('ReadRequest', path)
            responseProcessor(result)
            leap.subscribe(path, responseProcessor, 'SubscribeRequest')
        } catch (error) {
            logging.error('subscribe failed: ' + error)
        }

        return result
    }

    async subscribe(path, responseProcessor) {
        var result = null

        try {
            logging.info('subscribing to path: ' + path)
            leap.subscribe(path, responseProcessor, 'SubscribeRequest')
        } catch (error) {
            logging.error('subscribe failed: ' + error)
        }

        return result
    }

    async isConnected() {
        return connected
    }

    async runTestCommands() {
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

            this.readAndSubscribe('/area/status', function (subscribeResponse) {
                logging.debug('area update response: ' + JSON.stringify(subscribeResponse))
                const results = filterResponseArray(subscribeResponse, 'AreaStatuses', 1, [])
                results.forEach(result => {
                    emitter.emit('area-status', result)
                })
            })

            this.readAndSubscribe('/zone/status', function (subscribeResponse) {
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
                logging.error('disconnected')
                connected = false
            })

            emitter.emit('connected')

            this.loadAreas()

            var that = this
            setTimeout(function () {
                logging.info('Subscribing to LEDs: ' + JSON.stringify(allLEDs))
                allLEDs.forEach(ledID => {
                    that.readAndSubscribe('/led/' + ledID + '/status', function (subscribeResponse) {
                        const result = subscribeResponse.Body['LEDStatus'].State == 'On' ? '1' : '0'

                        emitter.emit('led-status', ledID, result)
                    })
                });
            }, 5 * 1000);

        } catch (error) {
            logging.error('error: ' + error)
            connected = false
        }
    }

    async loadAreas() {
        const that = this
        this.read('/area', function (response) {
            logging.debug('***** area response: ' + JSON.stringify(response))
            response.Body.Areas.forEach(area => {
                logging.debug('   area: ' + JSON.stringify(area))

                const areaId = area.href.split('/')[2]
                logging.debug('areaId: ' + areaId)
                that.read('/area/' + areaId + '/associatedcontrolstation', function (response) {
                    const controlStations = response.Body
                    logging.debug('***** control station response: ' + JSON.stringify(controlStations))
                    if (!_.isNil(controlStations)) {
                        controlStations.ControlStations.forEach(station => {
                            logging.debug('station: ' + JSON.stringify(station))
                            const associatedGangDevices = station.AssociatedGangedDevices
                            if (!_.isNil(associatedGangDevices)) {
                                associatedGangDevices.forEach(gangDevice => {
                                    logging.debug('gangDevice: ' + JSON.stringify(gangDevice))
                                    const gangDeviceId = gangDevice.Device.href.split('/')[2]
                                    logging.debug('gangDeviceId: ' + gangDeviceId)

                                    that.read('/device/' + gangDeviceId, function (response) {
                                        const deviceJSON = response.Body
                                        logging.debug('***** deviceJSON: ' + JSON.stringify(deviceJSON))

                                    })

                                    that.read('/device/' + gangDeviceId + '/buttongroup/expanded', function (response) {
                                        logging.debug('!!!************* buttonGroupJSON: ' + JSON.stringify(response))
                                        if (!_.isNil(response.Body)) {
                                            const buttonGroupJSON = response.Body
                                            const buttonGroup = buttonGroupJSON.ButtonGroupsExpanded

                                            if (!_.isNil(buttonGroup)) {
                                                buttonGroup.forEach(group => {
                                                    logging.debug('group: ' + JSON.stringify(group))
                                                    group.Buttons.forEach(button => {
                                                        logging.debug('button: ' + JSON.stringify(button))

                                                        const buttonDeviceID = button.href.split('/')[2]
                                                        logging.debug('buttonDeviceID: ' + buttonDeviceID)
                                                        logging.debug('buttonName: ' + button.Name)

                                                        if (!_.isNil(button['AssociatedLED'])) {
                                                            const ledID = button.AssociatedLED.href.split('/')[2]
                                                            logging.debug('ledID: ' + ledID)
                                                            allLEDs.push(ledID)
                                                        } else {
                                                            logging.debug('no associated LED')
                                                        }

                                                        if (!_.isNil(button['Engraving'])) {
                                                            logging.debug('engraving: ' + button.Engraving.Text)
                                                        }
                                                    });
                                                });
                                            }
                                        }
                                    })
                                })
                            }
                        })
                    }
                })
            })
        })
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
