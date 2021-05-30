const fs = require('fs');

module.exports = (pool) => {
    return {
        commands: {
            recent: { class: require('./osu/recent/recent'), options: { pool } }
        },
        setup: (client) => {
            return Promise.allSettled([
                Promise.resolve()
            ]).then(results => {
                const error = results.find(result => result.reason && result.reason.code && result.reason.code !== 'ER_TABLE_EXISTS_ERROR');
                if (error) client.emit('log', '[SETUP](osu!) database setup failed', error)
                else client.emit('log', '[SETUP](osu!) database setup successful')
            })
        }
    }
}
