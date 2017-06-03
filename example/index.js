var instantApi = require('../index')

// ----- start API server -----

instantApi({
  'sayHi': require('./hi')
})

// ----- send request -----

require('request').post({
  url: 'http://localhost:3000',
  json: {
    method: 'sayHi',
    params: { what: 'ever' },
    jsonrpc: '2.0',
    id: Math.round(Math.random()*1e20)
  }
}, function (error, response, body) {
  if (!error && response.statusCode === 200) {
    console.log('OK')
  } else {
    console.error(error || body)
  }
})