"use strict";

// TODO: Add batch request support

var util = require('util')

// helpers

var errorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  APPLICATION_ERROR: -32500,
  SYSTEM_ERROR: -32400,
  TRANSPORT_ERROR: -32300
}

var errorMessages = {
  PARSE_ERROR: 'Parse Error',
  INVALID_REQUEST: 'Invalid Request',
  METHOD_NOT_FOUND: 'Method Not Found',
  INVALID_PARAMS: 'Invalid Parameters',
  INTERNAL_ERROR: 'Internal Error',
  APPLICATION_ERROR: 'Application Error',
  SYSTEM_ERROR: 'System Error',
  TRANSPORT_ERROR: 'Transport Error'
}

var errorObjects = {
  PARSE_ERROR: {code: errorCodes.PARSE_ERROR, message: errorMessages.PARSE_ERROR},
  INVALID_REQUEST: {code: errorCodes.INVALID_REQUEST, message: errorMessages.INVALID_REQUEST},
  METHOD_NOT_FOUND: {code: errorCodes.METHOD_NOT_FOUND, message: errorMessages.METHOD_NOT_FOUND},
  INVALID_PARAMS: {code: errorCodes.INVALID_PARAMS, message: errorMessages.INVALID_PARAMS},
  INTERNAL_ERROR: {code: errorCodes.INTERNAL_ERROR, message: errorMessages.INTERNAL_ERROR},
  APPLICATION_ERROR: {code: errorCodes.APPLICATION_ERROR, message: errorMessages.APPLICATION_ERROR},
  SYSTEM_ERROR: {code: errorCodes.SYSTEM_ERROR, message: errorMessages.SYSTEM_ERROR},
  TRANSPORT_ERROR: {code: errorCodes.TRANSPORT_ERROR, message: errorMessages.TRANSPORT_ERROR}
}

function logNotificationResponseWarning (message, requestMessage) {
  console.warn(
    'JSON-RPC2 request for method ' + requestMessage.methodName + ' was a notification call (no ID present) and should not send any response.\n'
    + 'Check JSON-RPC2 specification for details: "http://www.jsonrpc.org/specification#notification"\n'
    + 'Response has _not_ been sent:\n'
    + util.inspect(message) + '\n'
    + 'Original request:\n'
    + util.inspect(requestMessage)
  )
}

// class

function JsonRpc2Server () {

  this._exposedMethods = {}

}

JsonRpc2Server.prototype = {

  exposeMethod: function (methodName, method) {

    console.log('Exposing API method "'+methodName+'"')
    this._exposedMethods[methodName.toLowerCase()] = method

  },

  exposeModule: function (methodPrefix, module) {
    
    if (typeof module === 'function') {
      
      this.exposeMethod(methodPrefix, module)

    } else if (typeof module === 'object') {

      for (var methodName in module) {
        if (module.hasOwnProperty(methodName) && methodName[0] !== '_') {
          this.exposeModule(methodPrefix + '.' + methodName, module[methodName])
        }
      }
    }

  },

  handleRequest: function (options, callback) {
    
    // API
    var requestMessage = options.message
    // to be forwarded to method
    var request = options.request
    var response = options.response
    var user = options.user

    // check if callback exists
    if (!callback) {
      console.error('callback param missing.')
      return
    }

    // parse message
    if (typeof requestMessage === 'string') {
      try {
        requestMessage = JSON.parse(requestMessage)
      } catch (e) {
        // non-valid JSON
        callback({
          jsonrpc: '2.0',
          error: {
            code: errorCodes.PARSE_ERROR,
            message: errorMessages.PARSE_ERROR + ': Non-valid JSON.'
          },
          id: null
        })
        return
      }
    }

    // validate message
    if (
      typeof requestMessage !== 'object'
      || requestMessage === null
      || requestMessage.jsonrpc !== '2.0'
    ) {
      // non-valid message
      console.error('Invalid JSON-RPC request: ', requestMessage)
      callback({
        jsonrpc: '2.0',
        error: {
          code: errorCodes.PARSE_ERROR,
          message: errorMessages.PARSE_ERROR + ': Non-valid JSON-RPC2 call.'
        },
        id: null
      })
      return
    }
    
    // internals
    var method
    var methodName = requestMessage.method
    var params = requestMessage.params || {}
    var id = requestMessage.id
    var isMethodCall = (id === null || typeof id === 'string' || typeof id === 'number') // method calls have valid id, notifications not (JSON-RPC2 specs)
    var responseHasBeenSent = false

    // validate method name
    if (typeof methodName !== 'string') {
      if (isMethodCall) {
        // send errors responses to method calls only (JSON-RPC2 specs http://www.jsonrpc.org/specification#notification)
        callback({
          jsonrpc: '2.0',
          error: {
            code: errorCodes.INVALID_REQUEST,
            message: 'Invalid request: Method name must be a string.'
          },
          id: id
        })
      } else {
        // at least log something to the console
        console.warn(
          'JSON-RPC2 error: invalid request (method name must be a string).'
          + '\nOriginal request:\n'
          + util.inspect(requestMessage)
        )
        callback()
      }
      return
    }

    // check if method exists
    if (this._exposedMethods[methodName.toLowerCase()]) {
      method = this._exposedMethods[methodName.toLowerCase()]
    } else {
      if (isMethodCall) {
        // send errors responses to method calls only (JSON-RPC2 specs http://www.jsonrpc.org/specification#notification)
        callback({
          jsonrpc: '2.0',
          error: {
            code: errorCodes.METHOD_NOT_FOUND,
            message: 'Method "'+methodName+'" not found. Available methods are: '+Object.keys(this._exposedMethods).join(', ')
          },
          id: id
        })
      } else {
        // at least log something to the console
        console.warn(
          'JSON-RPC2 method "' + methodName + '" not found.'
          + '\nOriginal request:\n'
          + util.inspect(requestMessage)
        )
        callback()
      }
      return
    }

    // create send result handler
    var sendResult = function (result) {

      // don't send a second response
      if (responseHasBeenSent) {
        console.warn('JSON-RPC2 response has already been sent.')
        return
      }
      // notifications should not send error responses (JSON-RPC2 specs)
      if (!isMethodCall) {
        logNotificationResponseWarning(result, requestMessage)
        callback()
        return
      }

      // result should not be undefined
      if (result === undefined) {
        console.warn('JSON-RPC2 response from method ' + methodName + ' should return a result. (JSON-RPC2 spec)')
        result = ''
      }

      var rpcMessage = {
        jsonrpc: '2.0',
        result: result,
        id: id
      }

      callback(rpcMessage)
      responseHasBeenSent = true

    }

    // create send message method
    var sendMessage = function (method, result) {

      // result should not be undefined
      if (result === undefined) {
        console.warn('JSON-RPC2 response from method ' + methodName + ' should return a result. (JSON-RPC2 spec)')
        result = ''
      }

      var rpcMessage = {
        jsonrpc: '2.0',
        result: result,
        id: id
      }

      callback(rpcMessage)
      responseHasBeenSent = true

    }

    // create send error handler
    var sendError = function (error, type) {

      // don't send a second response
      if (responseHasBeenSent) {
        console.warn('JSON-RPC2 response has already been sent.')
        return
      }
      // notifications should not send error responses (JSON-RPC2 specs)
      if (!isMethodCall) {
        var message = (error && error.toString) ? error.toString() : undefined
        logNotificationResponseWarning(message, requestMessage)
        callback()
        return
      }

      // internals
      var errorObject

      if (error instanceof Error) {
        // serious application error
        console.warn(
          'Error in JSON-RPC2 method ' + methodName + ': ' + error.toString() + '\n'
          + error.stack
        )
        // not sending detailed error info to not expose details about server code
        errorObject = {
          code: errorCodes['APPLICATION_ERROR'],
          message: errorMessages['APPLICATION_ERROR'] + ' (Check server logs for details)'
        }

      } else if (typeof error === 'string') {
        // error message
        errorObject = {
          code: errorCodes[type] || errorCodes['INVALID_REQUEST'],
          message: error
        }

      } else if (typeof error === 'object') {
        if (error.message) {
          // error object
          errorObject = error
          if (error.code === undefined) {
            error.code = errorCodes['INVALID_REQUEST']
          }

        } else {
          // error data
          errorObject = {
            code: errorCodes[type] || errorCodes['INVALID_REQUEST'],
            message: errorMessages[type] || errorMessages['INVALID_REQUEST'],
            data: error
          }
        }

      } else {
        if (error !== undefined) {
          console.warn('Error parameter must be a string (error message) or object (error data)')
        }
        // fallback
        errorObject = errorObjects['INVALID_REQUEST']

      }

      var rpcMessage = {
        jsonrpc: '2.0',
        error: errorObject,
        id: id
      }

      callback(rpcMessage)
      responseHasBeenSent = true

    }

    // create send error handler for invalid params
    var sendParamsError = function (message) {
      sendError(errorMessages['INVALID_PARAMS'] + ': ' + message, 'INVALID_PARAMS')
    }

    // create handler for ending a notification
    var end = function () {
      responseHasBeenSent = true
      callback()
    }

    // create rpc object for methods
    var rpc = {
      // properties
      methodName: methodName,
      params: params,
      id: id,
      requestMessage: requestMessage,
      // methods
      send: sendResult,
      sendResult: sendResult,
      sendError: sendError,
      sendParamsError: sendParamsError,
      end: end
    }

    // run method
    try {
      method(rpc, user, request, response)
    } catch (error) {
      sendError(error)
    }

  }

}

// API
module.exports = JsonRpc2Server
