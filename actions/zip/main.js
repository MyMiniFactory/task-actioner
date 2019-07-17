const util = require('util');
const exec = util.promisify(require('child_process').exec);
const path = require('path');

const appDir = path.dirname(require.main.filename);

async function shell(command) {
  console.log('Running: "' + command + '"');
  const { stdout, stderr } = await exec(command);
  console.log('stdout:', stdout);
  console.error('stderr:', stderr);
}

async function main (payload) {
    console.log('Zip action received: ', payload);
    const randomNumber = Math.floor(Math.random() * Math.floor(100000));
    const compressedFile = '/tmp/' + randomNumber + '.zip';

    const hasBuilt = await shell('bash ' + appDir + '/actions/zip/build.sh');

    const hasZipped = await shell(
        'docker run --rm -v '
        + appDir
        + '/tmp:/tmp mmf-action-zip -rj "$@" '
        + compressedFile
        + ' '
        + payload.map(file => file.location.slice(appDir.length)).join(' ')
    );

    console.log(appDir + compressedFile);

    return [{location: appDir + compressedFile, name: randomNumber + '.zip'}];
};

module.exports.run = main
