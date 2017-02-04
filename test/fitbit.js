const Fitbit = require('../lib/fitbit')
const aasync = require('asyncawait/async')
const aawait = require('asyncawait/await')
const assert = require('assert')
const moment = require('moment')
const sinon  = require('sinon')

const user = {
  accounts: {
    fitbit: {
      accessToken:  'myAccessToken',
      refreshToken: 'myRefreshToken',
    },
  },
}

describe('Fitbit', () => {
  describe('getActivities', () => {
    it('should construct the right uri', aasync(() => {
      const rp = sinon.stub().returns(Promise.resolve('all good'))
      const fitbit = Fitbit({ rp })
      const date = moment('1999-12-31')

      aawait(fitbit.getActivities(user, date))
      sinon.assert.calledOnce(rp)
      sinon.assert.calledWithMatch(rp, {
        uri: 'https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=1999-12-31&sort=desc&limit=10&offset=0',
      })
    }))

    it('should construct the right uri even second time', aasync(() => {
      const rp = sinon.stub().returns(Promise.resolve('all good'))
      const fitbit = Fitbit({ rp })
      const date = moment('1999-12-31')

      aawait(fitbit.getActivities(user, date))
      aawait(fitbit.getActivities(user, date))
      sinon.assert.calledTwice(rp)

      const call2 = rp.getCall(1)
      assert.equal('https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=1999-12-31&sort=desc&limit=10&offset=0', call2.args[0].uri)
    }))
  })
})
