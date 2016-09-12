const aawait = require('asyncawait/await')
const aasync = require('asyncawait/async')

module.exports = (rp, fbConfig) => aasync((url, account) => {
  try {
    const activities = aawait(rp({
      uri:     url,
      json:    true,
      headers: { Authorization: `Bearer ${account.accessToken}` },
    }))
    console.log('Activities:', activities)
    return activities
  } catch (err) {
    console.log(err.name, err.statusCode, err.message, err.error)

    if (err.statusCode === 401 && err.error.errors[0].errorType === 'expired_token') {
      try {
        const basic = new Buffer(`${fbConfig.clientID}:${fbConfig.clientSecret}`)
              .toString('base64')

        const newAccessToken = aawait(rp({
          method:  'POST',
          uri:     'https://api.fitbit.com/oauth2/token',
          headers: {
            Authorization:  `Basic ${basic}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          form: {
            grant_type:    'refresh_token',
            refresh_token: account.refreshToken,
          },
        }))
        console.log(newAccessToken)

        // FIXME: Replace old accesstoken…
      } catch (err2) {
        console.log(err2.name, err2.statusCode, err2.message, err2.error)
        // Still wrong?  Redirect client.
        throw err2
      }
    }
    return null
  }
})
