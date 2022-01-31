import pkg from 'lutron-leap'
const { Device, LeapClient, OneDeviceStatus, Response, SmartBridge } = pkg
import { EventEmitter } from 'events'

import events from 'events'
import logging from 'homeautomation-js-lib/logging.js'

var secrets = null
var connected = false
var emitter = new events.EventEmitter()
var leap = null
var bridge = null


const _sendCommandFunction = function(func) {
	if (!connected) {
		connect()
		setTimeout(func, 5)
	} else {
		func()
	}

}

// telnetClient.on('data', (function(pkt) {
// 	lutronRecv(pkt)
// }))

// telnetClient.on('connect', function() {
// 	connected = true
// 	logging.info('Telnet connected')
// })

// telnetClient.on('close', function() {
// 	connected = false
// 	logging.error('Telnet closed')
// 	deferredConnect()
// })

// telnetClient.on('error', function() {
// 	logging.error('Telnet error, disconnected')
// 	connected = false
// 	deferredConnect()
// })

// telnetClient.on('failedlogin', function() {
// 	logging.error('Telnet failed login')
// 	connected = false
// })

const _lutronSend = function(msg, fn) {
	_sendCommandFunction(function() {
		logging.info('Sending command: ' + msg)
		// telnetClient.getSocket().write(msg + '\n', fn)
	})
}

const lutronRecv = function(data) {
	var st = data.toString().trim()
	logging.info('Lutron data Received:' + st)
	var cmd = st[0]
	var cs = st.substring(1).split(',')
	var type = cs[0]

	if (cs.length > 3) {
		var deviceId = parseInt(cs[1])
		var action = parseInt(cs[2])
		var param = parseFloat(cs[3])

		emitter.emit('data', {
			cmd: cmd,
			type: type,
			deviceId: deviceId,
			action: action,
			param: param
		})
	}
}

export class LutronLeap  {

    constructor(inSecrets) {
        secrets = inSecrets
        connected = false

        this.connect()
    }

    async testCommandAndLog(requestType, URL) {
        var raw = await leap.request(requestType, URL);
        logging.info('command: ' + URL + '     result: ' + JSON.stringify(raw))
        return true
    }

    async sendOnOffCommand(zone, onOff) {
        var response = await leap.request('CreateRequest', '/zone/' + zone + '/commandprocessor', {"Command": {   "CommandType": "GoToLevel", 
                                                                                    "Parameter": [{"Type":"Level", "Value":onOff ? 100 : 0}]
                                                                                }
                                                                    })
       logging.info('command response: ' + JSON.stringify(response))
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
            logging.info('LEAP client connected')
            bridge = new SmartBridge(secrets.ip, leap);
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
            leap.subscribe('/area/status', function(subscribeResponse) { // works for area subscribe!
                logging.info('area subscribe response: ' + JSON.stringify(subscribeResponse))
            }, 'SubscribeRequest')
            leap.subscribe('/zone/status', function(subscribeResponse) { // works for zone subscribe!
                logging.info('zone subscribe response: ' + JSON.stringify(subscribeResponse))
            }, 'SubscribeRequest')
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
        //    await this.sendOnOffCommand(622, false)
        //     var response = await leap.request('CreateRequest', '/zone/622/commandprocessor', {"Command": {   "CommandType": "GoToLevel", 
        //                                                                                 "Parameter": [{"Type":"Level", "Value":0}]
        //                                                                             }
        //                                                                 })
        //    logging.info('command response: ' + JSON.stringify(response))
          
                                                                                
            // const bridgeInfo = await bridge.getBridgeInfo()
            // logging.info('bridge info: ' + JSON.stringify(bridgeInfo))
            // const deviceInfo = await bridge.getDeviceInfo()
            // logging.info('device info: ' + JSON.stringify(deviceInfo))
            bridge.on('unsolicited', this._handleUnsolicited.bind(this));
        } catch (error) {
            logging.error('error: ' + error)
        }
    }

    _handleUnsolicited(response) {
        logging.info('got unsolicited message:' + response)
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

    deferredConnect() {
        logging.info('Deferring connectect')
        
        setTimeout(function() {
            this.connect()
        }, 10)
    }
}
    
// module.exports = function(inConfig) {
// 	config = inConfig

// 	connected = false
// 	this.lutronEvent = emitter

// 	this.sendLutronCommand = function(devId, val) {
// 		logging.info('sendLutronCommand: ' + devId + ' = ' + val)
// 		_lutronSend('#OUTPUT,' + devId + ',1,' + val)
// 	}

// 	this.sendButtonCommand = function(devId, val) {
// 		logging.info('sendButtonCommand: ' + devId + ' = ' + val)
// 		_lutronSend('#DEVICE,' + devId + ',' + val + ',4')
// 	}

// 	connect()
// }
