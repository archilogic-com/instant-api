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