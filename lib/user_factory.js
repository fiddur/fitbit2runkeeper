'use strict'

const uuid = require('node-uuid')

/**
 * A User has a collection of accounts, one for each service (fitbit & runkeeper).
 *
 * Example:
 * {
 *   id: uuid,
 *   accounts: {
 *     fitbit: {
 *       id: profile-id,
 *       profile: {...}, // from passport
 *       tokens: {accessToken: ..., refreshToken: ...}
 *     },
 *     runkeeper: {...}
 *   }
 * }
 *
 */
const UserFactory = collection => {
  return {
    getById: id => collection.findOne({id: id}),

    getByProfile: profile => collection.findOne({
      ['accounts.' + profile.provider + '.id']: profile.id
    }),

    create: profile => collection.insertOne({
      id: uuid.v4(),
      accounts: {[profile.provider]: {profile: profile, id: profile.id}}
    }),

    setAccount: (id, profile) => collection.updateOne(
      {id: id},
      {$set: {
        ['accounts.' + profile.provider]: {profile: profile, id: profile.id}
      }}
    ),

    setTokens: (id, provider, tokens) => collection.updateOne(
      {id: id},
      {$set: {['accounts.' + provider + '.tokens']: tokens}}
    ),
  }
}

module.exports = UserFactory
