const uuid = require('node-uuid')

module.exports = collection => ({
  create: () => collection
    .insertOne({
      id:       uuid.v4(),
      accounts: {},
    })
    .then(result => result.ops[0]),

  setActivityAsExported: (id, fitbitId, timestamp) => collection
    .findOneAndUpdate(
      { id },
      { $set: {
        [`exported.${fitbitId}`]: { timestamp: timestamp.toISOString() },
      } }
    ),

  setFitbitTokens: (id, tokens) => collection
    .findOneAndUpdate(
      { id },
      { $set: {
        'accounts.fitbit.accessToken':  tokens.access_token,
        'accounts.fitbit.refreshToken': tokens.refresh_token,
      } }
    ),

  getById: id => collection
    .findOne({ id }),

  getByProvider: (provider, id) => collection
    .findOne({ [`${provider}Id`]: id }),

  // Set/update connected account information
  setAccount: (id, profile, accessToken, refreshToken) => collection
    .findOneAndUpdate(
      { id },
      { $set: {
        [`${profile.provider}Id`]:        profile.id,
        [`accounts.${profile.provider}`]: { accessToken, profile, refreshToken },
      } }
    ),
})
