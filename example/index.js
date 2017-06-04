

// _________________ start API server _________________


var tasks = {
  'makeSoup': require('./tasks/make-soup')
}
var api = require('../index')(tasks ,{ port: process.env.PORT || 3000 })


// _____________________ call task _____________________


var message = {
  method: 'makeSoup',
  params: { size: 'medium' },
  jsonrpc: '2.0',
  id: Math.round(Math.random()*1e20)
}

require('request').post({
  url: 'http://localhost:3000',
  json: message
}, function (error, response, body) {
  // parse message
  if (!error && response.statusCode === 200) {
    console.log(body.result)
  } else {
    console.error(error || body)
  }
  // shut down API server because we don't need further
  api.server.close()
})