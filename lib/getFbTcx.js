const aawait = require('asyncawait/await')
const aasync = require('asyncawait/async')
const tcx = require('tcx-js')

module.exports = rp => account => aasync(logId => {
  const uri = `https:\/\/api.fitbit.com\/1\/user\/-\/activities\/${logId}.tcx`

  const tcxRaw = aawait(rp({
    uri,
    headers: { Authorization: `Bearer ${account.accessToken}` },
  }))

  const parser = new tcx.Parser()
  parser.parser.parse(tcxRaw)

  const activity = parser.activity
  const trackpoints = activity.trackpoints

  return trackpoints
})
