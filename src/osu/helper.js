const md5File = require('md5-file/promise');
const fs = require('fs');


// NEVER FORGET             beatmap.bpm = Number(beatmap.bpm).toFixed(1).replace(/([0-9]+(\.[0-9]+[1-9])?)(\.?0+$)/, '$1');


class Helper {

    // This only gets key:value pairs at the moment.
    static processFile(beatmap_id) {
        const path = `${process.env.OsuCache}/${beatmap_id}.osu`;
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(path)) {
                return resolve(Helper.download(beatmap_id));
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
                beatmap.path = `${process.env.OsuCache}/${beatmap.beatmap_id}.osu`;
                beatmap.mods = Helper.decodeMods(beatmap.enabled_mods); // IDK IF THIS SHOULD BE HERE -> WILL SEE IF I USE IT
                if (fs.existsSync(beatmap.path)) {
                    const hash = md5File.sync(beatmap.path);
                    if (hash === beatmap.file_md5) return beatmap;
                }
                return Helper.download(beatmap.beatmap_id).then(path => { return beatmap; });
            }));
        });
    }

    // Decodes mods from bitwise enum
    static decodeMods(mods, options = {}) {
        const includeNM = options.includeNM || false;
        const diffOnly = options.diffOnly || false;
        mods = parseInt(mods);
        if (includeNM && mods === 0) return ['NM'];
        const modsArray = Object.keys(Helper.MODS).filter(key => mods & Helper.MODS[key]);
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

    static download(beatmap_id) {
        const path = `${process.env.OsuCache}/${beatmap_id}.osu`;
        return OsuApi.download(beatmap_id).then(buffer => {
            fs.writeFileSync(path, buffer);
            return path;
        });
    }

    // I could be adding more info but that will be done as needed
    // Returns a new score with calculated results
    static simulate(score, options) {
        return new Promise((resolve, reject) => {
            const path = score.path || `${process.env.OsuCache}/${score.beatmap_id}.osu`;
            if (fs.existsSync(path)) return resolve(path);
            return resolve(Helper.download(score.beatmap_id));
        }).then(path => {
            const modOptions = Helper.decodeMods(score.enabled_mods, { diffOnly: true }).map(mod => [PerformanceCalculator.MOD, mod.toLowerCase()]).flat();
            const accOptions = [PerformanceCalculator.GOODS, score.count100, PerformanceCalculator.MEHS, score.count50, PerformanceCalculator.COMBO, score.maxcombo, PerformanceCalculator.MISSES, score.countmiss];
            return PerformanceCalculator.simulate(path, options || modOptions.concat(accOptions)).then(simulated => {
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
        const options = Helper.decodeMods(mods, { diffOnly: true }).map(mod => [PerformanceCalculator.MOD, mod.toLowerCase()]).flat();
        return new Promise((resolve, reject) => {
            const path = beatmap.path || `${process.env.OsuCache}/${beatmap.beatmap_id}.osu`;
            if (fs.existsSync(path)) return resolve(path);
            return resolve(Helper.download(beatmap.beatmap_id));
        }).then(path => {
            return PerformanceCalculator.difficulty(path, options).then(difficulty => {
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
}


Helper.MODS = require('./mods.json');
module.exports = Helper;
