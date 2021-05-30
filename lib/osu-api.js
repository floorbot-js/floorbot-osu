const Bottleneck = require("bottleneck");
const fetch = require('node-fetch');

const limiter = new Bottleneck({
    maxConcurrent: 5,
    minTime: 1100
});

const REQUEST = limiter.wrap((endpoint, options) => {
    options.k = options.k || process.env.OSU_API_KEY;
    const paramString = Object.keys(options).map(key => `${key}=${options[key]}`).join('&');
    return fetch(`https://osu.ppy.sh/api/${endpoint}?${paramString}`)
        .then(res => {
            return res.json().then(json => {
                if (!json) {
                    return res.text().then(text => {
                        console.log('houston we have a problem');
                        console.log(text);
                        return [];
                    });
                }
                return json;
            });
        }).catch(err => {});
});

const DOWNLOAD = limiter.wrap((id) => {
    return fetch(`https://osu.ppy.sh/osu/${id}`)
        .then(res => res.buffer());
});


class OsuApi {
    static request(endpoint, options) { return REQUEST(endpoint, options); }
    static getBeatmaps(options) { return OsuApi.request('get_beatmaps', options); }
    static getUser(options) { return OsuApi.request('get_user', options); }
    static getScores(options) { return OsuApi.request('get_scores', options); }
    static getUserBest(options) { return OsuApi.request('get_user_best', options); }
    static getUserRecent(options) { return OsuApi.request('get_user_recent', options); }
    static getMatch(options) { return OsuApi.request('get_match', options); }
    static getReplay(options) { return OsuApi.request('get_replay', options); }
    static download(id) { return DOWNLOAD(id); }
}

module.exports = OsuApi;
