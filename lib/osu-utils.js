const OsuTools = require('./osu-tools');
const OsuApi = require('./osu-api');
const md5File = require('md5-file');
const fs = require('fs');

class OsuUtils {

    // This only gets key:value pairs at the moment.
    static processFile(beatmap_id) {
        const path = `${process.env.OSU_CACHE}/${beatmap_id}.osu`;
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) {
                return resolve(OsuUtils.download(beatmap_id));
            }
            return resolve(path);
        }).then(path => {
            const data = fs.readFileSync(path, 'UTF8');
            return [...data.matchAll(/([a-zA-Z]+):\s?(.+)/gm)].reduce((processed, match) => {
                return Object.assign(processed, {
                    [match[1]]: match[2]
                });
            }, {});
        });
    }

    // Potentially improve this by storing the hash checks in database.
    static getBeatmaps(request, download = false) {
        return OsuApi.getBeatmaps(request).then(beatmaps => {
            if (!download) return beatmaps;
            return Promise.all(beatmaps.map(beatmap => {
                beatmap.path = `${process.env.OSU_CACHE}/${beatmap.beatmap_id}.osu`;
                beatmap.mods = OsuUtils.decodeMods(beatmap.enabled_mods); // IDK IF THIS SHOULD BE HERE -> WILL SEE IF I USE IT
                if (fs.existsSync(beatmap.path)) {
                    const hash = md5File.sync(beatmap.path);
                    if (hash === beatmap.file_md5) return beatmap;
                }
                return OsuUtils.download(beatmap.beatmap_id).then(path => { return beatmap; });
            }));
        });
    }

    // Decodes mods from bitwise enum
    static decodeMods(mods, options = {}) {
        const includeNM = options.includeNM || false;
        const diffOnly = options.diffOnly || false;
        mods = parseInt(mods);
        if (includeNM && mods === 0) return ['NM'];
        const modsArray = Object.keys(OsuUtils.MODS).filter(key => mods & OsuUtils.MODS[key]);
        if (diffOnly) return modsArray.filter(mod => ['HR', 'DT', 'HT', 'EZ'].includes(mod));
        return modsArray.includes('NC') ? modsArray.filter(mod => mod !== 'DT') : modsArray;
    }

    static getAcc(data) {
        return (
            parseInt(data.count300) +
            parseInt(data.count100) / 3 +
            parseInt(data.count50) / 6
        ) / (
            parseInt(data.count300) +
            parseInt(data.count100) +
            parseInt(data.count50) +
            parseInt(data.countmiss)
        ) * 100;
    }

    static downloadBeatmap(beatmap_id) {
        const path = `${process.env.OSU_CACHE}/${beatmap_id}.osu`;
        return OsuApi.download(beatmap_id).then(buffer => {
            fs.writeFileSync(path, buffer);
            return path;
        });
    }

    // I could be adding more info but that will be done as needed
    // Returns a new score with calculated results
    static simulate(score, options) {
        return new Promise((resolve, reject) => {
            const path = score.path || `${process.env.OSU_CACHE}/${score.beatmap_id}.osu`;
            if (fs.existsSync(path)) return resolve(path);
            return resolve(OsuUtils.downloadBeatmap(score.beatmap_id));
        }).then(path => {
            const modOptions = OsuUtils.decodeMods(score.enabled_mods, { diffOnly: true }).map(mod => [OsuTools.MOD, mod.toLowerCase()]).flat();
            const accOptions = [OsuTools.GOODS, score.count100, OsuTools.MEHS, score.count50, OsuTools.COMBO, score.maxcombo, OsuTools.MISSES, score.countmiss];
            return OsuTools.simulate(path, options || modOptions.concat(accOptions)).then(simulated => {
                const simScore = Object.assign({}, score);
                simScore.accuracy_achieved = simulated.accuracy_achieved;
                simScore.pp = simulated.pp;
                return simScore;
            });
        });
    }

    // Returns a new beatmap with difficulty adjustments
    static difficulty(beatmap, mods) {
        mods = beatmap.enabled_mods || mods || 0;
        const options = OsuUtils.decodeMods(mods, { diffOnly: true }).map(mod => [OsuTools.MOD, mod.toLowerCase()]).flat();
        return new Promise((resolve, reject) => {
            const path = beatmap.path || `${process.env.OSU_CACHE}/${beatmap.beatmap_id}.osu`;
            if (fs.existsSync(path)) return resolve(path);
            return resolve(OsuUtils.downloadBeatmap(beatmap.beatmap_id));
        }).then(path => {
            return OsuTools.difficulty(path, options).then(difficulty => {
                const diffBeatmap = Object.assign({}, beatmap);
                if (options.some(option => ['ez', 'ht', 'hr', 'dt', 'nv'].includes(option))) {
                    diffBeatmap.difficultyrating = difficulty.stars;
                    diffBeatmap.diff_approach = Number(difficulty.ar).toFixed(3);
                    diffBeatmap.diff_overall = Number(difficulty.od).toFixed(3);
                }

                if (options.includes('ez')) {
                    diffBeatmap.diff_drain = diffBeatmap.diff_drain * 0.5;
                    diffBeatmap.diff_size = diffBeatmap.diff_size * 0.5;
                }

                if (options.includes('ht')) {
                    diffBeatmap.total_length = diffBeatmap.total_length * 4 / 3;
                    diffBeatmap.hit_length = diffBeatmap.hit_length * 4 / 3;
                    diffBeatmap.bpm = diffBeatmap.bpm * 0.75;
                }

                if (options.includes('hr')) {
                    diffBeatmap.diff_drain = diffBeatmap.diff_drain * 1.4;
                    diffBeatmap.diff_size = diffBeatmap.diff_size * 1.3;
                }

                if (options.includes('dt') || options.includes('NC')) {
                    diffBeatmap.total_length = diffBeatmap.total_length * 2 / 3;
                    diffBeatmap.hit_length = diffBeatmap.hit_length * 2 / 3;
                    diffBeatmap.bpm = diffBeatmap.bpm * 1.5;
                }

                diffBeatmap.difficultyrating = Number(diffBeatmap.difficultyrating).toFixed(3);
                diffBeatmap.diff_drain = Number(diffBeatmap.diff_drain).toFixed(3);
                diffBeatmap.diff_size = Number(diffBeatmap.diff_size).toFixed(3);
                diffBeatmap.bpm = Number(diffBeatmap.bpm).toFixed(3);

                diffBeatmap.total_length = Math.round(diffBeatmap.total_length);
                diffBeatmap.hit_length = Math.round(diffBeatmap.hit_length);
                diffBeatmap.enabled_mods = mods;

                return diffBeatmap;
            });
        });
    }

    static getTimeSince(osuTime) {
        const oDate = new Date(`${osuTime} UTC-0000`);
        const nDate = new Date();
        return (nDate.getTime() - oDate.getTime());
    }

    static getRankEmoji(rank) {
        switch (rank) {
            case 'SSH':
            case 'XH':
                return '<:rankSSH:651013308626894858>';
            case 'SS':
            case 'X':
                return '<:rankSS:651013318508675083>';
            case 'SH':
                return '<:rankSH:651013326427652106>';
            case 'S':
                return '<:rankS:651013333876604938>';
            case 'A':
                return '<:rankA:651013344588988448>';
            case 'B':
                return '<:rankB:651013351958249472>';
            case 'C':
                return '<:rankC:651013360434806785>';
            default:
                return '<:rankD:651013369108627467>';
        }
    }

    static getDiffEmoji(stars) {
        if (stars < 2.0) return '<:osueasy:650218855469285398>';
        if (stars < 2.7) return '<:osunormal:650218903049469982>';
        if (stars < 4.0) return '<:osuhard:650218882497511457>';
        if (stars < 5.3) return '<:osuinsane:650218892798590978>';
        if (stars < 6.5) return '<:osuexpert:650218864638033920>';
        return '<:osuexpertplus:650218874083475456>';
    }

    static getStatusURL(status) {
        switch (parseInt(status)) {
            case 4:
                return 'https://cdn.discordapp.com/emojis/650629400043192341.png';
            case 3:
            case 2:
                return 'https://cdn.discordapp.com/emojis/650629373111697428.png';
            case 1:
                return 'https://cdn.discordapp.com/emojis/650629382817316877.png';
            case 0:
            case -1:
            case -2:
            default:
                return 'https://cdn.discordapp.com/emojis/650629391667429378.png';
        }
    }
}


OsuUtils.MODS = require('./osu-mods.json');
module.exports = OsuUtils;
