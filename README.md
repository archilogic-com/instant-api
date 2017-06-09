# Instant API
Like instant soup but API. JSON-RPC2 flavor with Websockets and HTTP.

**💾&nbsp;Install**
```
npm i -s instant-api
```

**📡&nbsp;Expose task 'makeSoup' at port 3000**
```javascript
var tasks = {
  'makeSoup': require('./tasks/make-soup')
}
require('instant-api')(tasks ,{ port: process.env.PORT || 3000 })
```

**🤖&nbsp;tasks/make-soup.js**
```javascript
module.exports = function (rpc) {
  
  // use parameters
  console.log(rpc.params)
  
  // return result
  rpc.sendResult('Done. Enjoy!')
  
  // return param error
  //rpc.sendParamsError('Missing parameter ...')
  
  // return custom error
  //rpc.sendError('Splash')
  
  // use in promise chains
  // rawQuery(query).then(rpc.sendResult).catch(rpc.sendError)
  
}
```

**📣&nbsp;Call task...**
```javascript
var message = {
  method: 'makeSoup',
  params: { size: 'medium' },
  jsonrpc: '2.0',
  id: Math.round(Math.random()*1e20)
}

// ... from a browser using HTTP
fetch('localhost:3000', {
  method: 'POST', body: JSON.stringify( message )
}).then(function(response){
  return response.json()
}).then(function(body){
  console.log(JSON.parse(body.result))
}).catch(console.error)
 
// ... from a browser using Websockets
var ws = new WebSocket('ws://localhost:3000')
ws.onopen = function () {
  ws.send( JSON.stringify(message) )
}
ws.onmessage = function (event) {
  console.log(JSON.parse(event.data))
}

// ... from another server
// npm install --save request
require('request').post({
  url: 'http://localhost:3000',
  json: message
}, function (error, response, body) {
  if (!error && response.statusCode === 200) {
    console.log(body.result)
  } else {
    console.error(error || body)
  }
})

```

[**🕹&nbsp;Run example**](example/index.js)
```
npm run example
```

<a href="https://glitch.com/edit/#!/import/archilogic-com/instant-api"><img src="https://cdn.glitch.com/2703baf2-b643-4da7-ab91-7ee2a2d00b5b%2Fremix-button.svg" alt="Remix on Glitch" /></a>
