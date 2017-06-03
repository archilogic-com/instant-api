var http = require('http')
var path = require('path')
var fs = require('fs')
var ws = require('ws')
var express = require('express')
var cors = require('cors')
var timeout = require('connect-timeout')
var morgan = require('morgan')
var bodyParser = require('body-parser')
var handleWebsocketUpgrade = require('express-websocket')
var getClientIp = require('./lib/client-ip')
var JsonRpc2Server = require('./lib/json-rpc2-server')


module.exports = function instantApi (args, options) {

  // options
  options = options || {}
  var port = options.port ? options.port : ( process.env.PORT || 3000 )

  // internals
  var exposedModules = {}

  // create RPC server
  var rpcServer = new JsonRpc2Server()

  // expose methods
  if (!args) {
    throw new Error('Please provide a filename, directory or array with filenames.')
  } else if (typeof args === 'string') {
    if (path.extname(args) === '.js') {
      // expose single script (method name = file path without extension)
      var methodName = pathWithoutJsExtension(args)
      rpcServer.exposeModule(methodName, require('./'+methodName))
    } else {
      // expose directory
      fs.readdirSync(args).forEach(function (filename, i) {
        var methodName = pathWithoutJsExtension(args+'/'+filename)
        rpcServer.exposeModule(methodName, require('./'+methodName))
      })
    }
  } else if (Array.isArray(args)) {
    // expose scripts
    args.forEach(function (path, i) {
      var methodName = pathWithoutJsExtension(path)
      rpcServer.exposeModule(methodName, require('./'+methodName))
    })
  } else if (typeof args === 'object') {
    Object.keys(args).forEach(function (methodName) {
      rpcServer.exposeModule(methodName, require('./'+args[methodName]))
    })
  } else {
    throw new Error('First argument must be of type string or array.')
  }

  // create express server
  var app = express()

  // debugging
  if (process.env.NODE_ENV !== 'production') {
    app.set('showStackError', true)
    app.use(morgan('dev'))
  }
  // set timeout
  app.use(timeout('30s'))
  // get client ip
  app.use(getClientIp)
  // configure CORS to allow all origins
  app.use(cors({
    credentials: true,
    origin: function (origin, callback) {
      callback(null, origin)
    }
  }))

  // handle HTTP requests
  app.post('/',
    bodyParser.text({ limit: '5000kb', type: '*/*' }),
    function (req, res) {
      rpcServer.handleRequest({
        message: req.body,
        request: req,
        response: res,
        user: req.user
      }, function (response) {
        // JSON RPC methods calls by specification have responses while notifications do not
        // http://www.jsonrpc.org/specification#notification
        response ? res.status(response.error ? 400 : 200).json(response) : res.status(200).end()
      }
    )
  })
  // handle websocket requests
  app.get('/', function (req, res, next) {
    if (!res.websocket) return next()

    res.websocket(function (ws) {
      // websocket connection successful. stop timeout prevention
      req.clearTimeout()
      // avoid timeouts by sending ping notifications. required on certain PaaS platforms like heroku
      // which close connections automatically after certain time (mostly 30s)
      var interval = setInterval(function(){
        ws.send(JSON.stringify({
          jsonrpc: '2.0',
          method: 'ping',
          params: {}
        }))
      }, 20 * 1000)
      ws.on('close', function(){
        clearInterval(interval)
      })
      // handle messages
      ws.on('message', function (message) {
        rpcServer.handleRequest({
          message: message,
          request: req,
          response: res,
          user: req.user
        }, function (response) {
          if (response) ws.send(JSON.stringify(response))
        })
      })

    })
  })

  // start server
  var httpServer = http.createServer(app)
  httpServer.listen(port, function () {
    // init websocket server
    var websocketServer = new ws.Server({ noServer: true })
    httpServer.on('upgrade', handleWebsocketUpgrade(app, websocketServer))
    // ready to go ;)
    console.log('Server listening on http://localhost:' + port)
  })

}

// helpers

function pathWithoutJsExtension (path) {
  return path.substr(0,path.length-3)
}