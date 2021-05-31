const { spawn } = require('child_process');
const toolsPath = process.env.OSU_TOOLS_PATH || `${__dirname}/../bin/${process.arch}`;

class OsuTools {

    static difficulty(path, options = []) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const calculator = spawn('dotnet', [`${toolsPath}/PerformanceCalculator.dll`, 'difficulty', path].concat(options));
            calculator.stdout.on('data', (data) => { chunks.push(data.toString()); });
            calculator.stderr.on('data', (data) => reject(data.toString()));
            calculator.on('exit', (code) => {
                const data = chunks.join('').replace(/\,/g, '.');
                const values = [...data.matchAll(/((?:\d|,)+(\.\d+)?)/gm)].map(match => match[1]);
                resolve({
                    ruleset: /^Ruleset:\s(.+)/gm.exec(data)[1],
                    title: /^[\│\║\�](.+?)[\│\║\�]/gm.exec(data)[1].trim(),
                    beatmap_id: values[0],
                    stars: Number(values[values.length - 6]),
                    aim: Number(values[values.length - 5]),
                    speed: Number(values[values.length - 4]),
                    max_combo: Number(values[values.length - 3]),
                    ar: Number(values[values.length - 2]),
                    od: Number(values[values.length - 1]),
                });
            });
        });
    }

    static performance(path, options = []) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const calculator = spawn('dotnet', [`${toolsPath}/PerformanceCalculator.dll`, 'performance', path].concat(options));
            calculator.stdout.on('data', (data) => { chunks.push(data.toString()); });
            calculator.stderr.on('data', (data) => reject(data.toString()));
            calculator.on('exit', (code) => {
                const data = chunks.join('').replace(/\r/g, '').split('\n\n').filter(string => string.length);
                resolve(data.map(single => {
                    return {
                        path: /^(.*)$/m.exec(single)[1],
                        player: /^Player\s+:\s(.+)/gm.exec(single)[1],
                        mods: /^Mods\s+:\s(.+)/gm.exec(single)[1].split(', '),
                        accuracy: Number(/^Accuracy\s+:\s(-?\d+(\.\d+)?)$/gm.exec(single)[1]),
                        speed: Number(/^Speed\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1]),
                        aim: Number(/^Aim\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1]),
                        od: Number(/^OD\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1]),
                        ar: Number(/^AR\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1]),
                        max_combo: Number(/^Max Combo\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1]),
                        pp: Number(/^pp\s+:\s(-?\d+(\.\d+)?)/gm.exec(single)[1])
                    };
                }));
            });
        });
    }

    static profile(apiKey, user, options = []) {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const calculator = spawn('dotnet', [`${toolsPath}/PerformanceCalculator.dll`, 'profile', user, apiKey].concat(options));
            calculator.stdout.on('data', (data) => { chunks.push(data.toString()); });
            calculator.stderr.on('data', (data) => reject(data.toString()));
            calculator.on('exit', (code) => {
                const data = chunks.join('');
                const matches = [...data.matchAll(/^[\│\║\�]([^\│\║\�]+)[\│\║\�]([^\│\║\�]+)[\│\║\�]([^\│\║\�]+)[\│\║\�]([^\│\║\�]+)[\│\║\�]([^\│\║\�]+)[\│\║\�]/gm)];
                const profile = {
                    user: /User:\s+(.+)/gm.exec(data)[1],
                    live_pp: /Live PP:\s+(.+)/gm.exec(data)[1],
                    local_pp: /Local PP:\s+(.+)/gm.exec(data)[1],
                    plays: []
                };
                for (let i = 1; i < matches.length; i++) {
                    const matched = /(\d+) - (.+)/gm.exec(matches[i][1]);
                    profile.plays.push({
                        beatmap_id: matched[1],
                        beatmap: matched[2].trim(),
                        live_pp: Number(matches[i][2].replace(',', '')),
                        local_pp: Number(matches[i][3].replace(',', '')),
                        pp_change: Number(matches[i][4].replace(',', '')),
                        position_change: Number(matches[i][5].replace(',', ''))
                    });
                }
                resolve(profile);
            });
        });
    }

    static simulate(path, options = [], mode = 'osu') {
        return new Promise((resolve, reject) => {
            const chunks = [];
            const calculator = spawn('dotnet', [`${toolsPath}/PerformanceCalculator.dll`, 'simulate', mode, path].concat(options));
            calculator.stdout.on('data', (data) => chunks.push(data.toString()));
            calculator.stderr.on('data', (data) => {
                // console.log(data.toString());
                reject(data.toString());
            });
            calculator.on('exit', (code) => {
                if (!code) {
                    const data = chunks.join('');
                    const simulated = {
                        title: /^(.*)$/m.exec(data)[1],
                        accuracy_achieved: Number(/^Accuracy\s+:\s(\d+(\.\d+)?)%/gm.exec(data)[1]),
                        combo: Number(/^Combo\s+:\s(-?\d+(\.\d+)?).+/gm.exec(data)[1]),
                        great: Number(/^Great\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]),
                        good: Number(/^Ok\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]),
                        meh: Number(/^Meh\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]),
                        miss: Number(/^Miss\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]),
                        mods: /^Mods\s+:\s(.+)/gm.exec(data)[1].split(', '),
                        aim: /^Aim/gm.test(data) ? Number(/^Aim\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN,
                        speed: /^Speed/gm.test(data) ? Number(/^Speed\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN,
                        accuracy: /^Accuracy/gm.test(data) ? Number(/^Accuracy\s+:\s(-?\d+(\.\d+(E-\d+)?)?)$$/gm.exec(data)[1]) : NaN,
                        od: /^OD/gm.test(data) ? Number(/^OD\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN,
                        ar: /^AR/gm.test(data) ? Number(/^AR\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN,
                        max_combo: /^Max Combo/gm.test(data) ? Number(/^Max Combo\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN,
                        pp: /^pp/gm.test(data) ? Number(/^pp\s+:\s(-?\d+(\.\d+)?)/gm.exec(data)[1]) : NaN
                    };
                    if (!simulated.aim) {
                        console.log(`DATA:`);
                        console.log(data);
                    }
                    resolve(simulated);
                }
            });
        });
    }
};

OsuTools.PERCENT_COMBO = '--percent-combo';
OsuTools.RULESET = '--ruleset';
OsuTools.MISSES = '--misses';
OsuTools.OUTPUT = '--output';
OsuTools.ACC = '--accuracy';
OsuTools.COMBO = '--combo';
OsuTools.GOODS = '--goods';
OsuTools.MEHS = '--mehs';
OsuTools.MOD = '-m';

OsuTools.CATCH = 'catch';
OsuTools.TAIKO = 'taiko';
OsuTools.MANIA = 'mania';
OsuTools.OSU = 'osu';

module.exports = OsuTools;
