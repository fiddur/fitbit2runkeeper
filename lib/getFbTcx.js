const aawait = require('asyncawait/await')
const aasync = require('asyncawait/async')
const Promise = require('bluebird')
const xml2js = require('xml2js')

module.exports = rp => account => aasync(logId => {
  const uri = `https:\/\/api.fitbit.com\/1\/user\/-\/activities\/${logId}.tcx`

  const tcxRaw = aawait(rp({
    uri,
    headers: { Authorization: `Bearer ${account.accessToken}` },
  }))

  const parser = Promise.promisifyAll(new xml2js.Parser())
  const tcxData = aawait(parser.parseStringAsync(tcxRaw))

  // There is only ONE activity in a fitbit tcx.  …I hope…
  return tcxData.TrainingCenterDatabase.Activities[0].Activity[0]
})
